import React from "react";

interface SubscriptionsTabProps {
  loadingSubs: boolean;
  errorSubs: string;
  activeSubs: any[];
  pausedSubs: any[];
  toggleSubscriptionActive: (sub: any) => void;
  formatSchedule: (sub: any) => string;
  handleToggleSkipDate: (sub: any, dateStr: string) => void;
  // --- NEW VACATION PROPS ---
  vacationFrom: string;
  setVacationFrom: (val: string) => void;
  vacationTo: string;
  setVacationTo: (val: string) => void;
  savingVacation: boolean;
  handleSetVacation: (e: React.FormEvent) => void;
  handleClearVacation: () => void;
  activeVacationSub: any;
}

export default function SubscriptionsTab({
  loadingSubs, errorSubs, activeSubs, pausedSubs, toggleSubscriptionActive, formatSchedule,
  vacationFrom, setVacationFrom, vacationTo, setVacationTo, savingVacation, handleSetVacation, handleClearVacation, activeVacationSub
}: SubscriptionsTabProps) {
  
  if (loadingSubs) return <div style={{ padding: 40, textAlign: "center" }}>Loading plans...</div>;
  if (errorSubs) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>{errorSubs}</div>;

  return (
    <div style={{ padding: 16 }}>
      
      {/* Area THE MASTER VACATION SWITCH */}
      <div style={{ background: activeVacationSub ? "#f0fdf4" : "#fff", border: activeVacationSub ? "1px solid #bbf7d0" : "1px solid #e5e7eb", borderRadius: 16, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.02)", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 24 }}>Area</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: activeVacationSub ? "#166534" : "#111827" }}>Vacation Mode</h3>
            <p style={{ margin: 0, fontSize: 13, color: activeVacationSub ? "#15803d" : "#6b7280" }}>Pause all deliveries while away.</p>
          </div>
        </div>
        
        {activeVacationSub ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, color: "#166534", fontWeight: 600 }}>
              Paused: {new Date(activeVacationSub.vacationFrom!).toLocaleDateString()} - {new Date(activeVacationSub.vacationTo!).toLocaleDateString()}
            </div>
            <button onClick={handleClearVacation} disabled={savingVacation} style={{ padding: "10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
              {savingVacation ? "Updating..." : "Resume Deliveries"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSetVacation} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>From</label>
                <input type="date" required min={new Date().toISOString().split('T')[0]} value={vacationFrom} onChange={e => setVacationFrom(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #d1d5db", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Until</label>
                <input type="date" required min={vacationFrom || new Date().toISOString().split('T')[0]} value={vacationTo} onChange={e => setVacationTo(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #d1d5db", boxSizing: "border-box" }} />
              </div>
            </div>
            <button type="submit" disabled={savingVacation || (activeSubs.length === 0 && pausedSubs.length === 0)} style={{ padding: "10px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
              {savingVacation ? "Saving..." : "Pause Deliveries"}
            </button>
          </form>
        )}
      </div>

      {/* Green ACTIVE SUBSCRIPTIONS */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, color: "#111827", marginBottom: 16 }}>Active Subscriptions</h3>
        {activeSubs.length === 0 ? (
          <div style={{ background: "#fff", padding: 24, borderRadius: 12, textAlign: "center", border: "1px dashed #d1d5db" }}>
            <p style={{ color: "#6b7280", margin: 0 }}>You have no active subscriptions.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeSubs.map((sub) => (
              <div key={sub.id} style={{ background: "#fff", padding: 16, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, color: "#111827" }}>{sub.productName}</h4>
                    <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#6b7280" }}>{sub.qty} x {sub.unit} | {formatSchedule(sub)}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 700, color: "#2563eb" }}>Rs.{sub.price} / delivery</p>
                  </div>
                  <button onClick={() => toggleSubscriptionActive(sub)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Pause Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Red PAUSED SUBSCRIPTIONS */}
      {pausedSubs.length > 0 && (
        <div>
          <h3 style={{ fontSize: 18, color: "#111827", marginBottom: 16, opacity: 0.7 }}>Paused Subscriptions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pausedSubs.map((sub) => (
              <div key={sub.id} style={{ background: "#f9fafb", padding: 16, borderRadius: 16, border: "1px solid #e5e7eb", opacity: 0.8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, color: "#4b5563" }}>{sub.productName}</h4>
                    <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#9ca3af" }}>{sub.qty} x {sub.unit} | {formatSchedule(sub)}</p>
                  </div>
                  <button onClick={() => toggleSubscriptionActive(sub)} style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Resume Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}