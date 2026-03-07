// === DashboardTab.tsx === [code here]

import Card from "../../components/ui/Card";
import SectionHeader from "../../components/ui/SectionHeader";

interface Props {
  walletBalance: number;
  activeSubscriptions: number;
  totalOrders: number;
}

export default function DashboardTab({
  walletBalance,
  activeSubscriptions,
  totalOrders,
}: Props) {
  return (
    <Card>
      <SectionHeader title="Dashboard" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 13, color: "#555" }}>
            Outstanding Balance
          </div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            ₹{walletBalance.toFixed(2)}
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 13, color: "#555" }}>
            Active Subscriptions
          </div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            {activeSubscriptions}
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 13, color: "#555" }}>
            Total Orders
          </div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            {totalOrders}
          </div>
        </div>
      </div>
    </Card>
  );
}