import { useState } from "react";
import AddAddressModal from "./AddAddressModal";
import { getAddressRouteStatus, getRouteLabel } from "../../services/addressRoutes";

interface AddressesTabProps {
  user: any;
  addresses: any[];
  loadingAddresses: boolean;
  errorAddresses: string;
  handleSetDefaultAddress: (id: string) => void;
  reloadAddresses: () => void;
}

export default function AddressesTab({ user, addresses, loadingAddresses, errorAddresses, handleSetDefaultAddress, reloadAddresses }: AddressesTabProps) {
  const [showModal, setShowModal] = useState(false);

  if (loadingAddresses) return <div style={{ padding: 20, textAlign: "center" }}>Loading addresses...</div>;
  if (errorAddresses) return <div style={{ padding: 20, textAlign: "center", color: "#dc2626" }}>{errorAddresses}</div>;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Saved Addresses</h3>
        <button onClick={() => setShowModal(true)} style={{ background: "#e5e7eb", color: "#111827", padding: "8px 12px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" }}>
          + Add New
        </button>
      </div>

      {addresses.length === 0 ? (
        <div style={{ background: "#fff", padding: 24, borderRadius: 12, textAlign: "center", border: "1px dashed #d1d5db" }}>
          <p style={{ margin: 0, color: "#6b7280" }}>No addresses saved yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {addresses.map((addr: any) => (
            <div key={addr.id} style={{ background: "#fff", padding: 16, borderRadius: 12, border: addr.isDefault ? "2px solid #2563eb" : "1px solid #e5e7eb" }}>
              {(() => {
                const routeStatus = getAddressRouteStatus(addr);
                const routeColor = routeStatus === "assigned" ? { background: "#eff6ff", color: "#2563eb" } : routeStatus === "unserviceable" ? { background: "#fee2e2", color: "#b91c1c" } : { background: "#fef3c7", color: "#92400e" };
                return (
                  <div style={{ display: "inline-flex", marginBottom: 8, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, ...routeColor }}>
                    {routeStatus === "assigned" ? getRouteLabel(addr) : routeStatus === "unserviceable" ? "Non serviceable area" : "Route review pending"}
                  </div>
                );
              })()}
              <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                {addr.label} {addr.isDefault && <span style={{ color: "#2563eb", fontSize: 12, marginLeft: 8 }}>(Default)</span>}
              </div>
              <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                {addr.line1}{addr.area && `, ${addr.area}`}<br />
                {addr.city && `${addr.city} `}{addr.pincode}
              </div>
              {addr.phone && <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>Phone: {addr.phone}</div>}
              
              {!addr.isDefault && (
                <button onClick={() => handleSetDefaultAddress(addr.id)} style={{ marginTop: 12, padding: "6px 12px", background: "#f3f4f6", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                  Set as Default
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddAddressModal 
          user={user} 
          onClose={() => setShowModal(false)} 
          onSuccess={() => {
            setShowModal(false);
            reloadAddresses();
          }} 
        />
      )}
    </div>
  );
}
