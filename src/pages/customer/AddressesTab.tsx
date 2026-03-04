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
  return (
    <section style={{ marginTop: 24 }}>
      <h2>My Addresses</h2>

      {loadingAddresses ? (
        <p>Loading addresses...</p>
      ) : errorAddresses ? (
        <p style={{ color: "red" }}>{errorAddresses}</p>
      ) : (
        <>
          {/* Address Form */}
          <form
            onSubmit={handleAddAddress}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: 8,
              alignItems: "start",
              marginBottom: 16,
            }}
          >
            <div>
              <label>Label</label>
              <input
                style={{ width: "100%", padding: 6 }}
                value={newAddrLabel}
                onChange={(e) => setNewAddrLabel(e.target.value)}
              />
            </div>

            <div>
              <label>Address</label>
              <input
                style={{ width: "100%", padding: 6 }}
                value={newAddrLine1}
                onChange={(e) => setNewAddrLine1(e.target.value)}
              />
            </div>

            <div>
              <label>Area</label>
              <input
                style={{ width: "100%", padding: 6 }}
                value={newAddrArea}
                onChange={(e) => setNewAddrArea(e.target.value)}
              />
            </div>

            <div>
              <label>City</label>
              <input
                style={{ width: "100%", padding: 6 }}
                value={newAddrCity}
                onChange={(e) => setNewAddrCity(e.target.value)}
              />
            </div>

            <div>
              <label>Pincode</label>
              <input
                style={{ width: "100%", padding: 6 }}
                value={newAddrPincode}
                onChange={(e) => setNewAddrPincode(e.target.value)}
              />
            </div>

            <div>
              <label>Phone</label>
              <input
                style={{ width: "100%", padding: 6 }}
                value={newAddrPhone}
                onChange={(e) => setNewAddrPhone(e.target.value)}
              />
            </div>

            <div>
              <label>Google Maps URL</label>
              <input
                style={{ width: "100%", padding: 6 }}
                value={newAddrMapUrl}
                onChange={(e) => setNewAddrMapUrl(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label>
                <input
                  type="checkbox"
                  checked={newAddrIsDefault}
                  onChange={(e) => setNewAddrIsDefault(e.target.checked)}
                />
                Set as default
              </label>
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <button type="submit" disabled={savingAddress}>
                {savingAddress ? "Saving..." : "Add Address"}
              </button>
            </div>
          </form>

          {/* Address List */}
          {addresses.length === 0 ? (
            <p>No addresses added yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {addresses.map((a) => (
                <li
                  key={a.id}
                  style={{
                    padding: 10,
                    border: "1px solid #e0e0e0",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <strong>{a.label}</strong>{" "}
                  {a.isDefault && (
                    <span style={{ color: "green", fontSize: 12 }}>
                      (Default)
                    </span>
                  )}

                  <div style={{ fontSize: 13 }}>
                    {a.line1}
                    {a.area ? `, ${a.area}` : ""}
                    {a.city ? `, ${a.city}` : ""}
                    {a.pincode ? ` - ${a.pincode}` : ""}
                  </div>

                  {a.phone && (
                    <div style={{ fontSize: 13 }}>Phone: {a.phone}</div>
                  )}

                  {a.mapUrl && (
                    <div style={{ fontSize: 12 }}>
                      <a href={a.mapUrl} target="_blank" rel="noreferrer">
                        Open in Maps
                      </a>
                    </div>
                  )}

                  {!a.isDefault && (
                    <button
                      style={{ marginTop: 6 }}
                      onClick={() => handleSetDefaultAddress(a.id)}
                    >
                      Set Default
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}