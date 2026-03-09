// === OrdersTab.tsx === [code here]

import { useState } from "react";

interface DeliveryAddress {
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  mapUrl?: string;
}

interface OrderItem {
  name: string;
  unit: string;
  price: number;
  qty: number;
}

interface Order {
  id: string;
  createdAt?: Date;
  status: string;
  items: OrderItem[];
  deliveryAddress?: DeliveryAddress;
}

interface Props {
  loadingOrders: boolean;
  errorOrders: string;
  orders: Order[];
  formatAddress: (addr?: DeliveryAddress) => string;
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

function getStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered": return "✅ Delivered";
    case "pending": return "⏳ Pending";
    case "not_delivered": return "❌ Not Delivered";
    default: return status;
  }
}

function getOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

export default function OrdersTab({
  loadingOrders,
  errorOrders,
  orders,
  formatAddress,
}: Props) {
  // Sort orders newest first
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Sort orders newest first then filter by date range
  const sortedOrders = [...orders]
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .filter((o) => {
      if (!o.createdAt) return true;
      const dateStr = o.createdAt.toLocaleDateString('en-CA');
      if (filterFrom && dateStr < filterFrom) return false;
      if (filterTo && dateStr > filterTo) return false;
      return true;
    });

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>My Recent Orders</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>To</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 13,
              }}
            />
          </div>
          {(filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterFrom(""); setFilterTo(""); }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                cursor: "pointer",
                fontSize: 13,
                marginTop: 16,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loadingOrders ? (
        <p>Loading orders...</p>
      ) : errorOrders ? (
        <p style={{ color: "red" }}>{errorOrders}</p>
      ) : sortedOrders.length === 0 ? (
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            border: "1px dashed #d1d5db",
            textAlign: "center",
            color: "#666",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛍️</div>
          <p style={{ margin: 0 }}>
            {filterFrom || filterTo ? "No orders found for selected dates." : "No orders yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedOrders.map((o) => {
            const total = getOrderTotal(o.items);
            return (
              <div
                key={o.id}
                style={{
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    Order #{o.id.slice(-6).toUpperCase()}
                  </div>
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
                </div>

                {/* Items */}
                <div
                  style={{
                    borderTop: "1px solid #f3f4f6",
                    borderBottom: "1px solid #f3f4f6",
                    padding: "8px 0",
                    marginBottom: 8,
                  }}
                >
                  {o.items.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        padding: "2px 0",
                      }}
                    >
                      <span>
                        {it.name} ({it.unit}) × {it.qty}
                      </span>
                      <span style={{ fontWeight: 500 }}>
                        ₹{(it.price * it.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>

                {/* Address */}
                <div style={{ fontSize: 12, color: "#666" }}>
                  📍 {formatAddress(o.deliveryAddress)}
                </div>

                {/* Date */}
                {o.createdAt && (
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                    {o.createdAt.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}