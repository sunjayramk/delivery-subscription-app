import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";

export default function DashboardTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // --- KPI STATE ---
  const [todayOrders, setTodayOrders] = useState(0);
  const [undeliveredOrders, setUndeliveredOrders] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0); // Subscriptions/Orders needing approval
  const [lowBalanceCount, setLowBalanceCount] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);

  useEffect(() => {
    async function loadDashboardMetrics() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        const tenantId = user.tenantId;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        // 1. Fetch Settings for Warning Limit
        const settingsSnap = await getDoc(doc(db, "tenants", tenantId, "settings", "global"));
        const warningLimit = settingsSnap.exists() ? (settingsSnap.data().warningLimit || 500) : 500;

        // 2. Fetch Orders (For Today's metrics & Monthly Sales)
        const ordersQ = query(collection(db, "tenants", tenantId, "orders"));
        const ordersSnap = await getDocs(ordersQ);
        
        let tOrders = 0;
        let uOrders = 0;
        let mSales = 0;
        let pApprovals = 0;

        ordersSnap.forEach(d => {
          const data = d.data();
          const orderTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
          
          if (orderTime >= startOfDay) {
            tOrders++;
            if (data.status !== "delivered") uOrders++;
          }
          if (orderTime >= startOfMonth && data.status === "delivered") {
            mSales += (data.totalAmount || 0);
          }
          if (data.status === "pending_approval") {
            pApprovals++;
          }
        });

        // 3. Fetch Customer Accounts (For Outstanding Debt & Low Balance)
        const accountsQ = query(collection(db, "tenants", tenantId, "customerAccounts"));
        const accountsSnap = await getDocs(accountsQ);
        
        let lowBal = 0;
        let tDebt = 0;

        accountsSnap.forEach(d => {
          const due = d.data().outstandingDue || 0;
          // In our system: positive outstandingDue means customer owes us money (Debt)
          // negative means they have prepaid credit.
          if (due > 0) tDebt += due; 
          
          // Low balance means their wallet (which is -due) is lower than the warning limit
          const walletBalance = -due; 
          if (walletBalance < warningLimit) lowBal++;
        });

        setTodayOrders(tOrders);
        setUndeliveredOrders(uOrders);
        setMonthlySales(mSales);
        setPendingApprovals(pApprovals);
        setLowBalanceCount(lowBal);
        setTotalOutstanding(tDebt);

      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardMetrics();
  }, [user]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Aggregating Live Data...</div>;

  const KpiCard = ({ title, value, subtitle, icon, color, bg }: any) => (
    <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: `1px solid ${bg}`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", display: "flex", alignItems: "flex-start", gap: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, color: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold" }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: color }}>{subtitle}</div>
      </div>
      <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: bg, opacity: 0.2, borderRadius: "50%" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>Stats Business Command Center</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Live metrics for today's operations and financial health.</p>
      </div>

      {/* TOP KPI ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 24 }}>
        <KpiCard 
          title="Today's Orders" 
          value={todayOrders} 
          subtitle="Total Dispatches" 
          icon="Package" color="#2563eb" bg="#eff6ff" 
        />
        <KpiCard 
          title="Undelivered" 
          value={undeliveredOrders} 
          subtitle="Pending on Route" 
          icon="Delivery" color="#d97706" bg="#fef3c7" 
        />
        <KpiCard 
          title="Total Outstanding" 
          value={`Rs.${totalOutstanding.toFixed(0)}`} 
          subtitle="Market Credit / Debt" 
          icon="$" color="#dc2626" bg="#fef2f2" 
        />
        <KpiCard 
          title="Low Balance" 
          value={lowBalanceCount} 
          subtitle="Customers At Risk" 
          icon="!" color="#ea580c" bg="#ffedd5" 
        />
      </div>

      {/* SECONDARY ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20 }}>
        
        {/* Sales & Approvals */}
        <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 20px 0", fontSize: 16, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>Trend Financial & Approvals</h3>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Sales This Month</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Total delivered orders</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>Rs.{monthlySales.toFixed(0)}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Pending Approvals</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Orders awaiting your review</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: pendingApprovals > 0 ? "#dc2626" : "#111827" }}>
              {pendingApprovals}
            </div>
          </div>
          
          {pendingApprovals > 0 && (
            <button style={{ width: "100%", padding: "10px", marginTop: 12, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
              Review Pending Orders
            </button>
          )}
        </div>

        {/* Quick Action Shortcuts */}
        <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 20px 0", fontSize: 16, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>Fast Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
              <span style={{ fontSize: 24 }}>Inbox</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Stock Report</span>
            </button>
            <button style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
              <span style={{ fontSize: 24 }}>List</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Generate Invoices</span>
            </button>
            <button style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
              <span style={{ fontSize: 24 }}>Delivery</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Route Dispatch</span>
            </button>
            <button style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
              <span style={{ fontSize: 24 }}>Alert</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Send Reminders</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
