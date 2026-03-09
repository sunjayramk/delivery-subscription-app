import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import SectionHeader from "../../components/ui/SectionHeader";
import Toast from "../../components/common/Toast";

interface TenantSettings {
  operations: {
    orderGenerationTime: string; // e.g., "22:00" (10 PM) or "04:00" (4 AM)
    customerCutoffTime: string;  // e.g., "21:00" (9 PM)
  };
  store: {
    shopName: string;
    address: string;
    gstNumber: string;
    fssaiNumber: string;
  };
  billing: {
    lowBalanceThreshold: number;
    autoSuspendNegative: boolean;
    upiId: string;
  };
  notifications: {
    enableWhatsApp: boolean;
  };
}

const DEFAULT_SETTINGS: TenantSettings = {
  operations: { orderGenerationTime: "05:00", customerCutoffTime: "22:00" },
  store: { shopName: "", address: "", gstNumber: "", fssaiNumber: "" },
  billing: { lowBalanceThreshold: 0, autoSuspendNegative: false, upiId: "" },
  notifications: { enableWhatsApp: false },
};

export default function SettingsTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [activeSection, setActiveSection] = useState<"operations" | "store" | "billing" | "notifications">("store");
  
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
  };

  useEffect(() => {
    async function loadSettings() {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, "tenants", user.tenantId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.settings) {
            // Merge existing settings with defaults to prevent undefined errors
            setSettings({
              operations: { ...DEFAULT_SETTINGS.operations, ...data.settings.operations },
              store: { ...DEFAULT_SETTINGS.store, ...data.settings.store },
              billing: { ...DEFAULT_SETTINGS.billing, ...data.settings.billing },
              notifications: { ...DEFAULT_SETTINGS.notifications, ...data.settings.notifications },
            });
          }
        }
      } catch (err) {
        console.error("Failed to load settings", err);
        showToast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId) return;
    setSaving(true);
    try {
      const docRef = doc(db, "tenants", user.tenantId);
      await updateDoc(docRef, {
        settings,
        updatedAt: serverTimestamp(),
      });
      showToast("Settings saved successfully!");
    } catch (err) {
      console.error("Failed to save settings", err);
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", marginTop: "4px"
  };

  if (loading) return <p>Loading settings...</p>;

  return (
    <Card>
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />}
      <SectionHeader title="Store Settings" />
      
      <div style={{ display: "flex", gap: "24px", flexDirection: window.innerWidth < 768 ? "column" : "row" }}>
        
        {/* Left Side: Navigation Menu */}
        <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "8px", minWidth: "200px" }}>
          {["store", "operations", "billing", "notifications"].map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section as any)}
              style={{
                padding: "12px 16px", textAlign: "left", borderRadius: "8px", border: "none", cursor: "pointer",
                background: activeSection === section ? "#111827" : "#f3f4f6",
                color: activeSection === section ? "#fff" : "#374151",
                fontWeight: activeSection === section ? 600 : 400,
                textTransform: "capitalize"
              }}
            >
              {section === "store" ? "🏪 " : section === "operations" ? "🕐 " : section === "billing" ? "💰 " : "🔔 "}{section}
            </button>
          ))}
        </div>

        {/* Right Side: Active Form */}
        <div style={{ flex: "3", background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
          <form onSubmit={handleSave}>
            
            {/* STORE SETTINGS */}
            {activeSection === "store" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0" }}>Store Profile & Legal</h3>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Shop Name (For Invoices)</label>
                  <input style={inputStyle} value={settings.store.shopName} onChange={(e) => setSettings({...settings, store: {...settings.store, shopName: e.target.value}})} placeholder="e.g. Daily Fresh Milk" />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Registered Address</label>
                  <input style={inputStyle} value={settings.store.address} onChange={(e) => setSettings({...settings, store: {...settings.store, address: e.target.value}})} placeholder="Complete address for billing" />
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "13px", fontWeight: 600 }}>GST Number (Optional)</label>
                    <input style={inputStyle} value={settings.store.gstNumber} onChange={(e) => setSettings({...settings, store: {...settings.store, gstNumber: e.target.value}})} placeholder="22AAAAA0000A1Z5" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "13px", fontWeight: 600 }}>FSSAI License No.</label>
                    <input style={inputStyle} value={settings.store.fssaiNumber} onChange={(e) => setSettings({...settings, store: {...settings.store, fssaiNumber: e.target.value}})} placeholder="14-digit FSSAI" />
                  </div>
                </div>
              </div>
            )}

            {/* OPERATIONS SETTINGS */}
            {activeSection === "operations" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0" }}>Daily Operations</h3>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Order Generation Trigger Time</label>
                  <p style={{ margin: "4px 0 8px 0", fontSize: "12px", color: "#666" }}>When should the system automatically create today's orders from active subscriptions?</p>
                  <input type="time" style={inputStyle} value={settings.operations.orderGenerationTime} onChange={(e) => setSettings({...settings, operations: {...settings.operations, orderGenerationTime: e.target.value}})} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Customer Cutoff Time</label>
                  <p style={{ margin: "4px 0 8px 0", fontSize: "12px", color: "#666" }}>After this time, customers cannot skip or modify tomorrow's deliveries.</p>
                  <input type="time" style={inputStyle} value={settings.operations.customerCutoffTime} onChange={(e) => setSettings({...settings, operations: {...settings.operations, customerCutoffTime: e.target.value}})} />
                </div>
              </div>
            )}

            {/* BILLING SETTINGS */}
            {activeSection === "billing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0" }}>Payments & Billing</h3>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Store UPI ID (For Manual Payments)</label>
                  <input style={inputStyle} value={settings.billing.upiId} onChange={(e) => setSettings({...settings, billing: {...settings.billing, upiId: e.target.value}})} placeholder="e.g. storename@okicici" />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Low Balance Alert Threshold (₹)</label>
                  <input type="number" style={inputStyle} value={settings.billing.lowBalanceThreshold} onChange={(e) => setSettings({...settings, billing: {...settings.billing, lowBalanceThreshold: Number(e.target.value)}})} />
                </div>
                <div style={{ marginTop: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      style={{ width: "20px", height: "20px" }}
                      checked={settings.billing.autoSuspendNegative} 
                      onChange={(e) => setSettings({...settings, billing: {...settings.billing, autoSuspendNegative: e.target.checked}})} 
                    />
                    Auto-suspend deliveries if wallet balance drops below threshold
                  </label>
                  <p style={{ margin: "4px 0 0 32px", fontSize: "12px", color: "#e11d48" }}>Warning: This will skip order generation for customers who owe you money.</p>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS SETTINGS */}
            {activeSection === "notifications" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0" }}>Customer Notifications</h3>
                <div style={{ padding: "16px", borderRadius: "8px", border: "1px solid #10b981", background: "#ecfdf5" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "#065f46" }}>
                    <input 
                      type="checkbox" 
                      style={{ width: "20px", height: "20px" }}
                      checked={settings.notifications.enableWhatsApp} 
                      onChange={(e) => setSettings({...settings, notifications: {...settings.notifications, enableWhatsApp: e.target.checked}})} 
                    />
                    Enable WhatsApp Business Notifications
                  </label>
                  <p style={{ margin: "8px 0 0 32px", fontSize: "12px", color: "#047857" }}>Send automated delivery confirmations to your customers via WhatsApp. (Requires Meta Business API setup).</p>
                </div>
              </div>
            )}

            <div style={{ marginTop: "32px", borderTop: "1px solid #e5e7eb", paddingTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "10px 24px", borderRadius: "8px", border: "none", background: "#2563eb", color: "#fff",
                  fontWeight: 600, fontSize: "14px", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? "Saving Changes..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Card>
  );
}