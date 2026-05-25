import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";

interface DashboardProps {
  onOpenTab?: (tab: string) => void;
}

export default function DashboardTab({ onOpenTab }: DashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // --- KPI STATE ---
  const [todayOrders, setTodayOrders] = useState(0);
  const [undeliveredOrders, setUndeliveredOrders] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [lowBalanceCount, setLowBalanceCount] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);

  // --- UI STATE ---
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    async function loadDashboardMetrics() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        const tenantId = user.tenantId;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const settingsSnap = await getDoc(doc(db, "tenants", tenantId, "settings", "global"));
        const warningLimit = settingsSnap.exists() ? (settingsSnap.data().warningLimit || 500) : 500;

        const ordersQ = query(collection(db, "tenants", tenantId, "orders"));
        const ordersSnap = await getDocs(ordersQ);
        
        let tOrders = 0, uOrders = 0, mSales = 0, pApprovals = 0;

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
          if (data.status === "pending_approval") pApprovals++;
        });

        const accountsQ = query(collection(db, "tenants", tenantId, "customerAccounts"));
        const accountsSnap = await getDocs(accountsQ);
        
        let lowBal = 0, tDebt = 0;

        accountsSnap.forEach(d => {
          const due = d.data().outstandingDue || 0;
          if (due > 0) tDebt += due; 
          if (-due < warningLimit) lowBal++;
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

  // --- VISUAL COMPONENTS ---

  const Skeleton = () => (
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button onClick={() => onOpenTab?.("products")} className="action-btn" style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>📦</span>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Stock</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Inventory</div>
                  </div>
                </button>
                
                <button onClick={() => onOpenTab?.("billing")} className="action-btn" style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>📄</span>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Invoices</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Generate</div>
                  </div>
                </button>

                <button onClick={() => onOpenTab?.("manifest")} className="action-btn" style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>🚚</span>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Dispatch</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Manifest</div>
                  </div>
                </button>

                <button onClick={() => onOpenTab?.("billing")} className="action-btn" style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>💬</span>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Remind</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Payments</div>
                  </div>
                </button>
              </div>
  );

  const KpiCard = ({ title, value, subtitle, icon, color, bg }: any) => (
    <div className="hover-lift" style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #f3f4f6", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)", display: "flex", alignItems: "flex-start", gap: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, color: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, letterSpacing: 0.5, zIndex: 2 }}>
        {icon}
      </div>
      <div style={{ zIndex: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: color }}>{subtitle}</div>
      </div>
      <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: bg, opacity: 0.3, borderRadius: "50%", zIndex: 1 }} />
    </div>
  );

  const deliveredOrders = todayOrders - undeliveredOrders;
  const deliveryProgress = todayOrders === 0 ? 0 : (deliveredOrders / todayOrders) * 100;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      
      {/* INJECTED CSS FOR PREMIUM ANIMATIONS */}
      <style>{`
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: default; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
        .action-btn { transition: all 0.2s ease; }
        .action-btn:hover { background: #f3f4f6 !important; border-color: #d1d5db !important; transform: scale(1.02); }
        @keyframes shimmer { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        .shimmer-card { animation: shimmer 1.5s infinite; }
      `}</style>

      {/* HEADER WITH TIME GREETING */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 28, color: "#111827", fontWeight: 800 }}>
          {greeting}, {user?.name?.split(" ")[0] || "Admin"}! 👋
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 15 }}>Here is what's happening with your store today.</p>
      </div>

      {/* LOADING STATE VS LIVE DATA */}
      {loading ? <Skeleton /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 24 }}>
            <KpiCard title="Today's Orders" value={todayOrders} subtitle="Total Dispatches" icon="ORD" color="#2563eb" bg="#eff6ff" />
            <KpiCard title="Undelivered" value={undeliveredOrders} subtitle="Pending on Route" icon="DEL" color="#d97706" bg="#fef3c7" />
            <KpiCard title="Outstanding" value={`Rs.${totalOutstanding.toFixed(0)}`} subtitle="Market Credit / Debt" icon="Rs" color="#dc2626" bg="#fef2f2" />
            <KpiCard title="Low Balance" value={lowBalanceCount} subtitle="Customers At Risk" icon="LOW" color="#ea580c" bg="#ffedd5" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20 }}>
            
            {/* VISUAL OPERATIONS CARD */}
            <div className="hover-lift" style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #f3f4f6", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
              <h3 style={{ margin: "0 0 20px 0", fontSize: 16, color: "#111827" }}>Daily Operations Progress</h3>
              
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>Deliveries Completed</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: deliveryProgress === 100 ? "#16a34a" : "#2563eb" }}>
                  {deliveredOrders} / {todayOrders}
                </span>
              </div>
              
              {/* CSS PROGRESS BAR */}
              <div style={{ width: "100%", height: 12, background: "#f3f4f6", borderRadius: 6, overflow: "hidden", marginBottom: 24 }}>
                <div style={{ width: `${deliveryProgress}%`, height: "100%", background: deliveryProgress === 100 ? "#16a34a" : "#2563eb", borderRadius: 6, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderTop: "1px solid #f3f4f6" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Sales This Month</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Delivered orders only</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>Rs.{monthlySales.toFixed(0)}</div>
              </div>
            </div>

            {/* QUICK ACTIONS & ALERTS */}
            <div className="hover-lift" style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #f3f4f6", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>Quick Actions</h3>
                {pendingApprovals > 0 && (
                  <span style={{ background: "#fef2f2", color: "#dc2626", padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                    {pendingApprovals} Pending Approvals
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { title: "Stock", sub: "Inventory", icon: "📦" },
                  { title: "Invoices", sub: "Generate", icon: "📄" },
                  { title: "Dispatch", sub: "Manifest", icon: "🚚" },
                  { title: "Remind", sub: "Payments", icon: "💬" }
                ].map(action => (
                  <button key={action.title} className="action-btn" style={{ padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24 }}>{action.icon}</span>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{action.title}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>{action.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}