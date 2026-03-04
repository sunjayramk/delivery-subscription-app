interface CustomersTabProps {
  cardStyle: React.CSSProperties;
  custEmail: string;
  custPassword: string;
  custName: string;
  custPhone: string;
  savingCustomer: boolean;
  customerError: string;
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
  setCustEmail,
  setCustPassword,
  setCustName,
  setCustPhone,
  handleCreateCustomer,
}: CustomersTabProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>
        👤 Create Customer
      </h2>

      <form
        onSubmit={handleCreateCustomer}
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr 1fr auto",
          gap: 8,
          alignItems: "end",
        }}
      >
        <input
          placeholder="Email"
          value={custEmail}
          onChange={(e) => setCustEmail(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <input
          placeholder="Password"
          value={custPassword}
          onChange={(e) => setCustPassword(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <input
          placeholder="Name"
          value={custName}
          onChange={(e) => setCustName(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <input
          placeholder="Phone"
          value={custPhone}
          onChange={(e) => setCustPhone(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

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
          }}
        >
          {savingCustomer ? "Saving..." : "Create"}
        </button>
      </form>

      {customerError && (
        <p style={{ color: "red", marginTop: 8 }}>{customerError}</p>
      )}
    </section>
  );
}