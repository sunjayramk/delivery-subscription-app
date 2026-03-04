interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
}

interface Props {
  products: Product[];
  loadingProducts: boolean;
  errorProducts: string;

  placingOrderId: string | null;

  handleOrderOnce: (product: Product) => void;
  startSubscription: (product: Product) => void;
}

export default function ProductsTab({
  products,
  loadingProducts,
  errorProducts,
  placingOrderId,
  handleOrderOnce,
  startSubscription,
}: Props) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2>Products from your store</h2>

      {loadingProducts ? (
        <p>Loading products...</p>
      ) : errorProducts ? (
        <p style={{ color: "red" }}>{errorProducts}</p>
      ) : products.length === 0 ? (
        <p>No products available yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 12,
          }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                borderRadius: 12,
                border: "1px solid #e0e0e0",
                padding: 12,
              }}
            >
              <h3 style={{ marginTop: 0 }}>{p.name}</h3>

              <p style={{ margin: "4px 0" }}>{p.unit}</p>

              <p style={{ margin: "4px 0" }}>
                <strong>₹{p.price}</strong>
              </p>

              <button
                style={{ marginTop: 8, marginRight: 8 }}
                onClick={() => handleOrderOnce(p)}
                disabled={placingOrderId === p.id}
              >
                {placingOrderId === p.id ? "Placing..." : "Order once"}
              </button>

              <button
                style={{ marginTop: 8 }}
                onClick={() => startSubscription(p)}
              >
                Subscribe
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}