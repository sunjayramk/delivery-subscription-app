import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { buildAddressServiceFields, getRouteLabel } from "../../services/addressRoutes";
import { fetchCustomerBalances } from "../../services/balances";
import { getLocalDateString } from "../../services/deliverySlots";
import {
  getOperationalOrderStatus,
  normalizeOrderStatus,
  readOrderDeliveryDate,
} from "../../services/deliveryOrders";

interface DashboardProps {
  onOpenTab?: (tab: string, options?: DashboardOpenOptions) => void;
}

type DashboardOpenOptions = {
  orderStatusFilter?: "All" | "pending" | "delivered" | "cancelled";
  orderRouteFilter?: "all" | "missing";
  billingBalanceFilter?: "all" | "due" | "credit";
  customerBalanceFilter?: "all" | "low";
  customerAddressFilter?: "all" | "issues";
};

interface RouteSummary {
  key: string;
  name: string;
  agentName: string;
  total: number;
  pending: number;
  delivered: number;
  cancelled: number;
  items: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  status: string;
  deliveryDate: string;
  amount: number;
  createdAtMs: number;
}

interface DashboardMetrics {
  todayOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  unassignedOrders: number;
  nonServiceableAddresses: number;
  routesWithoutAgent: number;
  pendingApprovals: number;
  lowBalanceCount: number;
  totalOutstanding: number;
  amountAvailable: number;
  monthlySales: number;
  routeSummaries: RouteSummary[];
  recentOrders: RecentOrder[];
}

const emptyMetrics: DashboardMetrics = {
  todayOrders: 0,
  pendingOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  unassignedOrders: 0,
  nonServiceableAddresses: 0,
  routesWithoutAgent: 0,
  pendingApprovals: 0,
  lowBalanceCount: 0,
  totalOutstanding: 0,
  amountAvailable: 0,
  monthlySales: 0,
  routeSummaries: [],
  recentOrders: [],
};

function readDateMs(value: any) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function itemCount(items: any[] = []) {
  return items.reduce((sum, item) => sum + Number(item.qty || 1), 0);
}

function itemTotal(items: any[] = []) {
  return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
}

function hasUsableRoute(value: any) {
  const routeName = String(value?.routeName || value?.deliveryAddress?.routeName || "").trim().toLowerCase();
  return Boolean(value?.routeId || value?.deliveryAddress?.routeId || (routeName && routeName !== "unassigned"));
}

function readRouteKey(order: any) {
  return order.routeId || order.deliveryAddress?.routeId || order.routeName || order.deliveryAddress?.routeName || "unassigned";
}

function readRouteName(order: any, routeById: Map<string, any>) {
  const routeId = order.routeId || order.deliveryAddress?.routeId || "";
  if (routeId && routeById.get(routeId)?.name) return routeById.get(routeId).name;
  return getRouteLabel({
    routeStatus: order.routeStatus || order.deliveryAddress?.routeStatus,
    routeName: order.routeName || order.deliveryAddress?.routeName,
  });
}

function formatMoney(value: number) {
  return `Rs.${Math.round(value).toLocaleString("en-IN")}`;
}

function statusTone(status: string): CSSProperties {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return { background: "#dcfce7", color: "#15803d" };
  if (normalized === "cancelled") return { background: "#fee2e2", color: "#b91c1c" };
  return { background: "#fef3c7", color: "#92400e" };
}

export default function DashboardTab({ onOpenTab }: DashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [refreshTick, setRefreshTick] = useState(0);

  const todayStr = getLocalDateString(new Date());
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    const handleFocus = () => setRefreshTick((value) => value + 1);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    async function loadDashboardMetrics() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        const tenantId = user.tenantId;
        const now = new Date();
        const monthStart = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));

        const [
          settingsSnap,
          ordersSnap,
          balanceMap,
          routesSnap,
          agentsSnap,
          addressesSnap,
          zonesSnap,
          hubsSnap,
        ] = await Promise.all([
          getDoc(doc(db, "tenants", tenantId, "settings", "global")),
          getDocs(collection(db, "tenants", tenantId, "orders")),
          fetchCustomerBalances(tenantId),
          getDocs(collection(db, "tenants", tenantId, "routes")),
          getDocs(query(collection(db, "users"), where("tenantId", "==", tenantId), where("role", "==", "agent"))),
          getDocs(collection(db, "tenants", tenantId, "addresses")),
          getDocs(collection(db, "tenants", tenantId, "zones")),
          getDocs(collection(db, "tenants", tenantId, "hubs")),
        ]);

        const warningLimit = Number(settingsSnap.exists() ? settingsSnap.data().warningLimit || 500 : 500);
        const routes = routesSnap.docs.map((routeDoc) => ({ id: routeDoc.id, ...(routeDoc.data() as any) }));
        const routeById = new Map(routes.map((route) => [route.id, route]));
        const agentsById = new Map(agentsSnap.docs.map((agentDoc) => [agentDoc.id, agentDoc.data().name || "Unnamed agent"]));
        const zones = zonesSnap.docs.map((zoneDoc) => ({ id: zoneDoc.id, ...(zoneDoc.data() as any) }));
        const hubs = hubsSnap.docs.map((hubDoc) => ({ id: hubDoc.id, ...(hubDoc.data() as any) }));

        const routeSummaries = new Map<string, RouteSummary>();
        routes.forEach((route) => {
          routeSummaries.set(route.id, {
            key: route.id,
            name: route.name || "Unnamed route",
            agentName: route.assignedAgentId ? agentsById.get(route.assignedAgentId) || "Assigned" : "Unassigned",
            total: 0,
            pending: 0,
            delivered: 0,
            cancelled: 0,
            items: 0,
          });
        });

        let todayOrders = 0;
        let pendingOrders = 0;
        let deliveredOrders = 0;
        let cancelledOrders = 0;
        let unassignedOrders = 0;
        let pendingApprovals = 0;
        let monthlySales = 0;
        const recentOrders: RecentOrder[] = [];

        ordersSnap.forEach((orderDoc) => {
          const data = { id: orderDoc.id, ...orderDoc.data() } as any;
          const deliveryDate = readOrderDeliveryDate(data);
          const status = getOperationalOrderStatus(data);
          const total = Number(data.totalAmount ?? itemTotal(data.items || []));

          if (deliveryDate >= monthStart && deliveryDate <= todayStr && status === "delivered") {
            monthlySales += total;
          }

          if (data.status === "pending_approval") pendingApprovals += 1;

          if (deliveryDate === todayStr) {
            todayOrders += 1;
            if (status === "pending") pendingOrders += 1;
            if (status === "delivered") deliveredOrders += 1;
            if (status === "cancelled") cancelledOrders += 1;
            if (!hasUsableRoute(data) && status === "pending") unassignedOrders += 1;

            const routeKey = readRouteKey(data);
            const existing = routeSummaries.get(routeKey) || {
              key: routeKey,
              name: readRouteName(data, routeById),
              agentName: "Unassigned",
              total: 0,
              pending: 0,
              delivered: 0,
              cancelled: 0,
              items: 0,
            };

            existing.total += 1;
            existing.items += itemCount(data.items || []);
            if (status === "pending") existing.pending += 1;
            if (status === "delivered") existing.delivered += 1;
            if (status === "cancelled") existing.cancelled += 1;
            routeSummaries.set(routeKey, existing);
          }

          recentOrders.push({
            id: orderDoc.id,
            customerName: data.customerName || "Customer",
            status,
            deliveryDate,
            amount: total,
            createdAtMs: readDateMs(data.createdAt),
          });
        });

        let totalOutstanding = 0;
        let amountAvailable = 0;
        let lowBalanceCount = 0;
        Object.values(balanceMap).forEach((summary) => {
          const due = Number(summary.outstandingDue || 0);
          const creditAvailable = Math.max(0, -due);
          if (due > 0) totalOutstanding += due;
          if (due < 0) amountAvailable += Math.abs(due);
          if (summary.hasFinancialActivity && creditAvailable < warningLimit) lowBalanceCount += 1;
        });

        let nonServiceableAddresses = 0;
        addressesSnap.forEach((addressDoc) => {
          const fields = buildAddressServiceFields(addressDoc.data(), zones, hubs);
          if (fields.routeStatus === "unserviceable") nonServiceableAddresses += 1;
        });

        setMetrics({
          todayOrders,
          pendingOrders,
          deliveredOrders,
          cancelledOrders,
          unassignedOrders,
          nonServiceableAddresses,
          routesWithoutAgent: routes.filter((route) => !route.assignedAgentId).length,
          pendingApprovals,
          lowBalanceCount,
          totalOutstanding,
          amountAvailable,
          monthlySales,
          routeSummaries: Array.from(routeSummaries.values()).sort((a, b) => {
            const pendingCompare = b.pending - a.pending;
            if (pendingCompare !== 0) return pendingCompare;
            return b.total - a.total;
          }),
          recentOrders: recentOrders.sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, 5),
        });
      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardMetrics();
  }, [todayStr, user, refreshTick]);

  const deliveryProgress = metrics.todayOrders === 0 ? 0 : Math.round((metrics.deliveredOrders / metrics.todayOrders) * 100);

  const attentionItems = useMemo<Array<{ label: string; count: number; tab: string; tone: "danger" | "warning" | "info" | "success"; options?: DashboardOpenOptions }>>(() => [
    { label: "Orders missing route", count: metrics.unassignedOrders, tab: "orders", tone: "danger", options: { orderStatusFilter: "pending", orderRouteFilter: "missing" } },
    { label: "Non-serviceable addresses", count: metrics.nonServiceableAddresses, tab: "customers", tone: "danger", options: { customerAddressFilter: "issues" } },
    { label: "Routes without agent", count: metrics.routesWithoutAgent, tab: "delivery", tone: "warning" },
    { label: "Pending deliveries today", count: metrics.pendingOrders, tab: "orders", tone: "warning", options: { orderStatusFilter: "pending" } },
    { label: "Low balance customers", count: metrics.lowBalanceCount, tab: "customers", tone: "info" },
  ], [metrics]);

  const activeAttention = attentionItems.filter((item) => item.count > 0);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <style>{`
        .dash-card { transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease; }
        .dash-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); border-color: #cbd5e1; }
        .dash-btn { transition: background 0.16s ease, border-color 0.16s ease; }
        .dash-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
        .dash-skeleton { animation: pulse 1.2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
      `}</style>

      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, color: "#111827", fontWeight: 800 }}>{greeting}, {user?.name?.split(" ")[0] || "Admin"}</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Today: orders, routes, payments, and exceptions in one place.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => onOpenTab?.("manifest")} style={secondaryButtonStyle}>Open Manifest</button>
          <button onClick={() => onOpenTab?.("orders", { orderStatusFilter: "All" })} style={primaryButtonStyle}>Review Orders</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((item) => <div key={item} className="dash-skeleton" style={{ height: 130, borderRadius: 12, background: "#e5e7eb" }} />)}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))", gap: 16, marginBottom: 18 }}>
            <KpiCard title="Delivered" value={metrics.deliveredOrders} helper={`${metrics.todayOrders} orders today`} tab="orders" navigationOptions={{ orderStatusFilter: "delivered" }} onOpenTab={onOpenTab} tone="blue" />
            <KpiCard title="Undelivered" value={metrics.pendingOrders} helper="Pending on route" tab="orders" navigationOptions={{ orderStatusFilter: "pending" }} onOpenTab={onOpenTab} tone="amber" />
            <KpiCard title="Outstanding" value={formatMoney(metrics.totalOutstanding)} helper="Customer dues" tab="billing" navigationOptions={{ billingBalanceFilter: "due" }} onOpenTab={onOpenTab} tone="red" />
            <KpiCard title="Amount Available" value={formatMoney(metrics.amountAvailable)} helper="Customer advance" tab="billing" navigationOptions={{ billingBalanceFilter: "credit" }} onOpenTab={onOpenTab} tone="green" />
            <KpiCard title="Low Balance" value={metrics.lowBalanceCount} helper="Customers at risk" tab="customers" navigationOptions={{ customerBalanceFilter: "low" }} onOpenTab={onOpenTab} tone="orange" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)", gap: 18, alignItems: "start" }}>
            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Delivery Health</h2>
                  <p style={sectionSubStyle}>Route-wise progress for today</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{deliveryProgress}%</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>completed</div>
                </div>
              </div>

              <div style={{ height: 10, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", marginBottom: 18 }}>
                <div style={{ width: `${deliveryProgress}%`, height: "100%", background: deliveryProgress === 100 ? "#16a34a" : "#2563eb", transition: "width 0.4s ease" }} />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: "#475569", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={tableHeadStyle}>Route</th>
                      <th style={tableHeadStyle}>Agent</th>
                      <th style={tableHeadStyle}>Pending</th>
                      <th style={tableHeadStyle}>Delivered</th>
                      <th style={tableHeadStyle}>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.routeSummaries.slice(0, 6).map((route) => (
                      <tr key={route.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={tableCellStyle}><strong>{route.name}</strong><div style={{ color: "#64748b", marginTop: 3 }}>{route.total} orders</div></td>
                        <td style={tableCellStyle}>{route.agentName}</td>
                        <td style={tableCellStyle}><Badge value={route.pending} tone={route.pending > 0 ? "warning" : "muted"} /></td>
                        <td style={tableCellStyle}><Badge value={route.delivered} tone="success" /></td>
                        <td style={tableCellStyle}>{route.items}</td>
                      </tr>
                    ))}
                    {metrics.routeSummaries.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 24, color: "#64748b", textAlign: "center", fontWeight: 700 }}>No routes found yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Needs Attention</h2>
                  <p style={sectionSubStyle}>Items admin should check first</p>
                </div>
                <span style={{ padding: "5px 9px", borderRadius: 999, background: activeAttention.length ? "#fee2e2" : "#dcfce7", color: activeAttention.length ? "#b91c1c" : "#15803d", fontSize: 12, fontWeight: 900 }}>
                  {activeAttention.length || "OK"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {(activeAttention.length ? activeAttention : [{ label: "No urgent issues right now", count: 0, tab: "dashboard", tone: "success" as const, options: undefined }]).map((item) => (
                  <button key={item.label} onClick={() => onOpenTab?.(item.tab, item.options)} className="dash-btn" style={attentionRowStyle}>
                    <span style={{ color: "#111827", fontWeight: 800 }}>{item.label}</span>
                    <Badge value={item.count} tone={item.tone as any} />
                  </button>
                ))}
              </div>

              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#111827" }}>Recent Orders</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {metrics.recentOrders.map((order) => (
                  <button key={order.id} onClick={() => onOpenTab?.("orders")} className="dash-btn" style={recentRowStyle}>
                    <div>
                      <div style={{ color: "#111827", fontWeight: 800 }}>{order.customerName}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{order.deliveryDate || "No delivery date"} - {formatMoney(order.amount)}</div>
                    </div>
                    <span style={{ ...statusTone(order.status), padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 900 }}>{normalizeOrderStatus(order.status)}</span>
                  </button>
                ))}
                {metrics.recentOrders.length === 0 && <div style={{ padding: 18, color: "#64748b", fontWeight: 700, background: "#f8fafc", borderRadius: 10 }}>No recent orders.</div>}
              </div>
            </section>
          </div>

          <section style={{ ...panelStyle, marginTop: 18 }}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Quick Actions</h2>
                <p style={sectionSubStyle}>Common admin workflows</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {[
                { title: "Orders", sub: "Review and update", tab: "orders" },
                { title: "Customers", sub: "Routes and wallets", tab: "customers" },
                { title: "Delivery", sub: "Assign agents", tab: "delivery" },
                { title: "Logistics", sub: "Zones and routes", tab: "logistics" },
                { title: "Billing", sub: "Payments and dues", tab: "billing" },
                { title: "Products", sub: "Catalog and stock", tab: "products" },
              ].map((action) => (
                <button key={action.tab} onClick={() => onOpenTab?.(action.tab)} className="dash-card" style={quickActionStyle}>
                  <span style={{ fontWeight: 900, color: "#111827" }}>{action.title}</span>
                  <span style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{action.sub}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value, helper, tab, navigationOptions, tone, onOpenTab }: { title: string; value: string | number; helper: string; tab: string; navigationOptions?: DashboardOpenOptions; tone: "blue" | "amber" | "red" | "orange" | "green"; onOpenTab?: (tab: string, options?: DashboardOpenOptions) => void }) {
  const colors = {
    blue: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
    amber: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
    red: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
    orange: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
    green: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  }[tone];

  return (
    <button onClick={() => onOpenTab?.(tab, navigationOptions)} className="dash-card" style={{ textAlign: "left", background: "#fff", padding: 18, borderRadius: 12, border: `1px solid ${colors.border}`, cursor: "pointer", minHeight: 126, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -28, top: -28, width: 96, height: 96, borderRadius: 999, background: colors.bg }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "inline-flex", padding: "5px 8px", borderRadius: 8, background: colors.bg, color: colors.text, fontSize: 12, fontWeight: 900, marginBottom: 12 }}>{title}</div>
        <div style={{ color: "#111827", fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{value}</div>
        <div style={{ color: colors.text, fontSize: 12, fontWeight: 800, marginTop: 8 }}>{helper}</div>
      </div>
    </button>
  );
}

function Badge({ value, tone }: { value: number; tone: "danger" | "warning" | "info" | "success" | "muted" }) {
  const colors = {
    danger: { bg: "#fee2e2", text: "#b91c1c" },
    warning: { bg: "#fef3c7", text: "#92400e" },
    info: { bg: "#dbeafe", text: "#1d4ed8" },
    success: { bg: "#dcfce7", text: "#15803d" },
    muted: { bg: "#f1f5f9", text: "#64748b" },
  }[tone];

  return <span style={{ minWidth: 30, textAlign: "center", padding: "4px 8px", borderRadius: 999, background: colors.bg, color: colors.text, fontSize: 12, fontWeight: 900 }}>{value}</span>;
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 16,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  color: "#111827",
};

const sectionSubStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const tableHeadStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const tableCellStyle: CSSProperties = {
  padding: "12px 8px",
  color: "#334155",
  verticalAlign: "middle",
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};

const attentionRowStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
};

const recentRowStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  textAlign: "left",
};

const quickActionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  padding: 14,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  cursor: "pointer",
  textAlign: "left",
};
