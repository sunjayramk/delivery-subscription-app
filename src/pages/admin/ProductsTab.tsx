// === ProductsTab.tsx ===[code here]

interface ProductsTabProps {
  cardStyle: React.CSSProperties;
  products: any[];
  loadingProducts: boolean;
  productsError: string;
  newName: string;
  newUnit: string;
  newPrice: string;
  savingProduct: boolean;
  setNewName: (v: string) => void;
  setNewUnit: (v: string) => void;
  setNewPrice: (v: string) => void;
  handleCreateProduct: (e: React.FormEvent) => void;
}

export default function ProductsTab({
  cardStyle,
  products,
  loadingProducts,
  productsError,
  newName,
  newUnit,
  newPrice,
  savingProduct,
  setNewName,
  setNewUnit,
  setNewPrice,
  handleCreateProduct,
}: ProductsTabProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Products</h2>

      <form
  onSubmit={handleCreateProduct}
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-end",
    marginTop: 12,
    marginBottom: 16,
  }}
>
  <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
    <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>
      Name
    </label>
    <input
      style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
      placeholder="e.g. Full Cream Milk"
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
    />
  </div>

  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
    <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>
      Unit
    </label>
    <input
      style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
      placeholder="e.g. 500ml"
      value={newUnit}
      onChange={(e) => setNewUnit(e.target.value)}
    />
  </div>

  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
    <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>
      Price (₹)
    </label>
    <input
      style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
      placeholder="e.g. 30"
      value={newPrice}
      onChange={(e) => setNewPrice(e.target.value)}
    />
  </div>

  <button
    type="submit"
    disabled={savingProduct}
    style={{
      padding: "8px 20px",
      borderRadius: 8,
      border: "none",
      background: "#111827",
      color: "#fff",
      cursor: "pointer",
      fontWeight: 500,
      height: 38,
    }}
  >
    {savingProduct ? "Saving..." : "Add"}
  </button>
</form>

      {productsError && (
        <p style={{ color: "red" }}>{productsError}</p>
      )}

      {loadingProducts ? (
        <p>Loading products...</p>
      ) : (
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Unit</th>
              <th align="left">Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.unit}</td>
                <td>{p.price}</td>
                <td>{p.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}