import { useMemo, useState } from "react";
import { getLocalDateString, parseLocalDate } from "../../services/deliverySlots";
import { normalizeOrderStatus, readOrderDeliveryDate, readOrderShift } from "../../services/deliveryOrders";
import { getRouteLabel } from "../../services/addressRoutes";

interface OrderItem {
  name: string;
  unit: string;
  price: number;
  qty: number;
}

interface OrdersTabProps {
  cardStyle: React.CSSProperties;
  orders: any[];
  loadingOrders: boolean;
  ordersError: string;
  formatCustomerLabel: (id: string) => string;
  handleUpdateOrderStatus: (orderId: string, status: string, cancellationReason?: string) => void | Promise<void>;
}

type OrderTab = "all" | "one-time" | "subscription";

const STATUS_OPTIONS = ["All", "pending", "delivered", "cancelled"] as const;

function ensureDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue.toDate === "function") return dateValue.toDate();
  if (dateValue.seconds) return new Date(dateValue.seconds * 1000);
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, it) => sum + (it.price ?? 0) * (it.qty ?? 1), 0);
}

function getOrderKind(order: any): OrderTab {
  return order.source === "subscription" || order.type === "subscription" ? "subscription" : "one-time";
}

function getStatusLabel(status: string) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "pending") return "Pending";
  return status || "Pending";
}

function getStatusStyle(status: string): React.CSSProperties {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return { background: "#dcfce7", color: "#15803d" };
  if (normalized === "cancelled") return { background: "#fee2e2", color: "#b91c1c" };
  if (normalized === "pending") return { background: "#fef3c7", color: "#92400e" };
  return { background: "#f3f4f6", color: "#374151" };
}

function formatPlacedOn(value: any) {
  const date = ensureDate(value);
  if (!date) return "-";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDeliveryDate(dateStr: string) {
  const date = parseLocalDate(dateStr);
  if (!date) return "-";

  const today = getLocalDateString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function itemSummary(items: OrderItem[]) {
  if (!items.length) return "-";
  if (items.length === 1) {
    const item = items[0];
    return `${item.name} (${item.unit || "unit"}) x ${item.qty || 1}`;
  }
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  return `${items.length} products, ${totalQty} items`;
}

function readOrderRouteLabel(order: any) {
  return getRouteLabel({
    routeStatus: order.routeStatus || order.deliveryAddress?.routeStatus,
    routeName: order.routeName || order.deliveryAddress?.routeName,
  });
}

function readCustomerDisplayName(order: any, fallbackLabel: string) {
  const rawName = String(order.customerName || "").trim();
  if (!rawName || rawName === order.customerId || rawName.length > 28) return fallbackLabel || "Unknown";
  return rawName;
}

export default function OrdersTab({
  cardStyle,
  orders,
  loadingOrders,
  ordersError,
  formatCustomerLabel,
  handleUpdateOrderStatus,
}: OrdersTabProps) {
  const [activeOrderTab, setActiveOrderTab] = useState<OrderTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [placedFrom, setPlacedFrom] = useState("");
  const [placedTo, setPlacedTo] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.all += 1;
        acc[getOrderKind(order)] += 1;
        return acc;
      },
      { all: 0, "one-time": 0, subscription: 0 } as Record<OrderTab, number>
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return [...orders]
      .filter((order) => activeOrderTab === "all" || getOrderKind(order) === activeOrderTab)
      .filter((order) => {
        const deliveryDate = readOrderDeliveryDate(order);
        const placedDate = ensureDate(order.createdAt);
        const placedDateStr = placedDate ? getLocalDateString(placedDate) : "";
        const status = normalizeOrderStatus(order.status);
        const customerLabel = order.customerId ? formatCustomerLabel(order.customerId) : "";
        const productNames = (order.items || []).map((item: OrderItem) => item.name).join(" ");
        const routeLabel = readOrderRouteLabel(order);
        const searchable = [
          order.id,
          order.customerId,
          customerLabel,
          order.customerName,
          routeLabel,
          productNames,
        ].filter(Boolean).join(" ").toLowerCase();

        if (search && !searchable.includes(search)) return false;
        if (statusFilter !== "All" && status !== statusFilter) return false;
        if (deliveryFrom && deliveryDate < deliveryFrom) return false;
        if (deliveryTo && deliveryDate > deliveryTo) return false;
        if (placedFrom && placedDateStr < placedFrom) return false;
        if (placedTo && placedDateStr > placedTo) return false;
        return true;
      })
      .sort((a, b) => {
        const deliveryCompare = readOrderDeliveryDate(b).localeCompare(readOrderDeliveryDate(a));
        if (deliveryCompare !== 0) return deliveryCompare;
        const placedA = ensureDate(a.createdAt)?.getTime() ?? 0;
        const placedB = ensureDate(b.createdAt)?.getTime() ?? 0;
        return placedB - placedA;
      });
  }, [activeOrderTab, deliveryFrom, deliveryTo, formatCustomerLabel, orders, placedFrom, placedTo, searchTerm, statusFilter]);

  async function onStatusChange(orderId: string, newStatus: string) {
    let cancellationReason = "";
    if (normalizeOrderStatus(newStatus) === "cancelled") {
      const reason = window.prompt("Reason for cancellation");
      if (!reason?.trim()) return;
      cancellationReason = reason.trim();
    }
    setUpdatingId(orderId);
    await handleUpdateOrderStatus(orderId, newStatus, cancellationReason);
    setUpdatingId(null);
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("All");
    setDeliveryFrom("");
    setDeliveryTo("");
    setPlacedFrom("");
    setPlacedTo("");
  }

  return (
    <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "20px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: "#111827" }}>Orders</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Review placed orders by delivery date, route, and status.</p>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 700, cursor: "pointer" }}
        >
          Clear Filters
        </button>
      </div>

      <div style={{ padding: "14px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "All Orders", count: counts.all },
          { key: "one-time", label: "One-Time Orders", count: counts["one-time"] },
          { key: "subscription", label: "Subscription Orders", count: counts.subscription },
        ].map((tab) => {
          const isActive = activeOrderTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveOrderTab(tab.key as OrderTab)}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: isActive ? "1px solid #111827" : "1px solid #d1d5db",
                background: isActive ? "#111827" : "#fff",
                color: isActive ? "#fff" : "#374151",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      <div style={{ padding: "14px 22px", borderBottom: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "minmax(190px, 1.4fr) repeat(5, minmax(135px, 1fr))", gap: 10 }}>
        <label style={filterLabelStyle}>
          Search
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="ID / name / product / route" style={filterInputStyle} />
        </label>
        <label style={filterLabelStyle}>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as any)} style={filterInputStyle}>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status === "All" ? "All Status" : getStatusLabel(status)}</option>)}
          </select>
        </label>
        <label style={filterLabelStyle}>
          Delivery From
          <input type="date" value={deliveryFrom} onChange={(event) => setDeliveryFrom(event.target.value)} style={filterInputStyle} />
        </label>
        <label style={filterLabelStyle}>
          Delivery To
          <input type="date" value={deliveryTo} onChange={(event) => setDeliveryTo(event.target.value)} style={filterInputStyle} />
        </label>
        <label style={filterLabelStyle}>
          Placed From
          <input type="date" value={placedFrom} onChange={(event) => setPlacedFrom(event.target.value)} style={filterInputStyle} />
        </label>
        <label style={filterLabelStyle}>
          Placed To
          <input type="date" value={placedTo} onChange={(event) => setPlacedTo(event.target.value)} style={filterInputStyle} />
        </label>
      </div>

      {ordersError && <p style={{ color: "#dc2626", margin: 22 }}>{ordersError}</p>}

      {loadingOrders ? (
        <div style={{ padding: 32, color: "#6b7280", fontWeight: 700 }}>Loading orders...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080, fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#374151", color: "#fff" }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Delivery On</th>
                <th style={thStyle}>Shift</th>
                <th style={thStyle}>Route</th>
                <th style={thStyle}>Items</th>
                <th style={thStyle}>Placed On</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 34, textAlign: "center", color: "#6b7280", fontWeight: 700 }}>
                    No orders found.
                  </td>
                </tr>
              ) : filteredOrders.map((order, index) => {
                const items = order.items || [];
                const total = order.totalAmount ?? getOrderTotal(items);
                const deliveryDate = readOrderDeliveryDate(order);
                const shift = readOrderShift(order);
                const routeLabel = readOrderRouteLabel(order);
                const customerLabel = order.customerId ? formatCustomerLabel(order.customerId) : "Unknown";
                const customerName = readCustomerDisplayName(order, customerLabel);
                const rowBg = index % 2 === 0 ? "#fff" : "#f8fafc";

                return (
                  <tr key={order.id} style={{ background: rowBg, borderBottom: "1px solid #e5e7eb" }}>
                    <td style={tdStyle}>
                      <span style={{ color: "#0369a1", fontWeight: 800 }}>#{order.id.slice(-6).toUpperCase()}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: "#111827" }}>{customerName}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{order.customerId || "-"}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ ...getStatusStyle(order.status), padding: "4px 10px", borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.cancellationReason && (
                        <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 5, fontWeight: 600 }}>{order.cancellationReason}</div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>Rs.{Number(total || 0).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 800 }}>{formatDeliveryDate(deliveryDate)}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{deliveryDate || "-"}</div>
                    </td>
                    <td style={tdStyle}>{shift}</td>
                    <td style={tdStyle}>{routeLabel}</td>
                    <td style={tdStyle}>{itemSummary(items)}</td>
                    <td style={tdStyle}>{formatPlacedOn(order.createdAt)}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <select
                        value={normalizeOrderStatus(order.status) === "cancelled" ? "not_delivered" : order.status || "pending"}
                        disabled={updatingId === order.id}
                        onChange={(event) => onStatusChange(order.id, event.target.value)}
                        style={{ padding: "7px 8px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, cursor: "pointer" }}
                      >
                        <option value="pending">Pending</option>
                        <option value="delivered">Delivered</option>
                        <option value="not_delivered">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
};

const filterInputStyle: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  padding: "13px 14px",
  textAlign: "left",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px",
  color: "#0f172a",
  verticalAlign: "top",
  borderRight: "1px solid #e5e7eb",
};
