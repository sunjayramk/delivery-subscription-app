interface Customer {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}

interface CustomersTabProps {
  cardStyle: React.CSSProperties;
  custEmail: string;
  custPassword: string;
  custName: string;
  custPhone: string;
  savingCustomer: boolean;
  customerError: string;
  customers: Customer[];
  setCustEmail: (v: string) => void;
  setCustPassword: (v: string) => void;
  setCustName: (v: string) => void;
  setCustPhone: (v: string) => void;
  handleCreateCustomer: (e: React.FormEvent) => void;
}

export default function CustomersTab({
  cardStyle,
  custEmail,
  custPassword,
  custName,
  custPhone,
  savingCustomer,
  customerError,
  customers,
  setCustEmail,
  setCustPassword,
  setCustName,
  setCustPhone,
  handleCreateCustomer,
}: CustomersTabProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>👤 Create Customer</h2>

      <form
        onSubmit={handleCreateCustomer}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Email</label>
          <input
            placeholder="customer@email.com"
            value={custEmail}
            onChange={(e) => setCustEmail(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Password</label>
          <input
            type="password"
            placeholder="Password"
            value={custPassword}
            onChange={(e) => setCustPassword(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Name</label>
          <input
            placeholder="Customer Name"
            value={custName}
            onChange={(e) => setCustName(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Phone</label>
          <input
            placeholder="9876543210"
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

        <button
          type="submit"
          disabled={savingCustomer}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#111827",
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 500,
            height: 42,
          }}
        >
          {savingCustomer ? "Saving..." : "Create"}
        </button>
      </form>

      {customerError && (
        <p style={{ color: "red", marginTop: 8 }}>{customerError}</p>
      )}

      {/* Customer List */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Existing Customers</h3>
        {customers.length === 0 ? (
          <p style={{ color: "#666", fontSize: 14 }}>No customers added yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", padding: 8 }}>Phone</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 8 }}>{c.name || "—"}</td>
                  <td style={{ padding: 8 }}>{c.email}</td>
                  <td style={{ padding: 8 }}>{c.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}