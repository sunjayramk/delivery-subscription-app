import { useState } from "react";

interface ProductsTabProps {
  products: any[];
  categories: any[];
  banners: any[];
  loadingProducts: boolean;
  errorProducts: string;
  cart: Record<string, number>;
  updateCartQty: (product: any, delta: number) => void;
  startSubscription: (product: any) => void;
}

export default function ProductsTab({
  products, categories, banners, loadingProducts, errorProducts, cart, updateCartQty, startSubscription
}: ProductsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  if (loadingProducts) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontWeight: 600 }}>Loading fresh products...</div>;
  if (errorProducts) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontWeight: 600 }}>{errorProducts}</div>;

  // Module REUSABLE PRODUCT CARD COMPONENT
  const renderProductCard = (product: any) => {
    const qtyInCart = cart[product.id] || 0;
    return (
      <div key={product.id} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #f3f4f6", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
        {/* Product Image */}
        <div style={{ height: 130, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, position: "relative" }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "darken" }} />
          ) : (
            <div style={{ fontSize: 40, opacity: 0.1 }}>Package</div>
          )}
        </div>

        {/* Product Info & Controls */}
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.3, height: 34, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {product.name}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{product.unit}</div>
          
          <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Rs.{product.price}</div>
            
            {/* Dynamic Cart Button */}
            {qtyInCart > 0 ? (
              <div style={{ display: "flex", alignItems: "center", background: "#2563eb", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 6px rgba(37, 99, 235, 0.2)" }}>
                <button onClick={() => updateCartQty(product, -1)} style={{ width: 30, height: 30, background: "none", border: "none", color: "#fff", fontWeight: 800, cursor: "pointer" }}>-</button>
                <div style={{ width: 20, textAlign: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{qtyInCart}</div>
                <button onClick={() => updateCartQty(product, 1)} style={{ width: 30, height: 30, background: "none", border: "none", color: "#fff", fontWeight: 800, cursor: "pointer" }}>+</button>
              </div>
            ) : (
              <button onClick={() => updateCartQty(product, 1)} style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s" }}>
                ADD
              </button>
            )}
          </div>

          {/* Subscription Action */}
          {product.isSubscribable !== false && (
            <button onClick={() => startSubscription(product)} style={{ marginTop: 8, width: "100%", background: "#fff", border: "1px solid #e5e7eb", color: "#374151", padding: "8px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span>Date</span> Subscribe
            </button>
          )}
        </div>
      </div>
    );
  };

  // Sort categories by their assigned sortOrder
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div style={{ paddingBottom: 60 }}>
      
      {/* Ticket HORIZONTAL BANNERS CAROUSEL (Only visible on 'All Items') */}
      {selectedCategory === "all" && banners.length > 0 && (
        <div style={{ display: "flex", overflowX: "auto", padding: "16px", gap: 12, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {banners.map(b => (
            <img key={b.id} src={b.imageUrl} alt="Banner" style={{ width: "85%", flexShrink: 0, borderRadius: 12, objectFit: "cover", aspectRatio: "21/9", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }} />
          ))}
        </div>
      )}

      {/* Tag STICKY CATEGORY PILLS */}
      <div style={{ position: "sticky", top: 0, background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(8px)", zIndex: 40, display: "flex", overflowX: "auto", padding: "12px 16px", gap: 10, scrollbarWidth: "none", borderBottom: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
        <button 
          onClick={() => setSelectedCategory("all")}
          style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s", background: selectedCategory === "all" ? "#111827" : "#f3f4f6", color: selectedCategory === "all" ? "#fff" : "#4b5563" }}
        >
          All Items
        </button>
        {sortedCategories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s", background: selectedCategory === cat.id ? "#111827" : "#f3f4f6", color: selectedCategory === cat.id ? "#fff" : "#4b5563" }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* ========================================= */}
        {/* VIEW 1: THE "ALL ITEMS" DISCOVERY VIEW    */}
        {/* ========================================= */}
        {selectedCategory === "all" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {sortedCategories.map(cat => {
              const catProducts = products.filter(p => p.categoryId === cat.id);
              if (catProducts.length === 0) return null; // Hide empty categories

              return (
                <div key={cat.id}>
                  {/* Category Header with "See All" button */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>{cat.name}</h2>
                    {catProducts.length > 4 && (
                      <button onClick={() => setSelectedCategory(cat.id)} style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        See All <span>{"->"}</span>
                      </button>
                    )}
                  </div>
                  
                  {/* Grid showing maximum of 4 items */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                    {catProducts.slice(0, 4).map(renderProductCard)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        /* ========================================= */
        /* VIEW 2: THE SPECIFIC CATEGORY VIEW        */
        /* ========================================= */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {products.filter(p => p.categoryId === selectedCategory).map(renderProductCard)}
            
            {/* Empty Category Fallback */}
            {products.filter(p => p.categoryId === selectedCategory).length === 0 && (
              <div style={{ gridColumn: "1 / span 2", padding: 40, textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>Cart</div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>No items in this category yet</div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
