interface OrdersTabProps {
  cardStyle: React.CSSProperties;
  orders: any[];
  loadingOrders: boolean;
  ordersError: string;
  formatCustomerLabel: (id: string) => string;
}

export default function OrdersTab({
  cardStyle,
  orders,
  loadingOrders,
  ordersError,
  formatCustomerLabel,
}: OrdersTabProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Recent Orders</h2>

      {ordersError && (
        <p style={{ color: "red" }}>{ordersError}</p>
      )}

      {loadingOrders ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <table style={{ width: "100%", marginTop: 12 }}>
          <thead>
            <tr>
              <th align="left">Order ID</th>
              <th align="left">Customer</th>
              <th align="left">Items</th>
              <th align="left">Status</th>
              <th align="left">Source</th>
              <th align="left">Created At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id.slice(-6)}</td>
                <td>
                  {o.customerId
                    ? formatCustomerLabel(o.customerId)
                    : "Unknown"}
                </td>
                <td>
                  {o.items.map((it: any, idx: number) => (
                    <span key={idx}>
                      {it.name} × {it.qty}
                      {idx < o.items.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </td>
                <td>{o.status}</td>
                <td>{o.source || "—"}</td>
                <td>
                  {o.createdAt
                    ? o.createdAt.toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}