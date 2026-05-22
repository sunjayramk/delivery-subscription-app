//Admin - Subscription Plans Management Tab

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, query, getDocs, addDoc, serverTimestamp, updateDoc, doc, where } from "firebase/firestore";

interface Product { id: string; name: string; price: number; unit: string; }
interface SubPlan {
  id: string;
  name: string;
  productId: string;
  productName: string;
  defaultQty: number;
  planType: "ongoing" | "fixed";
  durationDays?: number;
  autoRenew: boolean;
  discountPct: number;
  deliveryType: "standard" | "free";
  isActive: boolean;
}

export default function SubscriptionPlansTab() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [planName, setPlanName] = useState("");
  const [productId, setProductId] = useState("");
  const [defaultQty, setDefaultQty] = useState<number>(1);
  const [planType, setPlanType] = useState<"ongoing" | "fixed">("ongoing");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [autoRenew, setAutoRenew] = useState(true);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [deliveryType, setDeliveryType] = useState<"standard" | "free">("standard");

  useEffect(() => {
    async function loadData() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        // Fetch Active Products to link plans to
        const prodQ = query(collection(db, "tenants", user.tenantId, "products"), where("isActive", "==", true));
        const prodSnap = await getDocs(prodQ);
        const prodList = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setProducts(prodList);
        if (prodList.length > 0) setProductId(prodList[0].id);

        // Fetch Existing Plans
        const planQ = query(collection(db, "tenants", user.tenantId, "subscriptionPlans"));
        const planSnap = await getDocs(planQ);
        setPlans(planSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubPlan)));
      } catch (err) {
        console.error("Failed to load subscription plans", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId || !productId || !planName.trim()) return;
    setIsSaving(true);
    
    try {
      const linkedProduct = products.find(p => p.id === productId);
      const newPlan = {
        name: planName.trim(),
        productId,
        productName: linkedProduct?.name || "Unknown Product",
        defaultQty: Number(defaultQty),
        planType,
        durationDays: planType === "fixed" ? Number(durationDays) : null,
        autoRenew,
        discountPct: Number(discountPct),
        deliveryType,
        isActive: true,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "tenants", user.tenantId, "subscriptionPlans"), newPlan);
      setPlans([{ id: docRef.id, ...newPlan } as SubPlan, ...plans]);
      
      // Reset Form
      setPlanName(""); setDefaultQty(1); setDiscountPct(0); setPlanType("ongoing");
      alert("Subscription Plan Created!");
    } catch (err) {
      alert("Failed to create plan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePlanStatus(id: string, currentStatus: boolean) {
    if (!user?.tenantId) return;
    await updateDoc(doc(db, "tenants", user.tenantId, "subscriptionPlans", id), { isActive: !currentStatus });
    setPlans(plans.map(p => p.id === id ? { ...p, isActive: !currentStatus } : p));
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading Plans...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>Date Subscription Plans</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Create structured plans to lock in recurring revenue.</p>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* BUILDER FORM */}
        <div style={{ flex: "1 1 350px", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h2 style={{ margin: "0 0 20px 0", fontSize: 18, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}> Create New Plan</h2>
          
          <form onSubmit={handleCreatePlan} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Plan Name</label>
              <input required type="text" value={planName} onChange={e => setPlanName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} placeholder="e.g. 30-Day Healthy Milk" />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Linked Product</label>
                <select value={productId} onChange={e => setProductId(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" }}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Rs.{p.price})</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Default Qty</label>
                <input type="number" min="1" value={defaultQty} onChange={e => setDefaultQty(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Duration</label>
                <select value={planType} onChange={e => setPlanType(e.target.value as any)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" }}>
                  <option value="ongoing">Ongoing (Forever)</option>
                  <option value="fixed">Fixed Days</option>
                </select>
              </div>
              {planType === "fixed" && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Days</label>
                  <input type="number" value={durationDays} onChange={e => setDurationDays(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                </div>
              )}
            </div>

            {planType === "fixed" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, color: "#374151" }}>
                <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} style={{ width: 16, height: 16 }} />
                Auto-Renew at end of duration
              </label>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Discount (%)</label>
                <input type="number" min="0" max="100" value={discountPct} onChange={e => setDiscountPct(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} placeholder="0 for no discount" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Delivery Fee</label>
                <select value={deliveryType} onChange={e => setDeliveryType(e.target.value as any)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" }}>
                  <option value="standard">Standard Rules</option>
                  <option value="free">Free Delivery</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={isSaving || !planName} style={{ marginTop: 8, width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: isSaving || !planName ? "not-allowed" : "pointer" }}>
              {isSaving ? "Saving..." : "Create Plan"}
            </button>
          </form>
        </div>

        {/* PLANS LIST */}
        <div style={{ flex: "1 1 400px", display: "flex", flexDirection: "column", gap: 16 }}>
          {plans.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", background: "#fff", borderRadius: 16, border: "1px dashed #d1d5db", color: "#6b7280" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>Tag</div>
              No subscription plans created yet.
            </div>
          ) : (
            plans.map(plan => (
              <div key={plan.id} style={{ background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", opacity: plan.isActive ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>{plan.name}</h3>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Package {plan.defaultQty}x {plan.productName}</div>
                  </div>
                  <button onClick={() => togglePlanStatus(plan.id, plan.isActive)} style={{ padding: "4px 12px", background: plan.isActive ? "#fee2e2" : "#dcfce7", color: plan.isActive ? "#dc2626" : "#16a34a", border: "none", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {plan.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: "#f3f4f6", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#4b5563" }}>
                    Loading {plan.planType === "fixed" ? `${plan.durationDays} Days` : "Ongoing"}
                  </span>
                  {plan.planType === "fixed" && plan.autoRenew && (
                    <span style={{ background: "#eff6ff", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#2563eb" }}>Refresh Auto-Renews</span>
                  )}
                  {plan.discountPct > 0 && (
                    <span style={{ background: "#fefce8", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#ca8a04" }}>Tag {plan.discountPct}% OFF</span>
                  )}
                  {plan.deliveryType === "free" && (
                    <span style={{ background: "#f0fdf4", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Delivery Free Delivery</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}