import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import {
  doesSubscriptionRunOnDate,
  getLocalDateString,
  normalizeShift,
  parseLocalDate,
  type DateLike,
} from "../../services/deliverySlots";
import {
  fetchOrdersForDeliveryDate,
  normalizeOrderStatus,
  type DeliveryOrder,
  type OrderShift,
} from "../../services/deliveryOrders";

interface Subscription {
  id: string;
  customerId: string;
  customerName?: string;
  productId?: string;
  productName: string;
  unit: string;
  price: number;
  qty: number;
  scheduleType: string;
  scheduleDays?: number[];
  dayQuantities?: Record<string, number>;
  skipDates?: string[];
  vacationFrom?: string;
  vacationTo?: string;
  deliveryAddress?: any;
  shift?: string;
  deliveryShift?: string;
  startDate?: DateLike;
  isActive?: boolean;
  addressId?: string;
  routeStatus?: string;
  routeId?: string;
  routeName?: string;
  zoneId?: string;
  hubId?: string;
}

interface Route {
  id: string;
  name: string;
  zoneId?: string;
}

interface CustomerRoute {
  customerId: string;
  routeId?: string;
  routeName: string;
  zoneId?: string;
  hubId?: string;
}

interface DeliveryItem {
  productId?: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
}

interface DeliveryRow {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  routeId?: string;
  routeName: string;
  zoneId?: string;
  hubId?: string;
  shift: OrderShift;
  source: "Subscription" | "One-time";
  status: string;
  items: DeliveryItem[];
  orderId?: string;
  isExpectedOnly?: boolean;
}

const SHIFT_OPTIONS = ["All", "Morning", "Evening"] as const;
const STATUS_OPTIONS = ["All", "pending", "delivered", "cancelled"] as const;

function formatAddress(address: any) {
  if (!address) return "No address listed";
  return [address.label, address.line1, address.area, address.city, address.pincode].filter(Boolean).join(", ") || "No address listed";
}

function itemQuantity(items: DeliveryItem[]) {
  return items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function isSubscriptionOrder(order: DeliveryOrder) {
  return order.source === "subscription" || order.type === "subscription";
}

function subscriptionQtyForDate(sub: Subscription, targetDate: Date) {
  const dayQty = sub.dayQuantities?.[String(targetDate.getDay())];
  return typeof dayQty === "number" ? dayQty : sub.qty;
}

function statusLabel(status: string) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "pending") return "Pending";
  return status || "Pending";
}

function statusColor(status: string) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return { background: "#dcfce7", color: "#15803d" };
  if (normalized === "cancelled") return { background: "#fee2e2", color: "#b91c1c" };
  return { background: "#fef3c7", color: "#92400e" };
}

export default function DailyManifest() {
  const { user } = useAuth();
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [customerRoutes, setCustomerRoutes] = useState<Record<string, CustomerRoute>>({});
  const [selectedDateStr, setSelectedDateStr] = useState(getLocalDateString(new Date()));
  const [selectedShift, setSelectedShift] = useState<(typeof SHIFT_OPTIONS)[number]>("All");
  const [selectedRoute, setSelectedRoute] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadBaseData() {
      if (!user?.tenantId) return;
      setLoadingBase(true);
      try {
        const tenantId = user.tenantId;
        const [subsSnap, routesSnap, assignmentsSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, "tenants", tenantId, "subscriptions"), where("isActive", "==", true))),
          getDocs(query(collection(db, "tenants", tenantId, "routes"))),
          getDocs(query(collection(db, "tenants", tenantId, "customerAssignments"))),
          getDocs(query(collection(db, "users"), where("tenantId", "==", tenantId))),
        ]);

        const routeList = routesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Route));
        const routeByName = new Map(routeList.map((route) => [route.name, route]));
        const routeById = new Map(routeList.map((route) => [route.id, route]));
        const routeMap: Record<string, CustomerRoute> = {};

        assignmentsSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data.customerId) return;
          const routeFromId = data.routeId ? routeById.get(data.routeId) : undefined;
          const routeFromName = data.routeName ? routeByName.get(data.routeName) : undefined;
          const route = routeFromId || routeFromName;
          routeMap[data.customerId] = {
            customerId: data.customerId,
            routeId: data.routeId || route?.id || undefined,
            routeName: data.routeName || route?.name || "Unassigned",
            zoneId: data.zoneId || route?.zoneId || undefined,
            hubId: data.hubId || undefined,
          };
        });

        usersSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.role !== "customer" || routeMap[docSnap.id]) return;
          const routeFromId = data.routeId ? routeById.get(data.routeId) : undefined;
          const routeFromName = data.routeName ? routeByName.get(data.routeName) : undefined;
          const route = routeFromId || routeFromName;
          routeMap[docSnap.id] = {
            customerId: docSnap.id,
            routeId: data.routeId || route?.id || undefined,
            routeName: data.routeName || route?.name || "Unassigned",
            zoneId: route?.zoneId || undefined,
          };
        });

        setSubscriptions(subsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Subscription)));
        setRoutes(routeList);
        setCustomerRoutes(routeMap);
      } catch (error) {
        console.error("Failed to load manifest base data", error);
      } finally {
        setLoadingBase(false);
      }
    }

    void loadBaseData();
  }, [user]);

  useEffect(() => {
    async function loadOrdersForDate() {
      if (!user?.tenantId) return;
      setLoadingOrders(true);
      try {
        setOrders(await fetchOrdersForDeliveryDate(user.tenantId, selectedDateStr));
      } catch (error) {
        console.error("Failed to load delivery orders", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }

    void loadOrdersForDate();
  }, [user, selectedDateStr]);

  const deliveryRows = useMemo(() => {
    const targetDate = parseLocalDate(selectedDateStr);
    if (!targetDate) return [];

    const actualSubscriptionKeys = new Set<string>();
    const rows: DeliveryRow[] = orders.map((order) => {
      if (isSubscriptionOrder(order)) {
        actualSubscriptionKeys.add(`${order.customerId}_${order.computedShift}_${order.addressId || order.deliveryAddress?.addressId || "default"}`);
      }

      const mappedRoute = customerRoutes[order.customerId] || {};
      const addressRoute = order.deliveryAddress || {};
      const items = (order.items || []).map((item: any) => ({
        productId: item.productId,
        name: item.name || item.productName || "Item",
        unit: item.unit || "unit",
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
      }));

      return {
        id: order.id,
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName || "Customer",
        address: formatAddress(order.deliveryAddress),
        routeId: order.routeId || addressRoute.routeId || mappedRoute.routeId,
        routeName: order.routeName || addressRoute.routeName || mappedRoute.routeName || "Unassigned",
        zoneId: order.zoneId || addressRoute.zoneId || mappedRoute.zoneId,
        hubId: order.hubId || addressRoute.hubId || mappedRoute.hubId,
        shift: order.computedShift,
        source: isSubscriptionOrder(order) ? "Subscription" : "One-time",
        status: order.status || "pending",
        items,
      };
    });

    const expectedByCustomerShift = new Map<string, DeliveryRow>();

    subscriptions.forEach((sub) => {
      if (!doesSubscriptionRunOnDate(sub, targetDate)) return;

      const shift = normalizeShift(sub.deliveryShift || sub.shift) || "Morning";
      const existingKey = `${sub.customerId}_${shift}`;
      const addressRoute = sub.deliveryAddress || {};
      const addressKey = sub.addressId || addressRoute.addressId || "default";
      const groupedKey = `${existingKey}_${addressKey}`;
      if (actualSubscriptionKeys.has(groupedKey)) return;

      const qty = subscriptionQtyForDate(sub, targetDate);
      if (qty <= 0) return;

      const mappedRoute = customerRoutes[sub.customerId] || {};
      const current = expectedByCustomerShift.get(groupedKey);
      const item: DeliveryItem = {
        productId: sub.productId,
        name: sub.productName || "Subscription Item",
        unit: sub.unit || "unit",
        price: Number(sub.price || 0),
        qty: Number(qty || 1),
      };

      if (current) {
        current.items.push(item);
      } else {
        expectedByCustomerShift.set(groupedKey, {
          id: `expected_${groupedKey}`,
          customerId: sub.customerId,
          customerName: sub.customerName || "Customer",
          address: formatAddress(sub.deliveryAddress),
          routeId: sub.routeId || addressRoute.routeId || mappedRoute.routeId,
          routeName: sub.routeName || addressRoute.routeName || mappedRoute.routeName || "Unassigned",
          zoneId: sub.zoneId || addressRoute.zoneId || mappedRoute.zoneId,
          hubId: sub.hubId || addressRoute.hubId || mappedRoute.hubId,
          shift,
          source: "Subscription",
          status: "pending",
          items: [item],
          isExpectedOnly: true,
        });
      }
    });

    return [...rows, ...Array.from(expectedByCustomerShift.values())].sort((a, b) => {
      const routeCompare = a.routeName.localeCompare(b.routeName);
      if (routeCompare !== 0) return routeCompare;
      if (a.shift !== b.shift) return a.shift === "Morning" ? -1 : 1;
      return a.customerName.localeCompare(b.customerName);
    });
  }, [customerRoutes, orders, selectedDateStr, subscriptions]);

  const routeOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = routes.map((route) => ({ key: route.id, label: route.name }));
    routes.forEach((route) => seen.add(route.id));

    deliveryRows.forEach((row) => {
      const key = row.routeId || row.routeName;
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({ key, label: row.routeName || "Unassigned" });
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [deliveryRows, routes]);

  const rowsBeforeStatusFilter = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return deliveryRows.filter((row) => {
      const matchesShift = selectedShift === "All" || row.shift === selectedShift;
      const routeKey = row.routeId || row.routeName;
      const matchesRoute = selectedRoute === "All" || routeKey === selectedRoute || row.routeName === selectedRoute;
      const matchesSearch =
        !search ||
        row.customerName.toLowerCase().includes(search) ||
        row.address.toLowerCase().includes(search) ||
        row.items.some((item) => item.name.toLowerCase().includes(search));
      return matchesShift && matchesRoute && matchesSearch;
    });
  }, [deliveryRows, searchTerm, selectedRoute, selectedShift]);

  const filteredRows = useMemo(() => {
    return rowsBeforeStatusFilter.filter((row) => {
      if (selectedStatus === "All") return true;
      return normalizeOrderStatus(row.status) === selectedStatus;
    });
  }, [rowsBeforeStatusFilter, selectedStatus]);

  const productSummary = useMemo(() => {
    const totals = new Map<string, { name: string; unit: string; qty: number }>();
    filteredRows.forEach((row) => {
      row.items.forEach((item) => {
        const key = `${item.name}_${item.unit}`;
        const current = totals.get(key) || { name: item.name, unit: item.unit, qty: 0 };
        current.qty += Number(item.qty || 0);
        totals.set(key, current);
      });
    });
    return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredRows]);

  const statusSummary = useMemo(() => {
    const summary = {
      pending: { label: "Pending Delivery", deliveries: 0, quantity: 0 },
      delivered: { label: "Delivered", deliveries: 0, quantity: 0 },
      cancelled: { label: "Cancelled", deliveries: 0, quantity: 0 },
    };

    rowsBeforeStatusFilter.forEach((row) => {
      const status = normalizeOrderStatus(row.status);
      if (status === "other") return;
      summary[status].deliveries += 1;
      summary[status].quantity += itemQuantity(row.items);
    });

    return summary;
  }, [rowsBeforeStatusFilter]);

  const totalQuantity = filteredRows.reduce((sum, row) => sum + itemQuantity(row.items), 0);
  const loading = loadingBase || loadingOrders;

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontWeight: 600 }}>Loading delivery overview...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: "#111827" }}>Delivery Overview</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>Manifest, route list, and delivery status for the selected slot.</p>
          </div>
          <button onClick={() => window.print()} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Print
          </button>
        </div>

        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, borderBottom: "1px solid #e5e7eb" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Delivery Date
            <input type="date" value={selectedDateStr} onChange={(event) => setSelectedDateStr(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Shift
            <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value as any)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" }}>
              {SHIFT_OPTIONS.map((shift) => <option key={shift} value={shift}>{shift === "All" ? "All Shifts" : shift}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Route
            <select value={selectedRoute} onChange={(event) => setSelectedRoute(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" }}>
              <option value="All">All Routes</option>
              {routeOptions.map((route) => <option key={route.key} value={route.key}>{route.label}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Status
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as any)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" }}>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status === "All" ? "All Status" : statusLabel(status)}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Search
            <input type="search" placeholder="Name / address / product" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
          </label>
        </div>

        <div style={{ padding: "22px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#111827" }}>
            Overview: {parseLocalDate(selectedDateStr)?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) || selectedDateStr}
            {selectedShift !== "All" ? ` (${selectedShift})` : " (All)"}
          </h2>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            {filteredRows.length} deliveries - {formatQty(totalQuantity)} total quantity
          </p>
        </div>

        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#f1f5f9", fontWeight: 800 }}>Product Summary</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#374151", color: "#fff" }}><th style={{ padding: 10, textAlign: "left", width: 45 }}>#</th><th style={{ padding: 10, textAlign: "left" }}>Name</th><th style={{ padding: 10, textAlign: "left" }}>Quantity</th></tr></thead>
              <tbody>
                {productSummary.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: 18, textAlign: "center", color: "#94a3b8" }}>No products for this filter.</td></tr>
                ) : productSummary.map((item, index) => (
                  <tr key={`${item.name}_${item.unit}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10 }}>{index + 1}</td>
                    <td style={{ padding: 10, fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: 10 }}>{formatQty(item.qty)} {item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#f1f5f9", fontWeight: 800 }}>Status Summary</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#374151", color: "#fff" }}><th style={{ padding: 10, textAlign: "left" }}>Status</th><th style={{ padding: 10, textAlign: "left" }}>Deliveries</th><th style={{ padding: 10, textAlign: "left" }}>Quantity</th></tr></thead>
              <tbody>
                {Object.entries(statusSummary).map(([key, item]) => (
                  <tr key={key} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10, fontWeight: key === "pending" ? 700 : 500 }}>{item.label}</td>
                    <td style={{ padding: 10 }}>{item.deliveries}</td>
                    <td style={{ padding: 10 }}>{formatQty(item.quantity)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: 10, fontWeight: 800 }}>Total</td>
                  <td style={{ padding: 10, fontWeight: 800 }}>{rowsBeforeStatusFilter.length}</td>
                  <td style={{ padding: 10, fontWeight: 800 }}>{formatQty(rowsBeforeStatusFilter.reduce((sum, row) => sum + itemQuantity(row.items), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ margin: "0 20px 20px", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", background: "#f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800 }}>
            <span>Deliveries</span>
            <span>{filteredRows.length} rows</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#374151", color: "#fff" }}>
                  <th style={{ padding: 12, textAlign: "left" }}>Name</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Address</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Route</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Shift</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Type</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Products</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Qty.</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>No deliveries found for this filter.</td></tr>
                ) : filteredRows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #e5e7eb", background: row.source === "Subscription" ? "#f0fdf4" : "#fffbeb" }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{row.customerName}</td>
                    <td style={{ padding: 12, color: "#334155", maxWidth: 280 }}>{row.address}</td>
                    <td style={{ padding: 12 }}>{row.routeName}</td>
                    <td style={{ padding: 12 }}>{row.shift}</td>
                    <td style={{ padding: 12 }}>{row.source}{row.isExpectedOnly ? " expected" : ""}</td>
                    <td style={{ padding: 12, fontWeight: 700 }}>{row.items.map((item) => item.name).join(", ")}</td>
                    <td style={{ padding: 12 }}>{formatQty(itemQuantity(row.items))}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ ...statusColor(row.status), padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{statusLabel(row.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          button, input, select { display: none !important; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  );
}
