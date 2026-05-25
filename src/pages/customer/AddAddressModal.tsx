import { useState } from "react";
import { db } from "../../firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { buildAddressServiceFields } from "../../services/addressRoutes";

interface AddAddressModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAddressModal({ user, onClose, onSuccess }: AddAddressModalProps) {
  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.tenantId) return;
    if (!label.trim() || !line1.trim()) { setError("Label and Address Line 1 are required."); return; }
    
    setSaving(true);
    setError("");
    
    try {
      const [zoneSnap, hubSnap] = await Promise.all([
        getDocs(collection(db, "tenants", user.tenantId, "zones")),
        getDocs(collection(db, "tenants", user.tenantId, "hubs")),
      ]);
      const zones = zoneSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const hubs = hubSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const serviceFields = buildAddressServiceFields({ pincode: pincode.trim() }, zones, hubs);

      await addDoc(collection(db, "tenants", user.tenantId, "addresses"), {
        customerId: user.uid, tenantId: user.tenantId, label: label.trim(), line1: line1.trim(), area: area.trim(), 
        city: city.trim(), pincode: pincode.trim(), phone: phone.trim(), isDefault, ...serviceFields, createdAt: serverTimestamp(),
      });
      onSuccess();
    } catch (err) { 
      setError("Failed to save address."); 
      setSaving(false); 
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <section style={{ width: "100%", maxWidth: 480, padding: 24, borderRadius: "24px 24px 0 0", background: "#fff", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -10px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Add New Address</h2>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Label (Home, Work)</label><input required value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} placeholder="e.g. Home" /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Phone Number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} placeholder="10-digit number" /></div>
          </div>

          <div><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Address Line 1</label><input required value={line1} onChange={(e) => setLine1(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} placeholder="House/Flat No., Building Name" /></div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Area / Locality</label><input value={area} onChange={(e) => setArea(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>City</label><input value={city} onChange={(e) => setCity(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} /></div>
          </div>

          <div><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Pincode</label><input value={pincode} onChange={(e) => setPincode(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} /></div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default delivery address
          </label>

          {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{error}</div>}

          <button type="submit" disabled={saving} style={{ padding: "14px", borderRadius: 12, border: "none", background: "#111827", color: "#fff", fontWeight: 700, fontSize: 15, marginTop: 8, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            {saving ? "Saving..." : "Save Address"}
          </button>
        </form>
      </section>
    </div>
  );
}
