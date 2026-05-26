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
  shift?: string; // ADDED: The new Morning/Evening shift!
  fulfillmentType?: string;
  parentOrderId?: string;
  parentDeliveryInstanceId?: string;
  rescheduledFromDate?: string;
  rescheduledFromShift?: string;
  rescheduleReason?: string;
  paymentStatus?: string;
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
      return { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" };
    case "pending":
      return { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }; // Updated to a premium blue
    case "not_delivered":
      return { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" };
    default:
      return { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" };
  }
}

function getStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered": return "Delivered";
    case "pending": return "Loading Order Placed";
    case "not_delivered": return "Cancelled";
    default: return status;
  }
}

function getOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

function formatRescheduledFrom(order: Order) {
  if (!order.rescheduledFromDate) return "";
  const date = new Date(order.rescheduledFromDate);
  const label = Number.isNaN(date.getTime())
    ? order.rescheduledFromDate
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${label}${order.rescheduledFromShift ? ` (${order.rescheduledFromShift})` : ""}`;
}

export default function OrdersTab({
  loadingOrders,
  errorOrders,
  orders,
  formatAddress,
}: Props) {
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

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
    <section style={{ marginTop: 24, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#111827" }}>My Orders</h2>
        
        {/* Date Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
            />
          </div>
          <span style={{color: "#9ca3af"}}>to</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
            />
          </div>
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(""); setFilterTo(""); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13 }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loadingOrders ? (
        <p style={{textAlign: "center", color: "#6b7280", marginTop: 40}}>Loading your orders...</p>
      ) : errorOrders ? (
        <p style={{ color: "red", textAlign: "center" }}>{errorOrders}</p>
      ) : sortedOrders.length === 0 ? (
        <div style={{ padding: 40, borderRadius: 16, background: "#f9fafb", textAlign: "center", color: "#6b7280", border: "1px dashed #d1d5db" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>Shopping</div>
          <p style={{ margin: 0, fontWeight: 500 }}>
            {filterFrom || filterTo ? "No orders found for these dates." : "You haven't placed any orders yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sortedOrders.map((o) => {
            const total = getOrderTotal(o.items);
            const isFollowUp = o.fulfillmentType === "follow_up";
            const rescheduledFrom = formatRescheduledFrom(o);
            return (
              <div key={o.id} style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 4 }}>
                      Order #{o.id.slice(-6).toUpperCase()}
                    </div>
                    {isFollowUp && (
                      <div style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, background: "#eef2ff", color: "#4338ca", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                        Follow-up order
                      </div>
                    )}
                    {o.createdAt && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {o.createdAt.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <span style={{ ...getStatusStyle(o.status), padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    {getStatusLabel(o.status)}
                  </span>
                </div>

                {isFollowUp && (
                  <div style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#312e81", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 12, lineHeight: 1.45 }}>
                    <div style={{ fontWeight: 800, marginBottom: 3 }}>Carried forward from a previous delivery</div>
                    <div>
                      These items were not completed earlier and have been scheduled again
                      {rescheduledFrom ? ` from ${rescheduledFrom}` : ""}.
                    </div>
                    {o.parentOrderId && (
                      <div style={{ marginTop: 5, fontWeight: 700 }}>Original order #{o.parentOrderId.slice(-6).toUpperCase()}</div>
                    )}
                    {o.rescheduleReason && (
                      <div style={{ marginTop: 5 }}>Reason: {o.rescheduleReason}</div>
                    )}
                  </div>
                )}

                {/* NEW: Shift Delivery Badge */}
                {o.shift && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f3f4f6", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
                    {o.shift === "Morning" ? "Morning" : "Evening"} 
                    {o.shift} Delivery
                  </div>
                )}

                {/* Items */}
                <div style={{ borderTop: "1px dashed #e5e7eb", borderBottom: "1px dashed #e5e7eb", padding: "12px 0", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {o.items.map((it, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4b5563" }}>
                      <span>
                        <span style={{fontWeight: 600, color: "#111827"}}>{it.qty}x</span> {it.name} ({it.unit})
                      </span>
                      <span style={{ fontWeight: 600, color: "#111827" }}>
                        Rs.{(it.price * it.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total & Address */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", maxWidth: "60%" }}>
                    <span style={{display: "block", marginBottom: 2}}>Location Delivery to:</span>
                    {formatAddress(o.deliveryAddress) || "Default Address"}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{isFollowUp ? "Carried Amount" : "Total Paid"}</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#111827" }}>Rs.{total.toFixed(2)}</div>
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
