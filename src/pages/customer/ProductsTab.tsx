// === ProductsTab.tsx ===[code here]

interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  categoryId?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Props {
  products: Product[];
  categories: Category[];
  loadingProducts: boolean;
  errorProducts: string;
  placingOrderId: string | null;
  handleOrderOnce: (product: Product) => void;
  startSubscription: (product: Product) => void;
}

export default function ProductsTab({
  products,
  categories,
  loadingProducts,
  errorProducts,
  placingOrderId,
  handleOrderOnce,
  startSubscription,
}: Props) {
  return (
    <section style={{ marginTop: 16, padding: "0 8px" }}>
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>Products from your store</h2>

      {loadingProducts ? (
        <p>Loading products...</p>
      ) : errorProducts ? (
        <p style={{ color: "red" }}>{errorProducts}</p>
      ) : products.length === 0 ? (
        <p>No products available yet.</p>
       ) : (
        <>
          {/* Group products by category */}
          {(() => {
            const uncategorized = products.filter((p) => !p.categoryId);
            const grouped = categories.map((cat) => ({
              category: cat as Category,
              products: products.filter((p) => p.categoryId === cat.id) as Product[],
            })).filter((g) => g.products.length > 0);

            const renderProductCard = (p: Product) => (
              <div
                key={p.id}
                style={{
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  padding: 18,
                  background: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 15 }}>{p.name}</h3>
                  <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 12 }}>{p.unit}</p>
                  <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 18, color: "#111827" }}>₹{p.price}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleOrderOnce(p)}
                    disabled={placingOrderId === p.id}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      cursor: placingOrderId === p.id ? "not-allowed" : "pointer",
                      fontSize: 13,
                      color: "#374151",
                      fontWeight: 500,
                    }}
                  >
                    {placingOrderId === p.id ? "Placing..." : "Order once"}
                  </button>
                  <button
                    onClick={() => startSubscription(p)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: "none",
                      background: "#111827",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    Subscribe
                  </button>
                </div>
              </div>
            );

            return (
              <>
                {grouped.map(({ category, products: catProducts }) => (
                  <div key={category.id} style={{ marginBottom: 32 }}>
                    <div style={{
                      display: "inline-block",
                      marginBottom: 12,
                      padding: "4px 14px",
                      borderRadius: 20,
                      background: "#111827",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                    }}>
                      {category.name}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                      {catProducts.map(renderProductCard)}
                    </div>
                  </div>
                ))}

                {uncategorized.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    {grouped.length > 0 && (
                      <div style={{
                        display: "inline-block",
                        marginBottom: 12,
                        padding: "4px 14px",
                        borderRadius: 20,
                        background: "#6b7280",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                      }}>
                        Other
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                      {uncategorized.map(renderProductCard)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </section>
  );
}