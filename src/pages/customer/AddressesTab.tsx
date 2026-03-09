// === AddressesTab.tsx === [code here]

import { useState } from "react";

interface Address {
  id: string;
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  mapUrl?: string;
  isDefault?: boolean;
}

interface Props {
  loadingAddresses: boolean;
  errorAddresses: string;
  addresses: Address[];

  newAddrLabel: string;
  newAddrLine1: string;
  newAddrArea: string;
  newAddrCity: string;
  newAddrPincode: string;
  newAddrPhone: string;
  newAddrMapUrl: string;
  newAddrIsDefault: boolean;

  setNewAddrLabel: (v: string) => void;
  setNewAddrLine1: (v: string) => void;
  setNewAddrArea: (v: string) => void;
  setNewAddrCity: (v: string) => void;
  setNewAddrPincode: (v: string) => void;
  setNewAddrPhone: (v: string) => void;
  setNewAddrMapUrl: (v: string) => void;
  setNewAddrIsDefault: (v: boolean) => void;

  handleAddAddress: (e: React.FormEvent) => void;
  handleSetDefaultAddress: (id: string) => void;

  savingAddress: boolean;
}

const LABEL_OPTIONS = ["Home", "Work", "Other"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#555",
  marginBottom: 4,
  display: "block",
};

export default function AddressesTab({
  loadingAddresses,
  errorAddresses,
  addresses,
  newAddrLabel,
  newAddrLine1,
  newAddrArea,
  newAddrCity,
  newAddrPincode,
  newAddrPhone,
  newAddrMapUrl,
  newAddrIsDefault,
  setNewAddrLabel,
  setNewAddrLine1,
  setNewAddrArea,
  setNewAddrCity,
  setNewAddrPincode,
  setNewAddrPhone,
  setNewAddrMapUrl,
  setNewAddrIsDefault,
  handleAddAddress,
  handleSetDefaultAddress,
  savingAddress,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    handleAddAddress(e);
    setShowForm(false);
  }

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>My Addresses</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            + Add Address
          </button>
        )}
      </div>

      {loadingAddresses ? (
        <p>Loading addresses...</p>
      ) : errorAddresses ? (
        <p style={{ color: "red" }}>{errorAddresses}</p>
      ) : (
        <>
          {/* Add Address Form */}
          {showForm && (
            <div
              style={{
                padding: 20,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>New Address</h3>
                <button
                  onClick={() => setShowForm(false)}
                  style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#666" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Label buttons */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Label</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {LABEL_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setNewAddrLabel(opt)}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 20,
                          border: "1px solid #d1d5db",
                          background: newAddrLabel === opt ? "#111827" : "#fff",
                          color: newAddrLabel === opt ? "#fff" : "#374151",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        {opt === "Home" ? "🏠 Home" : opt === "Work" ? "💼 Work" : "📍 Other"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* House/Flat */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>House / Flat / Block Number</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Flat 4B, Tower 2"
                    value={newAddrLine1}
                    onChange={(e) => setNewAddrLine1(e.target.value)}
                  />
                </div>

                {/* Building/Society */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Apartment / Building / Society</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Sunrise Apartments"
                    value={newAddrArea}
                    onChange={(e) => setNewAddrArea(e.target.value)}
                  />
                </div>

                {/* City and Pincode in a row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      style={inputStyle}
                      placeholder="e.g. Mumbai"
                      value={newAddrCity}
                      onChange={(e) => setNewAddrCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Pincode</label>
                    <input
                      style={inputStyle}
                      placeholder="e.g. 400053"
                      value={newAddrPincode}
                      onChange={(e) => setNewAddrPincode(e.target.value)}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Phone Number</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 9876543210"
                    value={newAddrPhone}
                    onChange={(e) => setNewAddrPhone(e.target.value)}
                  />
                </div>

                {/* Instructions */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Delivery Instructions (optional)</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Leave at door, Ring bell twice"
                    value={newAddrMapUrl}
                    onChange={(e) => setNewAddrMapUrl(e.target.value)}
                  />
                </div>

                {/* Default checkbox */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={newAddrIsDefault}
                      onChange={(e) => setNewAddrIsDefault(e.target.checked)}
                    />
                    Set as default address
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={savingAddress}
                    style={{
                      padding: "10px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: "#111827",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {savingAddress ? "Saving..." : "Save Address"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={{
                      padding: "10px 24px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Address Cards */}
          {addresses.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px dashed #d1d5db",
                textAlign: "center",
                color: "#666",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
              <p style={{ margin: 0 }}>No addresses added yet.</p>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>Click "Add Address" to get started.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {addresses.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: a.isDefault ? "2px solid #111827" : "1px solid #e5e7eb",
                    background: "#fff",
                    position: "relative",
                  }}
                >
                  {a.isDefault && (
                    <span
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        background: "#111827",
                        color: "#fff",
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 10,
                      }}
                    >
                      Default
                    </span>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {a.label === "Home" ? "🏠" : a.label === "Work" ? "💼" : "📍"} {a.label}
                  </div>

                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                    {a.line1}
                    {a.area ? <div>{a.area}</div> : null}
                    {a.city || a.pincode ? (
                      <div>{[a.city, a.pincode].filter(Boolean).join(" - ")}</div>
                    ) : null}
                  </div>

                  {a.phone && (
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>📞 {a.phone}</div>
                  )}

                  {a.mapUrl && (
                    <div style={{ fontSize: 12, marginTop: 4, color: "#666", fontStyle: "italic" }}>
                      📝 {a.mapUrl}
                    </div>
                  )}

                  {!a.isDefault && (
                    <button
                      style={{
                        marginTop: 10,
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        background: "#f9fafb",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                      onClick={() => handleSetDefaultAddress(a.id)}
                    >
                      Set as Default
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}