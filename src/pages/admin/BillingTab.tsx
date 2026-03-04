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
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Customer Billing</h2>

      {/* Payment Form */}
      <form
        onSubmit={handleRecordPayment}
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 2fr auto",
          gap: 8,
          alignItems: "end",
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        <input
          placeholder="Customer ID"
          value={paymentCustomerId}
          onChange={(e) => setPaymentCustomerId(e.target.value)}
        />

        <input
          placeholder="Amount"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
        />

        <input
          placeholder="Note"
          value={paymentNote}
          onChange={(e) => setPaymentNote(e.target.value)}
        />

        <button type="submit" disabled={savingPayment}>
          {savingPayment ? "Saving..." : "Record"}
        </button>
      </form>

      {accountsError && (
        <p style={{ color: "red" }}>{accountsError}</p>
      )}

      {loadingAccounts ? (
        <p>Loading balances...</p>
      ) : (
        <table style={{ width: "100%", marginTop: 12 }}>
          <thead>
            <tr>
              <th align="left">Customer</th>
              <th align="right">Outstanding (₹)</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id}>
                <td>{formatCustomerLabel(acc.customerId)}</td>
                <td align="right">
                  {acc.outstandingDue.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Invoice Section */}
      <div style={{ marginTop: 24 }}>
        <h3>Generate Invoice</h3>

        <form
          onSubmit={handleGenerateInvoice}
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr auto",
            gap: 8,
            alignItems: "end",
            marginTop: 8,
          }}
        >
          <input
            placeholder="Customer ID"
            value={invCustomerId}
            onChange={(e) => setInvCustomerId(e.target.value)}
          />

          <input
            placeholder="Year"
            value={invYear}
            onChange={(e) => setInvYear(e.target.value)}
          />

          <input
            placeholder="Month"
            value={invMonth}
            onChange={(e) => setInvMonth(e.target.value)}
          />

          <button type="submit" disabled={invSaving}>
            {invSaving ? "Generating..." : "Generate"}
          </button>
        </form>

        {invError && (
          <p style={{ color: "red", marginTop: 8 }}>
            {invError}
          </p>
        )}
      </div>
    </section>
  );
}