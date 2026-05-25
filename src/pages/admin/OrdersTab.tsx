//Admin - OrdersTab.tsx

import { useState } from "react";

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
  handleUpdateOrderStatus: (orderId: string, status: string) => void;
}

// HELPER: Safely converts Firestore Timestamps or Strings into JS Dates
function ensureDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue.toDate === "function") return dateValue.toDate();
  if (dateValue.seconds) return new Date(dateValue.seconds * 1000);
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getStatusStyle(status: string): React.CSSProperties {
  switch (status.toLowerCase()) {
    case "delivered":
      return { background: "#dcfce7", color: "#16a34a" };
    case "pending":
      return { background: "#fef9c3", color: "#ca8a04" };
    case "not_delivered":
      return { background: "#fee2e2", color: "#dc2626" };
    default:
      return { background: "#f3f4f6", color: "#374151" };
  }
}

function getOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, it) => sum + (it.price ?? 0) * (it.qty ?? 1), 0);
}

function getStatusLabel(status: string) {
  if (status === "not_delivered") return "cancelled";
  return status;
}

export default function OrdersTab({
  cardStyle,
  orders,
  loadingOrders,
  ordersError,
  formatCustomerLabel,
  handleUpdateOrderStatus,
}: OrdersTabProps) {
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // FIXED: Safely sort and filter orders using the helper
  const sortedOrders = [...orders]
    .sort((a, b) => {
      const dateA = ensureDate(a.createdAt)?.getTime() ?? 0;
      const dateB = ensureDate(b.createdAt)?.getTime() ?? 0;
      return dateB - dateA;
    })
    .filter((o) => {
      const orderDate = ensureDate(o.createdAt);
      if (!orderDate) return true;
      
      const dateStr = orderDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
      if (filterFrom && dateStr < filterFrom) return false;
      if (filterTo && dateStr > filterTo) return false;
      return true;
    });

  async function onStatusChange(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    await handleUpdateOrderStatus(orderId, newStatus);
    setUpdatingId(null);
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Invoice Orders</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>To</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
            />
          </div>
          {(filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterFrom(""); setFilterTo(""); }}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13, alignSelf: "flex-end" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {ordersError && <p style={{ color: "red" }}>{ordersError}</p>}

      {loadingOrders ? (
        <p>Loading orders...</p>
      ) : sortedOrders.length === 0 ? (
        <p style={{ color: "#666" }}>
          {filterFrom || filterTo ? "No orders found for selected dates." : "No orders yet."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedOrders.map((o) => {
            const total = getOrderTotal(o.items || []);
            const displayDate = ensureDate(o.createdAt);
            
            return (
              <div
                key={o.id}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      #{o.id.slice(-6).toUpperCase()}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>
                      {o.source === "subscription" ? "Date Subscription" : "Cart One-time"}
                    </span>
                    {o.routeName && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>
                        Map {o.routeName}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {displayDate ? displayDate.toLocaleString() : "-"}
                  </div>
                </div>

                <div style={{ fontSize: 13, marginBottom: 8, color: "#374151" }}>
                  User {o.customerId ? formatCustomerLabel(o.customerId) : "Unknown"}
                </div>

                <div style={{ borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", padding: "8px 0", marginBottom: 8 }}>
                  {(o.items || []).map((it: OrderItem, idx: number) => (
                    <div
                      key={idx}
                      style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}
                    >
                      <span>{it.name} ({it.unit}) x {it.qty}</span>
                      <span style={{ fontWeight: 500 }}>Rs.{((it.price ?? 0) * (it.qty ?? 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    Total: Rs.{total.toFixed(2)}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        ...getStatusStyle(o.status),
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {getStatusLabel(o.status)}
                    </span>
                    {o.status === "not_delivered" && o.cancellationReason && (
                      <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                        {o.cancellationReason}
                      </span>
                    )}
                    <select
                      value={o.status}
                      disabled={updatingId === o.id}
                      onChange={(e) => onStatusChange(o.id, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="delivered">Delivered</option>
                      <option value="not_delivered">Cancelled</option>
                    </select>
                    {updatingId === o.id && (
                      <span style={{ fontSize: 12, color: "#666" }}>Saving...</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
