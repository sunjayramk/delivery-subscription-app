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
  return (
    <section style={cardStyle}>
      {/* Generate Orders Button */}
      <button
        onClick={handleGenerateOrdersFromSubscriptions}
        style={{
          marginBottom: 16,
          padding: "8px 14px",
          borderRadius: 8,
          border: "none",
          background: "#111827",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Generate Today's Orders from Subscriptions
      </button>

      <h2 style={{ marginTop: 0 }}>Today’s Summary</h2>

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
            <p>No products in today’s orders.</p>
          ) : (
            <table style={{ width: "100%", marginTop: 12 }}>
              <thead>
                <tr>
                  <th align="left">Product</th>
                  <th align="left">Unit</th>
                  <th align="right">Total Qty</th>
                  <th align="right">Subs</th>
                  <th align="right">One-time</th>
                  <th align="right">Revenue (₹)</th>
                </tr>
              </thead>
    <tbody>
      {productSummaryList.map((p) => (
        <tr key={p.productId || p.name}>
          <td>{p.name}</td>
          <td>{p.unit}</td>
          <td align="right">{p.totalQty}</td>
          <td align="right">{p.subscriptionQty}</td>
          <td align="right">{p.oneTimeQty}</td>
          <td align="right">{p.totalRevenue.toFixed(2)}</td>
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
    <div key={route.route} style={{ marginTop: 12 }}>
      <h4>{route.route}</h4>

      {route.products.map((p: any) => (
        <div
          key={p.name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 0",
          }}
        >
          <span>{p.name}</span>
          <span>
            {p.qty} {p.unit}
          </span>
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
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}