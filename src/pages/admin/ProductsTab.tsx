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
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr auto",
          gap: 12,
          alignItems: "end",
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        <input
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <input
          placeholder="Unit"
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
        />

        <input
          placeholder="Price"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
        />

        <button type="submit" disabled={savingProduct}>
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
              <th align="left">Status</th>
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