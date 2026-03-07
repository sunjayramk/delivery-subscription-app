// === WalletTab.tsx === [code here]

import Card from "../../components/ui/Card";
import SectionHeader from "../../components/ui/SectionHeader";

interface WalletTransaction {
  id: string;
  type: "debit" | "credit";
  amount: number;
  note?: string;
  orderId?: string;
  createdAt?: Date;
}

interface Props {
  walletLoading: boolean;
  walletError: string;
  walletBalance: number;
  walletTotalBilled: number;
  walletTotalPaid: number;
  walletTx: WalletTransaction[];
}

export default function WalletTab({
  walletLoading,
  walletError,
  walletBalance,
  walletTotalBilled,
  walletTotalPaid,
  walletTx,
}: Props) {
  return (
    <Card>
      <SectionHeader title="My Wallet" />
      {walletLoading ? (
        <p>Loading wallet...</p>
      ) : walletError ? (
        <p style={{ color: "red" }}>{walletError}</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 16,
            }}
          >
            <CardWalletStatCard title="Outstanding Balance (₹)" value={walletBalance.toFixed(2)} />
            <CardWalletStatCard title="Total Billed (₹)" value={walletTotalBilled.toFixed(2)} />
            <CardWalletStatCard title="Total Paid (₹)" value={walletTotalPaid.toFixed(2)} />
          </div>

          {walletTx.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Recent Transactions</h4>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th align="left">Date</th>
                    <th align="left">Type</th>
                    <th align="right">Amount</th>
                    <th align="left">Order</th>
                    <th align="left">Note</th>
                  </tr>
                </thead>

                <tbody>
                  {walletTx.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.createdAt
                          ? t.createdAt.toLocaleString()
                          : "—"}
                      </td>

                      <td>
                        {t.type === "debit"
                          ? "Debit (Bill)"
                          : "Credit (Payment)"}
                      </td>

                      <td align="right">
                        ₹{t.amount.toFixed(2)}
                      </td>

                      <td>
                        {t.orderId ? t.orderId.slice(-6) : "—"}
                      </td>

                      <td>{t.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CardWalletStatCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "#fafafa",
          padding: 16,  
        }}
    >
      <div style={{ fontSize: 13, color: "#555" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}