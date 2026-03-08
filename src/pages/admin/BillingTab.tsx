interface Customer {
  id: string;
  email: string;
  name?: string;
}

interface BillingTabProps {
  cardStyle: React.CSSProperties;
  accounts: any[];
  loadingAccounts: boolean;
  accountsError: string;
  paymentCustomerId: string;
  paymentAmount: string;
  paymentNote: string;
  savingPayment: boolean;
  invCustomerId: string;
  invYear: string;
  invMonth: string;
  invSaving: boolean;
  invError: string;
  customers: Customer[];
  setPaymentCustomerId: (v: string) => void;
  setPaymentAmount: (v: string) => void;
  setPaymentNote: (v: string) => void;
  setInvCustomerId: (v: string) => void;
  setInvYear: (v: string) => void;
  setInvMonth: (v: string) => void;
  handleRecordPayment: (e: React.FormEvent) => void;
  handleGenerateInvoice: (e: React.FormEvent) => void;
  formatCustomerLabel: (id: string) => string;
}

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function BillingTab({
  cardStyle,
  accounts,
  loadingAccounts,
  accountsError,
  paymentCustomerId,
  paymentAmount,
  paymentNote,
  savingPayment,
  invCustomerId,
  invYear,
  invMonth,
  invSaving,
  invError,
  customers,
  setPaymentCustomerId,
  setPaymentAmount,
  setPaymentNote,
  setInvCustomerId,
  setInvYear,
  setInvMonth,
  handleRecordPayment,
  handleGenerateInvoice,
  formatCustomerLabel,
}: BillingTabProps) {
  const inputStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    marginBottom: 4,
    color: "#555",
    display: "block",
  };

  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>💰 Customer Billing</h2>

      {/* Payment Form */}
      <h3 style={{ marginBottom: 12 }}>Record Payment</h3>
      <form
        onSubmit={handleRecordPayment}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={labelStyle}>Customer</label>
          <select
            value={paymentCustomerId}
            onChange={(e) => setPaymentCustomerId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Select Customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.email}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={labelStyle}>Amount (₹)</label>
          <input
            placeholder="e.g. 500"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={labelStyle}>Note</label>
          <input
            placeholder="e.g. Cash payment"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={savingPayment}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#111827",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 500,
            height: 42,
          }}
        >
          {savingPayment ? "Saving..." : "Record"}
        </button>
      </form>

      {accountsError && (
        <p style={{ color: "red" }}>{accountsError}</p>
      )}

      {/* Outstanding Balances */}
      {loadingAccounts ? (
        <p>Loading balances...</p>
      ) : accounts.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No outstanding balances.</p>
      ) : (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Customer</th>
              <th style={{ textAlign: "right", padding: 8 }}>Outstanding (₹)</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: 8 }}>{formatCustomerLabel(acc.customerId)}</td>
                <td style={{ padding: 8, textAlign: "right", fontWeight: 600, color: acc.outstandingDue > 0 ? "#dc2626" : "#16a34a" }}>
                  ₹{acc.outstandingDue.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Invoice Section */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 12 }}>Generate Invoice</h3>
        <form
          onSubmit={handleGenerateInvoice}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
            <label style={labelStyle}>Customer</label>
            <select
              value={invCustomerId}
              onChange={(e) => setInvCustomerId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— Select Customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <label style={labelStyle}>Year</label>
            <input
              placeholder="Year"
              value={invYear}
              onChange={(e) => setInvYear(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <label style={labelStyle}>Month</label>
            <select
              value={invMonth}
              onChange={(e) => setInvMonth(e.target.value)}
              style={inputStyle}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={invSaving}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              height: 42,
            }}
          >
            {invSaving ? "Generating..." : "Generate"}
          </button>
        </form>

        {invError && (
          <p style={{ color: "red", marginTop: 8 }}>{invError}</p>
        )}
      </div>
    </section>
  );
}