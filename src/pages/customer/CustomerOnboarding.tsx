import { useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useLoadScript } from "@react-google-maps/api";

const libraries: ("places")[] = ["places"];

export default function CustomerOnboarding({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries,
    version: "weekly" 
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<any[]>([]);

  const [addressType, setAddressType] = useState(""); 
  const [customLabel, setCustomLabel] = useState("");

  const [formData, setFormData] = useState({ name: "", line1: "", area: "", pincode: "", city: "Mumbai" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSearchInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (!val || !isLoaded) {
      setPredictions([]);
      return;
    }

    try {
      // @ts-ignore
      const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: val,
        includedRegionCodes: ['in']
      });

      if (suggestions) {
        // FIX: Added optional chaining and fallback strings
        // @ts-ignore
        const formattedResults = suggestions.map(s => ({
          place_id: s.placePrediction?.placeId || "",
          description: s.placePrediction?.text?.text || ""
        }));
        setPredictions(formattedResults);
      }
    } catch (err) {
      console.error("Google Places Search Error:", err);
      setPredictions([]);
    }
  };

  const handleSelectPlace = async (placeId: string, description: string) => {
    setSearchQuery(description); 
    setPredictions([]); 

    try {
      // @ts-ignore
      const place = new window.google.maps.places.Place({ id: placeId });
      // @ts-ignore
      await place.fetchFields({ fields: ['addressComponents', 'displayName'] });

      let newPincode = "";
      let newCity = "Mumbai";
      let newArea = "";
      // @ts-ignore
      let newLine1 = place.displayName || description.split(',')[0] || "";

      // @ts-ignore
      if (place.addressComponents) {
        // @ts-ignore
        place.addressComponents.forEach((comp) => {
          const types = comp.types || [];
          // FIX: Added || "" to guarantee a string for TypeScript
          if (types.includes("postal_code")) newPincode = comp.longText || "";
          if (types.includes("locality")) newCity = comp.longText || "";
          if (types.includes("sublocality") || types.includes("route")) {
            const safeText = comp.longText || "";
            newArea = newArea ? `${newArea}, ${safeText}` : safeText;
          }
        });
      }

      setFormData(prev => ({
        ...prev,
        line1: newLine1,
        area: newArea,
        pincode: newPincode,
        city: newCity
      }));

    } catch (err) {
      console.error("Place Details Error:", err);
    }
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !user?.tenantId) return;
    setIsSaving(true);

    const finalLabel = addressType === "Other" ? customLabel : addressType;

    try {
      await setDoc(doc(db, "users", user.uid), {
        name: formData.name, role: "customer", tenantId: user.tenantId, isOnboarded: true, createdAt: serverTimestamp()
      }, { merge: true });

      await addDoc(collection(db, "tenants", user.tenantId, "addresses"), {
        customerId: user.uid, tenantId: user.tenantId, label: finalLabel, line1: formData.line1, area: formData.area, pincode: formData.pincode, city: formData.city, isDefault: true, createdAt: serverTimestamp()
      });

      onComplete();
    } catch (error) {
      console.error("Onboarding error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isFormFilled = formData.line1 && formData.area && formData.pincode && formData.city;
  const isLabelValid = addressType !== "" && (addressType === "Other" ? customLabel.trim() !== "" : true);
  const canSubmit = isFormFilled && isLabelValid && !isSaving;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 1000, display: "flex", flexDirection: "column", padding: 24 }}>
      <div style={{ maxWidth: 400, margin: "0 auto", width: "100%" }}>
        
        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          <div style={{ flex: 1, height: 4, background: "#2563eb", borderRadius: 2 }} />
          <div style={{ flex: 1, height: 4, background: step === 2 ? "#2563eb" : "#e5e7eb", borderRadius: 2 }} />
        </div>

        {step === 1 ? (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Welcome! 👋</h1>
            <p style={{ color: "#6b7280", marginBottom: 32 }}>Tell us a bit about yourself to get started.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Full Name</label>
                <input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Rahul Sharma" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }} />
              </div>
              
              <button disabled={!formData.name} onClick={() => setStep(2)} style={{ marginTop: 12, padding: 16, background: formData.name ? "#2563eb" : "#94a3b8", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
                Next: Delivery Address
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFinish} style={{ animation: "fadeIn 0.3s ease" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Delivery Location 📍</h1>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>Where should we deliver your fresh milk?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Search Location</label>
                <div style={{ position: "relative", width: "100%" }}>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={handleSearchInput}
                    placeholder="🔍 Search building, society, or landmark..." 
                    style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", backgroundColor: "#f9fafb", boxSizing: "border-box" }} 
                  />
                  {predictions.length > 0 && (
                    <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, marginTop: 4, padding: 0, listStyle: "none", zIndex: 10, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                      {predictions.map((p) => (
                        <li 
                          key={p.place_id} 
                          onClick={() => handleSelectPlace(p.place_id, p.description)}
                          style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", fontSize: 13, color: "#374151" }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#fff"}
                        >
                          {p.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px dashed #d1d5db", margin: "4px 0" }} />

              <input name="line1" value={formData.line1} onChange={handleChange} required type="text" placeholder="Flat, House no., Building" style={{ padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }} />
              <input name="area" value={formData.area} onChange={handleChange} required type="text" placeholder="Area, Street, Sector" style={{ padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }} />
              
              <div style={{ display: "flex", gap: 12 }}>
                <input name="pincode" value={formData.pincode} onChange={handleChange} required type="text" placeholder="Pincode" style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }} />
                <input name="city" value={formData.city} onChange={handleChange} required type="text" placeholder="City" style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Save address as <span style={{ color: "red" }}>*</span></label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Home", "Work", "Other"].map((type) => (
                    <button key={type} type="button" onClick={() => setAddressType(type)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: addressType === type ? "2px solid #16a34a" : "1px solid #d1d5db", background: addressType === type ? "#f0fdf4" : "#fff", color: addressType === type ? "#16a34a" : "#4b5563", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                      {type === "Home" ? "🏠 " : type === "Work" ? "🏢 " : "📍 "}{type}
                    </button>
                  ))}
                </div>
              </div>

              {addressType === "Other" && (
                <input type="text" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g., Gym, Parents' House" style={{ padding: 12, borderRadius: 8, border: "1px solid #16a34a", backgroundColor: "#f0fdf4" }} required />
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: 16, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Back</button>
                <button type="submit" disabled={!canSubmit} style={{ flex: 2, padding: 16, background: canSubmit ? "#16a34a" : "#9ca3af", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
                  {isSaving ? "Saving..." : "Finish & Explore"}
                </button>
              </div>

            </div>
          </form>
        )}
      </div>
    </div>
  );
}