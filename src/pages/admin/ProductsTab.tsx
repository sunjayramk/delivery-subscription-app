import { useState } from "react";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  isActive: boolean;
  categoryId?: string;
}

interface ProductsTabProps {
  cardStyle: React.CSSProperties;
  products: any[];
  categories: Category[];
  loadingProducts: boolean;
  productsError: string;
  newName: string;
  newUnit: string;
  newPrice: string;
  newCategory: string;
  savingProduct: boolean;
  setNewName: (v: string) => void;
  setNewUnit: (v: string) => void;
  setNewPrice: (v: string) => void;
  setNewCategory: (v: string) => void;
  handleCreateProduct: (e: React.FormEvent) => void;
  handleCreateCategory: (name: string) => void;
  handleUpdateProduct: (id: string, updates: Partial<Product>) => void;
  handleToggleProductActive: (id: string, isActive: boolean) => void;
}

const inputStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 14,
};

export default function ProductsTab({
  cardStyle,
  products,
  categories,
  loadingProducts,
  productsError,
  newName,
  newUnit,
  newPrice,
  newCategory,
  savingProduct,
  setNewName,
  setNewUnit,
  setNewPrice,
  setNewCategory,
  handleCreateProduct,
  handleCreateCategory,
  handleUpdateProduct,
  handleToggleProductActive,
}: ProductsTabProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");

  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    handleCreateCategory(newCategoryName.trim());
    setNewCategoryName("");
    setShowCategoryForm(false);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditUnit(p.unit);
    setEditPrice(String(p.price));
    setEditCategory(p.categoryId || "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(id: string) {
    const priceNum = Number(editPrice);
    if (!editName.trim() || !editUnit.trim() || isNaN(priceNum)) return;
    handleUpdateProduct(id, {
      name: editName.trim(),
      unit: editUnit.trim(),
      price: priceNum,
      categoryId: editCategory,
    });
    setEditingId(null);
  }

  return (
    <section style={cardStyle}>

      {/* Categories Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>📂 Categories</h3>
          <button
            onClick={() => setShowCategoryForm(!showCategoryForm)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {showCategoryForm ? "Cancel" : "+ Add Category"}
          </button>
        </div>

        {showCategoryForm && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="e.g. Milk, Vegetables, Bread"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            />
            <button
              onClick={handleAddCategory}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Add
            </button>
          </div>
        )}

        {categories.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666" }}>No categories yet.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map((c) => (
              <span
                key={c.id}
                style={{
                  padding: "4px 12px",
                  borderRadius: 16,
                  background: "#f3f4f6",
                  fontSize: 13,
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                }}
              >
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Products Section */}
      <h3 style={{ margin: "0 0 12px 0" }}>📦 Products</h3>

      <form
        onSubmit={handleCreateProduct}
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Name</label>
          <input style={inputStyle} placeholder="e.g. Full Cream Milk" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Unit</label>
          <input style={inputStyle} placeholder="e.g. 500ml" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Price (₹)</label>
          <input style={inputStyle} placeholder="e.g. 30" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Category</label>
          <select style={inputStyle} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            <option value="">— No Category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={savingProduct}
          style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 500, height: 38 }}
        >
          {savingProduct ? "Saving..." : "Add"}
        </button>
      </form>

      {productsError && <p style={{ color: "red" }}>{productsError}</p>}

      {loadingProducts ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No products added yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: p.isActive ? "#fff" : "#f9fafb",
                opacity: p.isActive ? 1 : 0.7,
              }}
            >
              {editingId === p.id ? (
                /* Edit Mode */
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
                    <label style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Name</label>
                    <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <label style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Unit</label>
                    <input style={inputStyle} value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <label style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Price (₹)</label>
                    <input style={inputStyle} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
                    <label style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Category</label>
                    <select style={inputStyle} value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                      <option value="">— No Category —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => saveEdit(p.id)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13 }}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 13, color: "#666" }}>{p.unit}</span>
                    <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500 }}>₹{p.price}</span>
                    {p.categoryId && (
                      <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "#f3f4f6", color: "#374151" }}>
                        {categories.find((c) => c.id === p.categoryId)?.name || ""}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 12,
                      background: p.isActive ? "#dcfce7" : "#fee2e2",
                      color: p.isActive ? "#16a34a" : "#dc2626",
                    }}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => startEdit(p)}
                      style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleToggleProductActive(p.id, p.isActive)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: p.isActive ? "#fee2e2" : "#dcfce7",
                        color: p.isActive ? "#dc2626" : "#16a34a",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      {p.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}