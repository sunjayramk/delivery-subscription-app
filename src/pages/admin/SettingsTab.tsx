//Admin - SettingTab.tsx

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- STOREFRONT SETTINGS ---
  const [storeName, setStoreName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#2563eb");
  const [storeLayout, setStoreLayout] = useState("Modern Grid");

  // --- FINANCIAL GUARDRAILS ---
  const [allowCredit, setAllowCredit] = useState(true);
  const [warningLimit, setWarningLimit] = useState<number>(500);
  const [suspensionLimit, setSuspensionLimit] = useState<number>(2000);

  // --- PAYMENT & AUTOMATION ---
  const [payRazorpay, setPayRazorpay] = useState(true);
  const [payUpi, setPayUpi] = useState(true);
  const [payCash, setPayCash] = useState(true);
  const [payBank, setPayBank] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);

  // --- DELIVERY CHARGES ---
  const [subChargeType, setSubChargeType] = useState<"free" | "per_delivery" | "per_unit" | "per_month">("free");
  const [subChargeAmount, setSubChargeAmount] = useState<number>(0);
  const [oneTimeChargeType, setOneTimeChargeType] = useState<"free" | "flat" | "distance">("flat");
  const [oneTimeFlatFee, setOneTimeFlatFee] = useState<number>(30);
  const [distanceBaseKm, setDistanceBaseKm] = useState<number>(5);
  const [distanceBaseFee, setDistanceBaseFee] = useState<number>(20);
  const [distancePerKmFee, setDistancePerKmFee] = useState<number>(5);

  // ✅ NEW: AGENT & FIELD CONTROLS
  const [agentCanEditQty, setAgentCanEditQty] = useState(false);
  const [agentCanMarkNonDelivery, setAgentCanMarkNonDelivery] = useState(true);
  const [agentCanCollectCash, setAgentCanCollectCash] = useState(true);
  const [showRiderDetails, setShowRiderDetails] = useState(true);
  const [allowRiderCalling, setAllowRiderCalling] = useState(true);

  // ✅ NEW: DELIVERY INSTRUCTIONS & NOTIFICATIONS
  const [allowCustomInstructions, setAllowCustomInstructions] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, "tenants", user.tenantId, "settings", "global");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setStoreName(data.storeName ?? ""); setLogoUrl(data.logoUrl ?? ""); setBrandColor(data.brandColor ?? "#2563eb"); setStoreLayout(data.storeLayout ?? "Modern Grid");
          setAllowCredit(data.allowCredit ?? true); setWarningLimit(data.warningLimit ?? 500); setSuspensionLimit(data.suspensionLimit ?? 2000);
          setPayRazorpay(data.payRazorpay ?? true); setPayUpi(data.payUpi ?? true); setPayCash(data.payCash ?? true); setPayBank(data.payBank ?? false);
          setAutoApprove(data.autoApprove ?? true);
          setSubChargeType(data.subChargeType ?? "free"); setSubChargeAmount(data.subChargeAmount ?? 0);
          setOneTimeChargeType(data.oneTimeChargeType ?? "flat"); setOneTimeFlatFee(data.oneTimeFlatFee ?? 30);
          setDistanceBaseKm(data.distanceBaseKm ?? 5); setDistanceBaseFee(data.distanceBaseFee ?? 20); setDistancePerKmFee(data.distancePerKmFee ?? 5);
          
          // Load Field Controls
          setAgentCanEditQty(data.agentCanEditQty ?? false);
          setAgentCanMarkNonDelivery(data.agentCanMarkNonDelivery ?? true);
          setAgentCanCollectCash(data.agentCanCollectCash ?? true);
          setShowRiderDetails(data.showRiderDetails ?? true);
          setAllowRiderCalling(data.allowRiderCalling ?? true);
          setAllowCustomInstructions(data.allowCustomInstructions ?? true);
          setNotifyEmail(data.notifyEmail ?? true);
          setNotifyPush(data.notifyPush ?? true);
          setNotifyWhatsapp(data.notifyWhatsapp ?? true);
        }
      } catch (err) { console.error("Failed to load settings", err); } 
      finally { setLoading(false); }
    }
    fetchSettings();
  }, [user]);

  async function handleSaveSettings() {
    if (!user?.tenantId) return;
    setSaving(true);
    try {
      const docRef = doc(db, "tenants", user.tenantId, "settings", "global");
      await setDoc(docRef, {
        storeName, logoUrl, brandColor, storeLayout,
        allowCredit, warningLimit: Number(warningLimit), suspensionLimit: Number(suspensionLimit),
        payRazorpay, payUpi, payCash, payBank, autoApprove,
        subChargeType, subChargeAmount: Number(subChargeAmount),
        oneTimeChargeType, oneTimeFlatFee: Number(oneTimeFlatFee),
        distanceBaseKm: Number(distanceBaseKm), distanceBaseFee: Number(distanceBaseFee), distancePerKmFee: Number(distancePerKmFee),
        // Save Field Controls
        agentCanEditQty, agentCanMarkNonDelivery, agentCanCollectCash,
        showRiderDetails, allowRiderCalling, allowCustomInstructions,
        notifyEmail, notifyPush, notifyWhatsapp,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert("✅ Enterprise settings successfully saved!");
    } catch (err) { alert("Failed to save settings."); } 
    finally { setSaving(false); }
  }

  const ToggleSwitch = ({ label, checked, onChange, danger = false }: { label: string, checked: boolean, onChange: (c: boolean) => void, danger?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: danger && checked ? "#dc2626" : "#374151" }}>{label}</span>
      <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, background: checked ? (danger ? "#dc2626" : "#16a34a") : "#d1d5db", borderRadius: 12, position: "relative", cursor: "pointer", transition: "background 0.3s" }}>
        <div style={{ width: 20, height: 20, background: "#fff", borderRadius: 10, position: "absolute", top: 2, left: checked ? 22 : 2, transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
      </div>
    </div>
  );

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading Engine Settings...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", paddingBottom: 80 }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>⚙️ Global Settings</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Configure your storefront, financial rules, pricing, and agent permissions.</p>
        </div>
        <button onClick={handleSaveSettings} disabled={saving} style={{ padding: "10px 24px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save All Changes"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24 }}>
        
        {/* ROW 1: CORE BRANDING & FINANCE */}
        <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 20px 0", fontSize: 16, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>🎨 Storefront Branding</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Store Name</label><input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} /></div>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Logo Image URL</label><input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} /></div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Brand Color</label><div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} style={{ width: 40, height: 40, border: "none", cursor: "pointer", padding: 0, borderRadius: 8 }} /></div></div>
              <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Store Layout</label><select value={storeLayout} onChange={e => setStoreLayout(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}><option>Modern Grid</option><option>Compact List</option></select></div>
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 20px 0", fontSize: 16, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>💰 Financial Guardrails</h3>
          <ToggleSwitch label="Allow Customer Credit" checked={allowCredit} onChange={setAllowCredit} />
          <div style={{ display: "flex", gap: 16, marginTop: 20, opacity: allowCredit ? 1 : 0.5, pointerEvents: allowCredit ? "auto" : "none" }}>
            <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#ca8a04", marginBottom: 6 }}>⚠️ Warning Limit (₹)</label><input type="number" value={warningLimit} onChange={e => setWarningLimit(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #fef08a", background: "#fefce8", fontSize: 14 }} /></div>
            <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>🚫 Suspension Limit (₹)</label><input type="number" value={suspensionLimit} onChange={e => setSuspensionLimit(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 14 }} /></div>
          </div>
        </div>

        {/* ✅ ROW 2: NEW FIELD CONTROLS & NOTIFICATIONS */}
        <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>🛵 Agent Permissions</h3>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: -8, marginBottom: 16 }}>Control what delivery boys can do in their app.</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <ToggleSwitch label="Allow agents to Edit Qty at door" checked={agentCanEditQty} onChange={setAgentCanEditQty} danger />
            <ToggleSwitch label="Allow agents to Mark Non-Delivery" checked={agentCanMarkNonDelivery} onChange={setAgentCanMarkNonDelivery} />
            <ToggleSwitch label="Allow agents to Collect Cash" checked={agentCanCollectCash} onChange={setAgentCanCollectCash} />
            <div style={{ borderTop: "2px dashed #e5e7eb", margin: "12px 0" }} />
            <ToggleSwitch label="Show Rider Phone/Name to Customer" checked={showRiderDetails} onChange={setShowRiderDetails} />
            <ToggleSwitch label="Allow Rider to Call Customer" checked={allowRiderCalling} onChange={setAllowRiderCalling} />
          </div>
        </div>

        <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>🔔 Notifications & Checkout</h3>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: -8, marginBottom: 16 }}>Control how customers interact and get alerted.</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <ToggleSwitch label="Enable Email Notifications" checked={notifyEmail} onChange={setNotifyEmail} />
            <ToggleSwitch label="Enable Push Notifications" checked={notifyPush} onChange={setNotifyPush} />
            <ToggleSwitch label="Enable WhatsApp Notifications" checked={notifyWhatsapp} onChange={setNotifyWhatsapp} />
            <div style={{ borderTop: "2px dashed #e5e7eb", margin: "12px 0" }} />
            <ToggleSwitch label="Allow Custom Delivery Instructions" checked={allowCustomInstructions} onChange={setAllowCustomInstructions} />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>If off, customers can only select pre-defined instructions (e.g. "Ring Bell").</div>
          </div>
        </div>

        {/* ROW 3: DELIVERY PRICING (From Phase 3) */}
        <div style={{ background: "#f0fdf4", padding: 24, borderRadius: 16, border: "1px solid #bbf7d0", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>📅 Subscription Delivery Fees</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Fee Structure</label>
              <select value={subChargeType} onChange={e => setSubChargeType(e.target.value as any)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #86efac", fontSize: 14, background: "#fff", color: "#14532d", fontWeight: 600 }}>
                <option value="free">No Delivery Charge (Free)</option>
                <option value="per_delivery">Flat Fee Per Daily Drop</option>
                <option value="per_unit">Fee Per Product Unit</option>
                <option value="per_month">Flat Monthly Subscription Fee</option>
              </select>
            </div>
            {subChargeType !== "free" && (
              <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Charge Amount (₹)</label><input type="number" value={subChargeAmount} onChange={e => setSubChargeAmount(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #86efac", fontSize: 14 }} /></div>
            )}
          </div>
        </div>

        <div style={{ background: "#eff6ff", padding: 24, borderRadius: 16, border: "1px solid #bfdbfe", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#1e40af", display: "flex", alignItems: "center", gap: 8 }}>🚀 One-Time Order Fees</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>Fee Structure</label>
              <select value={oneTimeChargeType} onChange={e => setOneTimeChargeType(e.target.value as any)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #93c5fd", fontSize: 14, background: "#fff", color: "#1e3a8a", fontWeight: 600 }}>
                <option value="free">Free Delivery</option><option value="flat">Standard Flat Rate</option><option value="distance">Dynamic Distance-Based</option>
              </select>
            </div>
            {oneTimeChargeType === "flat" && (
              <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>Flat Delivery Fee (₹)</label><input type="number" value={oneTimeFlatFee} onChange={e => setOneTimeFlatFee(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #93c5fd", fontSize: 14 }} /></div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}