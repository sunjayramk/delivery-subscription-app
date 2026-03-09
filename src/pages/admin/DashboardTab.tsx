import { useState } from "react";

interface DashboardTabProps {
  cardStyle: React.CSSProperties;
  totalOrdersToday: number;
  subscriptionOrders: number;
  oneTimeOrders: number;
  pendingCount: number;
  deliveredCount: number;
  notDeliveredCount: number;
  productSummaryList: any[];
  routePackingList: any[];
  today: Date;
  handleGenerateOrdersFromSubscriptions: () => void;
}

function SummaryCard({ label, value }: { label: string; value: any }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function DashboardTab({
  cardStyle,
  totalOrdersToday,
  subscriptionOrders,
  oneTimeOrders,
  pendingCount,
  deliveredCount,
  notDeliveredCount,
  productSummaryList,
  routePackingList,
  today,
  handleGenerateOrdersFromSubscriptions,
}: DashboardTabProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirm() {
    setShowConfirm(false);
    handleGenerateOrdersFromSubscriptions();
  }

  return (
    <section style={cardStyle}>

      {/* Generate Orders Button + Inline Confirmation */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            marginBottom: 16,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#111827",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          📅 Generate Today's Orders from Subscriptions
        </button>
      ) : (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fffbeb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>⚠️ Generate Today's Orders?</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
              This will create orders for all active subscriptions for today.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleConfirm}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "#111827",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              Yes, Generate
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 0 }}>Today's Summary</h2>

      <p style={{ fontSize: 13, color: "#666" }}>
        {today.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </p>

      {totalOrdersToday === 0 ? (
        <p>No orders created today yet.</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <SummaryCard label="Total Orders" value={totalOrdersToday} />
            <SummaryCard label="From Subscriptions" value={subscriptionOrders} />
            <SummaryCard label="One-time Orders" value={oneTimeOrders} />
            <SummaryCard
              label="Pending / Delivered / Not Delivered"
              value={`${pendingCount} / ${deliveredCount} / ${notDeliveredCount}`}
            />
          </div>

          <h3 style={{ marginTop: 24 }}>🥛 Today's Production Requirement</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            {productSummaryList?.map((p) => (
              <div
                key={`prod_${p.productId || p.name}`}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 22, marginTop: 6 }}>
                  {p.totalQty} {p.unit}
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 24 }}>Product-wise Plan</h3>
          {productSummaryList.length === 0 ? (
            <p>No products in today's orders.</p>
          ) : (
            <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: 8 }}>Product</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Unit</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Total Qty</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Subs</th>
                  <th style={{ textAlign: "right", padding: 8 }}>One-time</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Revenue (₹)</th>
                </tr>
              </thead>
              <tbody>
                {productSummaryList.map((p) => (
                  <tr key={p.productId || p.name} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 8 }}>{p.name}</td>
                    <td style={{ padding: 8 }}>{p.unit}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{p.totalQty}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{p.subscriptionQty}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{p.oneTimeQty}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>₹{p.totalRevenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Packing List by Route */}
          <h3 style={{ marginTop: 24 }}>📦 Packing List by Route</h3>
          {!routePackingList || routePackingList.length === 0 ? (
            <p>No packing data available.</p>
          ) : (
            routePackingList.map((route: any) => (
              <div
                key={route.route}
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                }}
              >
                <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>🗺 {route.route}</h4>
                {route.products.map((p: any) => (
                  <div
                    key={p.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 0",
                      fontSize: 13,
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 500 }}>{p.qty} {p.unit}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      )}
    </section>
  );
}