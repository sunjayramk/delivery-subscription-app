import { useState } from "react";
import { db } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SubscriptionModalProps {
  product: any;
  user: any;
  addresses: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubscriptionModal({ product, user, addresses, onClose, onSuccess }: SubscriptionModalProps) {
  const [qty, setQty] = useState("1");
  const [schedule, setSchedule] = useState<string>("daily");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [dayQuantities, setDayQuantities] = useState<Record<number, string>>({});
  const [addressId, setAddressId] = useState<string>("");
  const [shift, setShift] = useState<"Morning" | "Evening">("Morning");
  const [startDate, setStartDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleCustomDay(dayIndex: number) {
    setCustomDays((prev) => prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]);
  }

  function setDayQuantityInput(dayIndex: number, value: string) {
    setDayQuantities((prev) => ({ ...prev, [dayIndex]: value }));
  }

  async function handleCreateSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.tenantId || !product) return;
    
    if (!qty.trim()) { setError("Please enter quantity."); return; }
    const qtyNumber = Number(qty);
    if (Number.isNaN(qtyNumber) || qtyNumber <= 0) { setError("Quantity must be a positive number."); return; }
    if (schedule === "custom" && customDays.length === 0) { setError("Please select at least one day for custom schedule."); return; }
    if (!addressId) { setError("Please select a delivery address."); return; }

    const selectedAddress = addresses.find((a) => a.id === addressId);
    if (!selectedAddress) { setError("Selected address not found."); return; }

    const formattedDayQuantities: Record<string, number> = {};
    Object.entries(dayQuantities).forEach(([dayIndexStr, val]) => {
      const v = (val ?? "").trim();
      if (!v) return;
      const num = Number(v);
      if (!Number.isNaN(num) && num > 0) { formattedDayQuantities[String(dayIndexStr)] = num; }
    });

    setSaving(true);
    setError("");

    try {
      const startDateValue = startDate ? new Date(startDate) : new Date();
      const baseData: any = {
        tenantId: user.tenantId, customerId: user.uid, customerName: user.name || "Customer", productId: product.id, productName: product.name, unit: product.unit,
        price: product.price, qty: qtyNumber, scheduleType: schedule, isActive: true, createdAt: serverTimestamp(), startDate: startDateValue, 
        shift,
        deliveryAddress: { label: selectedAddress.label, line1: selectedAddress.line1, area: selectedAddress.area || "", city: selectedAddress.city || "", pincode: selectedAddress.pincode || "", phone: selectedAddress.phone || "", mapUrl: selectedAddress.mapUrl || "" },
      };
      if (schedule === "custom") { baseData.scheduleDays = customDays; }
      if (Object.keys(formattedDayQuantities).length > 0) { baseData.dayQuantities = formattedDayQuantities; }

      await addDoc(collection(db, "tenants", user.tenantId, "subscriptions"), baseData);
      onSuccess(); // Trigger parent refresh and toast
    } catch (err) { 
        setError("Failed to create subscription."); 
        setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <section id="sub-form" style={{ width: "100%", maxWidth: 480, padding: 24, borderRadius: "24px 24px 0 0", background: "#fff", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -10px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Subscribe</h2>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>x</button>
        </div>
        
        <div style={{ background: "#eff6ff", padding: 12, borderRadius: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#1e3a8a", fontWeight: 600 }}>{product.name} <span style={{ fontWeight: 400 }}>({product.unit})</span></p>
          <p style={{ margin: "4px 0 0 0", color: "#2563eb", fontWeight: 700, fontSize: 16 }}>Rs.{product.price}</p>
        </div>

        <form onSubmit={handleCreateSubscription} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Start Date</label><input type="date" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} value={startDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Schedule</label><select style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }} value={schedule} onChange={(e) => { setSchedule(e.target.value); setDayQuantities({}); setCustomDays([]); }}><option value="daily">Daily</option><option value="alternate_days">Alternate days</option><option value="mon_fri">Mon to Friday</option><option value="weekends">Weekends</option><option value="custom">Custom days</option></select></div>
          </div>

          {(schedule === "daily" || schedule === "alternate_days") && (
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Quantity per day</label><input style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          )}

          {schedule === "custom" && (
            <div style={{ background: "#f9fafb", padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 12 }}>Select days & quantity:</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {DAY_LABELS.map((label, index) => (
                  <div key={index} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ border: customDays.includes(index) ? "none" : "1px solid #d1d5db", borderRadius: 8, padding: "8px 0", textAlign: "center", cursor: "pointer", backgroundColor: customDays.includes(index) ? "#111827" : "#fff", color: customDays.includes(index) ? "#fff" : "#4b5563", fontSize: 13, fontWeight: 600 }}>
                      <input type="checkbox" checked={customDays.includes(index)} onChange={() => toggleCustomDay(index)} style={{ display: "none" }} />{label}
                    </label>
                    {customDays.includes(index) && ( <input style={{ width: "100%", padding: "6px 4px", fontSize: 12, textAlign: "center", borderRadius: 6, border: "1px solid #9ca3af" }} placeholder="Qty" value={dayQuantities[index] ?? ""} onChange={(e) => setDayQuantityInput(index, e.target.value)} /> )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(schedule === "mon_fri" || schedule === "weekends") && (
            <div style={{ background: "#f9fafb", padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 12 }}>Custom Quantity (Optional)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {(schedule === "mon_fri" ? [1, 2, 3, 4, 5] : [0, 6]).map((index) => (
                  <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>{DAY_LABELS[index]}</div>
                    <input style={{ width: "100%", padding: 6, fontSize: 12, textAlign: "center", borderRadius: 6, border: "1px solid #d1d5db" }} placeholder={qty || "1"} value={dayQuantities[index] ?? ""} onChange={(e) => setDayQuantityInput(index, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Delivery shift</label>
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 4 }}>
              <button type="button" onClick={() => setShift("Morning")} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "none", background: shift === "Morning" ? "#fff" : "transparent", color: shift === "Morning" ? "#2563eb" : "#6b7280", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: shift === "Morning" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}>Morning</button>
              <button type="button" onClick={() => setShift("Evening")} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "none", background: shift === "Evening" ? "#fff" : "transparent", color: shift === "Evening" ? "#2563eb" : "#6b7280", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: shift === "Evening" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}>Evening</button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Delivery address</label>
            {addresses.length === 0 ? (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Please add an address in your Profile first.</div>
            ) : (
              <select style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }} value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                <option value="">- Select an address -</option>
                {addresses.map((a) => <option key={a.id} value={a.id}>{a.label} - {a.line1}</option>)}
              </select>
            )}
          </div>

          {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{error}</div>}
          <button type="submit" disabled={saving} style={{ padding: "14px", borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 15, marginTop: 8, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}>{saving ? "Processing..." : "Confirm Subscription"}</button>
        </form>
      </section>
    </div>
  );
}
