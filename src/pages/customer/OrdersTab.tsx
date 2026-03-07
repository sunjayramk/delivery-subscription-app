// === OrdersTab.tsx ===[code here]

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

export default function OrdersTab({
  loadingOrders,
  errorOrders,
  orders,
  formatAddress,
}: Props) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2>My Recent Orders</h2>

      {loadingOrders ? (
        <p>Loading orders...</p>
      ) : errorOrders ? (
        <p style={{ color: "red" }}>{errorOrders}</p>
      ) : orders.length === 0 ? (
        <p>You haven't placed any orders yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {orders.map((o) => (
            <li
              key={o.id}
              style={{
                padding: 12,
                border: "1px solid #e0e0e0",
                borderRadius: 10,
                marginBottom: 8,
              }}
            >
              <div>
                <strong>Order #{o.id.slice(-6)}</strong>
                <span style={{ marginLeft: 8 }}>
                  Status: {o.status || "pending"}
                </span>
              </div>

              <div style={{ fontSize: 14, marginTop: 4 }}>
                {o.items.map((it, idx) => (
                  <span key={idx}>
                    {it.name} × {it.qty}
                    {idx < o.items.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>

              <div style={{ fontSize: 13, marginTop: 4 }}>
                Deliver to: {formatAddress(o.deliveryAddress)}
              </div>

              {o.deliveryAddress?.mapUrl && (
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  <a
                    href={o.deliveryAddress.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps
                  </a>
                </div>
              )}

              {o.createdAt && (
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {o.createdAt.toLocaleString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}