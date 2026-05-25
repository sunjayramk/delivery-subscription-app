import { useState, useEffect, useMemo } from "react";
import { useCart } from "../../context/CartContext"; // Add this line!
import { buildDeliverySlots } from "../../services/deliverySlots";
import type { DeliverySlot, DeliverySlotSubscription } from "../../services/deliverySlots";

interface CartTabProps {
  products: any[];
  addresses: any[];
  subscriptions: DeliverySlotSubscription[];
  loadingSubscriptions: boolean;
  cutoffTime?: string;
  handleCheckout: (addressId: string | undefined, slot: DeliverySlot) => void;
  isCheckingOut: boolean;
  setActiveTab: (tab: string) => void;
}

export default function CartTab({
  products, addresses, subscriptions, loadingSubscriptions, cutoffTime,
  handleCheckout, isCheckingOut, setActiveTab
}: CartTabProps) {
  
  const { cart, updateCartQty } = useCart(); // Grab from the cloud!
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");

  // Auto-select their default address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find((a:any) => a.isDefault) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  const deliverySlots = useMemo(() => buildDeliverySlots(subscriptions, {
    windowDays: 30,
    cutoffTime,
    includeToday: false,
    blockNearestDateAfterCutoff: true,
  }), [subscriptions, cutoffTime]);

  useEffect(() => {
    if (deliverySlots.length === 0) {
      setSelectedSlotKey("");
      return;
    }

    const currentExists = deliverySlots.some((slot) => `${slot.date}_${slot.shift}` === selectedSlotKey);
    if (!currentExists) {
      setSelectedSlotKey(`${deliverySlots[0].date}_${deliverySlots[0].shift}`);
    }
  }, [deliverySlots, selectedSlotKey]);

  const selectedSlot = deliverySlots.find((slot) => `${slot.date}_${slot.shift}` === selectedSlotKey);

  // Map the cart dictionary back into product objects
  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const p = products.find((x: any) => x.id === id);
    return { id, qty, ...p };
  }).filter(item => item.name); // only keep valid products

  // NEW: Calculate the cartTotal right here so we don't need it as a prop!
  const cartTotal = cartItems.reduce((sum, item) => sum + ((item.price || 0) * item.qty), 0);

  if (cartItems.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
         <div style={{ fontSize: 48 }}>Cart</div>
         <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Your cart is empty</div>
         <p style={{ color: "#6b7280", margin: 0, fontSize: 14 }}>Looks like you haven't added anything yet.</p>
         <button onClick={() => setActiveTab("products")} style={{ background: "#2563eb", color: "#fff", padding: "10px 24px", borderRadius: 8, border: "none", fontWeight: 700, marginTop: 12, cursor: "pointer" }}>Browse Products</button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 100, background: "#f9fafb", minHeight: "100%" }}>
      
      {/* Tag HEADER */}
      <div style={{ padding: "16px", background: "#fff", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => setActiveTab("products")} style={{ background: "none", border: "none", fontSize: 16, color: "#111827", cursor: "pointer", padding: 0 }}>Back</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>Review Order</h2>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        
        {/* Location DELIVERY DETAILS */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
           <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>Location Delivery Address</h3>
           {addresses.length === 0 ? (
             <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, background: "#fef2f2", padding: 10, borderRadius: 8 }}>Please add an address in your Profile first.</div>
           ) : (
             <select 
               value={selectedAddressId} 
               onChange={(e) => setSelectedAddressId(e.target.value)}
               style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", fontSize: 14, fontWeight: 600, color: "#111827" }}
             >
               {addresses.map((a: any) => (
                 <option key={a.id} value={a.id}>{a.label} - {a.line1}, {a.area}</option>
               ))}
             </select>
           )}
        </div>

        {/* Time DELIVERY SLOT SELECTION */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
           <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>Delivery slot</h3>
           {loadingSubscriptions ? (
             <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600, background: "#f9fafb", padding: 12, borderRadius: 8 }}>Loading delivery slots...</div>
           ) : deliverySlots.length === 0 ? (
             <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, background: "#fef2f2", padding: 12, borderRadius: 8 }}>No eligible subscription delivery slots are available.</div>
           ) : (
             <select
               value={selectedSlotKey}
               onChange={(e) => setSelectedSlotKey(e.target.value)}
               style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", fontSize: 14, fontWeight: 700, color: "#111827" }}
             >
               {deliverySlots.map((slot) => {
                 const key = `${slot.date}_${slot.shift}`;
                 return <option key={key} value={key}>{slot.label}</option>;
               })}
             </select>
           )}
        </div>

        {/* Cart ITEMIZED CART */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
           <h3 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: "#111827" }}>Items ({cartItems.length})</h3>
           <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
             {cartItems.map((item: any) => (
               <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                   <div style={{ width: 48, height: 48, background: "#f8fafc", borderRadius: 8, padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                     {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "darken" }} /> : "Package"}
                   </div>
                   <div>
                     <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{item.name}</div>
                     <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{item.unit} | Rs.{item.price}</div>
                   </div>
                 </div>
                 <div style={{ display: "flex", alignItems: "center", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, overflow: "hidden" }}>
                    <button onClick={() => updateCartQty(item, -1)} style={{ width: 28, height: 28, background: "none", border: "none", color: "#dc2626", fontWeight: 800, cursor: "pointer" }}>-</button>
                    <div style={{ width: 20, textAlign: "center", color: "#dc2626", fontSize: 13, fontWeight: 700 }}>{item.qty}</div>
                    <button onClick={() => updateCartQty(item, 1)} style={{ width: 28, height: 28, background: "none", border: "none", color: "#dc2626", fontWeight: 800, cursor: "pointer" }}>+</button>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* Invoice BILL DETAILS */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
           <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 700, color: "#111827" }}>Bill Details</h3>
           <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#4b5563" }}>
             <span>Item Total</span>
             <span style={{ fontWeight: 600 }}>Rs.{cartTotal}</span>
           </div>
           <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13, color: "#4b5563" }}>
             <span>Delivery Fee</span>
             <span style={{ fontWeight: 700, color: "#16a34a" }}>FREE</span>
           </div>
           <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#111827" }}>
             <span>To Pay</span>
             <span>Rs.{cartTotal}</span>
           </div>
        </div>

      </div>

      {/* Launch STICKY CHECKOUT BUTTON */}
      <div style={{ position: "fixed", bottom: 80, left: 0, right: 0, margin: "0 auto", maxWidth: 448, padding: "0 16px", zIndex: 50 }}>
        <button 
          onClick={() => selectedSlot && handleCheckout(selectedAddressId, selectedSlot)}
          disabled={isCheckingOut || addresses.length === 0 || loadingSubscriptions || !selectedSlot}
          style={{ width: "100%", background: "#16a34a", color: "#fff", borderRadius: 12, padding: "16px", border: "none", fontSize: 16, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)", cursor: (isCheckingOut || addresses.length === 0 || loadingSubscriptions || !selectedSlot) ? "not-allowed" : "pointer", opacity: (isCheckingOut || addresses.length === 0 || loadingSubscriptions || !selectedSlot) ? 0.7 : 1 }}
        >
          <span>{isCheckingOut ? "Processing..." : "Place Order"}</span>
          <span>Rs.{cartTotal} {"->"}</span>
        </button>
      </div>

    </div>
  );
}
