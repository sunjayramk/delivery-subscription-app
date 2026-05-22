// Admin - ProductsTab.tsx

import { useState, useRef, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  sortOrder?: number;
}

interface Banner {
  id: string;
  imageUrl: string;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  isActive: boolean;
  categoryId?: string;
  imageUrl?: string;
  isSubscribable?: boolean; 
}

interface ProductsTabProps {
  cardStyle: React.CSSProperties;
  products: any[];
  categories: Category[];
  banners: Banner[];
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
  setNewImage: (f: File | null) => void; 
  handleCreateProduct: (e: React.FormEvent) => void;
  handleCreateCategory: (name: string, sortOrder: number) => void; 
  handleUpdateCategory: (id: string, sortOrder: number) => void;   
  handleReorderCategories: (updates: {id: string, sortOrder: number}[]) => void; // NEW DND SAVER
  handleUpdateProduct: (id: string, updates: Partial<Product>, newImageFile?: File | null) => void; 
  handleToggleProductActive: (id: string, isActive: boolean) => void;
  handleUploadBanner: (file: File) => void; 
  handleDeleteBanner: (id: string) => void; 
  uploadingBanner: boolean;
  newIsSubscribable: boolean;
  setNewIsSubscribable: (v: boolean) => void;
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
  banners,
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
  setNewImage,
  handleCreateProduct,
  handleCreateCategory,
  handleReorderCategories,
  handleUpdateProduct,
  handleToggleProductActive,
  handleUploadBanner,
  handleDeleteBanner,
  uploadingBanner,
  newIsSubscribable,
  setNewIsSubscribable,
}: ProductsTabProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editIsSubscribable, setEditIsSubscribable] = useState(false);

  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // --- DRAG AND DROP STATE ---
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Sync incoming props to our local draggable state
  useEffect(() => {
    setLocalCategories([...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
  }, [categories]);

  function handleSort() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    
    // Duplicate the array and swap the items locally
    let _local = [...localCategories];
    const draggedItemContent = _local.splice(dragItem.current, 1)[0];
    _local.splice(dragOverItem.current, 0, draggedItemContent);
    
    // Reset refs
    dragItem.current = null;
    dragOverItem.current = null;
    
    // Update local UI instantly
    setLocalCategories(_local);
    
    // Build payload to save to Firebase
    const updates = _local.map((cat, index) => ({ id: cat.id, sortOrder: index }));
    handleReorderCategories(updates);
  }
  // ---------------------------

  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    // New categories automatically go to the bottom of the list
    handleCreateCategory(newCategoryName.trim(), localCategories.length);
    setNewCategoryName("");
    setShowCategoryForm(false);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditUnit(p.unit);
    setEditPrice(String(p.price));
    setEditCategory(p.categoryId || "");
    setEditIsSubscribable(p.isSubscribable || false);
    setEditImage(null); 
  }

  function cancelEdit() {
    setEditingId(null);
    setEditImage(null);
  }

  function saveEdit(id: string) {
    const priceNum = Number(editPrice);
    if (!editName.trim() || !editUnit.trim() || isNaN(priceNum)) return;
    
    handleUpdateProduct(id, {
      name: editName.trim(),
      unit: editUnit.trim(),
      price: priceNum,
      categoryId: editCategory,
      isSubscribable: editIsSubscribable,
    }, editImage);
    
    setEditingId(null);
    setEditImage(null);
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* --- BANNERS SECTION --- */}
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 16px 0" }}>Image Storefront Banners & Ads</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Upload New Banner (Landscape recommended)</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setBannerFile(e.target.files?.[0] || null)} 
              style={{...inputStyle, background: "#fff"}} 
            />
          </div>
          <button
            disabled={!bannerFile || uploadingBanner}
            onClick={() => { if (bannerFile) { handleUploadBanner(bannerFile); setBannerFile(null); } }}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 500 }}
          >
            {uploadingBanner ? "Uploading..." : "Upload Banner"}
          </button>
        </div>

        {banners && banners.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
            {banners.map(b => (
              <div key={b.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                <img src={b.imageUrl} alt="Banner" style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
                <button 
                  onClick={() => handleDeleteBanner(b.id)}
                  style={{ position: "absolute", top: 8, right: 8, background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>No banners uploaded yet.</p>
        )}
      </div>

      {/* --- DRAG & DROP CATEGORIES SECTION --- */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Folder Category Sequence</h3>
          <button
            onClick={() => setShowCategoryForm(!showCategoryForm)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", cursor: "pointer", fontSize: 13 }}
          >
            {showCategoryForm ? "Cancel" : "+ Add Category"}
          </button>
        </div>

        {showCategoryForm && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, background: "#f9fafb", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Category Name (e.g. Daily Essentials)" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCategory()} />
            <button onClick={handleAddCategory} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13 }}>Save</button>
          </div>
        )}

        {localCategories.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>No categories yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280", padding: "0 12px" }}>
              <div style={{ width: 30 }}></div>
              <div>Drag to reorder Categories</div>
            </div>
            
            {localCategories.map((c, index) => (
              <div 
                key={c.id} 
                draggable
                onDragStart={() => (dragItem.current = index)}
                onDragEnter={() => (dragOverItem.current = index)}
                onDragEnd={handleSort}
                onDragOver={(e) => e.preventDefault()}
                style={{ 
                  display: "flex", 
                  gap: 12, 
                  alignItems: "center", 
                  padding: "10px 12px", 
                  background: "#fff", 
                  borderRadius: 8, 
                  border: "1px solid #e5e7eb",
                  cursor: "grab",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                <div style={{ cursor: "grab", color: "#9ca3af", display: "flex", alignItems: "center" }}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M2 4.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
                  </svg>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- PRODUCTS SECTION --- */}
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px 0" }}>Package Products</h3>

<div style={{ display: "flex", alignItems: "center", gap: 8, flex: 2, minWidth: 200 }}>
            <input 
              type="checkbox" 
              id="subToggleNew"
              checked={newIsSubscribable} 
              onChange={(e) => setNewIsSubscribable(e.target.checked)} 
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <label htmlFor="subToggleNew" style={{ fontSize: 13, color: "#111827", cursor: "pointer", fontWeight: 500 }}>
              Available for Daily Subscription?
            </label>
          </div>
        <form onSubmit={handleCreateProduct} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 2, minWidth: 150 }}>
            <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Name</label>
            <input style={inputStyle} placeholder="e.g. Full Cream Milk" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 100 }}>
            <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Unit</label>
            <input style={inputStyle} placeholder="e.g. 500ml" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 80 }}>
            <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Price (Rs.)</label>
            <input style={inputStyle} type="number" placeholder="e.g. 30" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 2, minWidth: 150 }}>
            <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Category</label>
            <select style={inputStyle} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              <option value="">- No Category -</option>
              {localCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Product Image</label>
            <input type="file" accept="image/*" style={{...inputStyle, padding: 5, background: "#fff"}} onChange={(e) => setNewImage(e.target.files?.[0] || null)} />
          </div>
          <button type="submit" disabled={savingProduct} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 500, height: 38 }}>
            {savingProduct ? "Saving..." : "Add Product"}
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
              <div key={p.id} style={{ padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", background: p.isActive ? "#fff" : "#f9fafb", opacity: p.isActive ? 1 : 0.7 }}>
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
                      <label style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Price (Rs.)</label>
                      <input style={inputStyle} type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
                      <label style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Category</label>
                      <select style={inputStyle} value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                        <option value="">- No Category -</option>
                        {localCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
                      <label style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>New Image (Optional)</label>
                      <input type="file" accept="image/*" style={{...inputStyle, padding: 5, background: "#fff"}} onChange={(e) => setEditImage(e.target.files?.[0] || null)} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 2, minWidth: 200, paddingBottom: 8 }}>
                      <input 
                        type="checkbox" 
                        id={`subToggleEdit-${p.id}`}
                        checked={editIsSubscribable} 
                        onChange={(e) => setEditIsSubscribable(e.target.checked)} 
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                      <label htmlFor={`subToggleEdit-${p.id}`} style={{ fontSize: 13, color: "#111827", cursor: "pointer", fontWeight: 500 }}>
                        Available for Daily Subscription?
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => saveEdit(p.id)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13 }}>Save</button>
                      <button onClick={cancelEdit} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1px solid #e5e7eb" }}>Package</div>
                      )}
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                        <span style={{ marginLeft: 8, fontSize: 13, color: "#666" }}>{p.unit}</span>
                        <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500 }}>Rs.{p.price}</span>
                        {p.categoryId && (
                          <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "#f3f4f6", color: "#374151" }}>
                            {categories.find((c) => c.id === p.categoryId)?.name || ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, background: p.isActive ? "#dcfce7" : "#fee2e2", color: p.isActive ? "#16a34a" : "#dc2626" }}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                      <button onClick={() => startEdit(p)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 }}>Edit Edit</button>
                      <button onClick={() => handleToggleProductActive(p.id, p.isActive)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: p.isActive ? "#fee2e2" : "#dcfce7", color: p.isActive ? "#dc2626" : "#16a34a", cursor: "pointer", fontSize: 12 }}>
                        {p.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}