//Admin - BillingTab.tsx

import React from "react";

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
  invDeliveryCharge: string;
  invSaving: boolean;
  invError: string;
  setPaymentCustomerId: (v: string) => void;
  setPaymentAmount: (v: string) => void;
  setPaymentNote: (v: string) => void;
  setInvCustomerId: (v: string) => void;
  setInvYear: (v: string) => void;
  setInvMonth: (v: string) => void;
  setInvDeliveryCharge: (v: string) => void;
  handleRecordPayment: (e: React.FormEvent) => void;
  handleGenerateInvoice: (e: React.FormEvent) => void;
  formatCustomerLabel: (id: string) => string;
  handleWhatsAppReminder: (customerId: string, balance: number) => void;
  customers: any[];
  invoices: any[];
  loadingInvoices: boolean;
  // NEW PROPS FOR OUR 3 NEW BUTTONS
  handlePrintInvoice: (inv: any) => void;
  handleWhatsAppInvoice: (inv: any) => void;
  handlePayInvoice: (inv: any) => void;
}

const MONTHS = [
  { value: "1", label: "January" }, { value: "2", label: "February" },
  { value: "3", label: "March" }, { value: "4", label: "April" },
  { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" },
  { value: "9", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];

export default function BillingTab({
  cardStyle, accounts, loadingAccounts, accountsError,
  paymentCustomerId, paymentAmount, paymentNote, savingPayment,
  invCustomerId, invYear, invMonth, invDeliveryCharge, invSaving, invError,
  setPaymentCustomerId, setPaymentAmount, setPaymentNote,
  setInvCustomerId, setInvYear, setInvMonth, setInvDeliveryCharge,
  handleRecordPayment, handleGenerateInvoice, formatCustomerLabel,
  handleWhatsAppReminder, customers, invoices, loadingInvoices,
  handlePrintInvoice, handleWhatsAppInvoice, handlePayInvoice // Destructure them here
}: BillingTabProps) {

  const inputStyle: React.CSSProperties = { padding: "8px", borderRadius: "6px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" };
  const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: "12px" };
  const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "2px solid #ddd", padding: "8px" };
  const tdStyle: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "8px" };

  const actionBtnStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid #ddd", padding: "4px 8px", borderRadius: "6px", 
    cursor: "pointer", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px", marginRight: "6px"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* --- Section 1: Record Payment & Outstanding Table --- */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>$ Customer Billing</h3>
        <h4 style={{ margin: "16px 0 8px" }}>Record Payment</h4>
        <form onSubmit={handleRecordPayment} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 2, minWidth: "200px" }}>
            <label style={labelStyle}>Customer</label>
            <select value={paymentCustomerId} onChange={(e) => setPaymentCustomerId(e.target.value)} style={inputStyle}>
              <option value="">- Select Customer -</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "120px" }}>
            <label style={labelStyle}>Amount (Rs.)</label>
            <input type="number" placeholder="e.g. 500" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 2, minWidth: "150px" }}>
            <label style={labelStyle}>Note</label>
            <input placeholder="e.g. Cash payment" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} style={inputStyle} />
          </div>
          <button type="submit" disabled={savingPayment} style={{ padding: "9px 20px", borderRadius: "6px", border: "none", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 500, height: "35px" }}>
            {savingPayment ? "..." : "Record"}
          </button>
        </form>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Customer</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Outstanding (Rs.)</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingAccounts ? (
                <tr><td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#666" }}>Loading balances...</td></tr>
              ) : accountsError ? (
                <tr><td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "red" }}>{accountsError}</td></tr>
              ) : !accounts || accounts.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#666" }}>No balances found.</td></tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td style={tdStyle}>{formatCustomerLabel(acc.customerId)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: acc.outstandingDue > 0 ? "#dc2626" : "#16a34a", fontWeight: 500 }}>
                      Rs.{acc.outstandingDue?.toFixed(2) || "0.00"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {acc.outstandingDue > 0 && (
                        <button onClick={() => handleWhatsAppReminder(acc.customerId, acc.outstandingDue)} style={{ background: "#fff", border: "1px solid #22c55e", color: "#22c55e", padding: "4px 12px", borderRadius: "16px", cursor: "pointer", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          WhatsApp
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Section 2: Generate Invoice --- */}
      <div style={cardStyle}>
        <h4 style={{ margin: "0 0 16px 0" }}>Generate Invoice</h4>
        <form onSubmit={handleGenerateInvoice} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 2, minWidth: "180px" }}>
            <label style={labelStyle}>Customer</label>
            <select value={invCustomerId} onChange={(e) => setInvCustomerId(e.target.value)} style={inputStyle}>
              <option value="">- Select Customer -</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "100px" }}>
            <label style={labelStyle}>Year</label>
            <input type="number" value={invYear} onChange={(e) => setInvYear(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "120px" }}>
            <label style={labelStyle}>Month</label>
            <select value={invMonth} onChange={(e) => setInvMonth(e.target.value)} style={inputStyle}>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "120px" }}>
            <label style={labelStyle}>Delivery Fee (Rs.)</label>
            <input type="number" placeholder="e.g. 50" value={invDeliveryCharge} onChange={(e) => setInvDeliveryCharge(e.target.value)} style={inputStyle} />
          </div>
          <button type="submit" disabled={invSaving} style={{ padding: "9px 20px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 500, height: "35px" }}>
            {invSaving ? "..." : "Generate"}
          </button>
        </form>
        {invError && <p style={{ color: "red", fontSize: "13px", marginTop: "12px" }}>{invError}</p>}
      </div>

      {/* --- Section 3: Recent Invoices Table --- */}
      <div style={cardStyle}>
        <h4 style={{ margin: "0 0 16px 0" }}>Recent Generated Invoices</h4>
        {loadingInvoices ? (
          <p style={{ fontSize: "14px", color: "#666" }}>Loading invoices...</p>
        ) : !invoices || invoices.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#666" }}>No invoices generated yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Period</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={tdStyle}>{inv.createdAt?.toLocaleDateString() || "N/A"}</td>
                    <td style={tdStyle}>{formatCustomerLabel(inv.customerId)}</td>
                    <td style={tdStyle}>{MONTHS.find(m => m.value === String(inv.periodMonth))?.label} {inv.periodYear}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>Rs.{inv.closingBalance}</td>
                    <td style={{ ...tdStyle, textAlign: "center", minWidth: "200px" }}>
                      <button onClick={() => handlePrintInvoice(inv)} style={actionBtnStyle}>Print</button>
                      <button onClick={() => handleWhatsAppInvoice(inv)} style={{...actionBtnStyle, color: "#16a34a", borderColor: "#16a34a"}}>WA</button>
                      <button onClick={() => handlePayInvoice(inv)} style={{...actionBtnStyle, background: "#111827", color: "#fff", borderColor: "#111827"}}>Pay</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}