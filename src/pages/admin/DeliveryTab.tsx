import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

interface Agent { id: string; name: string; }
interface Route { id: string; name: string; assignedAgentId: string; }

// Dynamic stats calculated on the fly
interface RouteStats {
  totalCustomers: number;
  todaysDeliveries: number;
  deliveredCount: number;
  todaysVolume: number;
}

export default function DeliveryTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeStats, setRouteStats] = useState<Record<string, RouteStats>>({});
  
  const [unassignedCustomersCount, setUnassignedCustomersCount] = useState(0);
  const [unassignedOrdersCount, setUnassignedOrdersCount] = useState(0);

  useEffect(() => {
    async function fetchLiveDispatchData() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        // ---------------------------------------------------------
        // 1. FETCH AGENTS (Fixed missing index issue)
        // ---------------------------------------------------------
        const agentsQ = query(collection(db, "users"), where("tenantId", "==", user.tenantId), where("role", "==", "agent"));
        const agentsSnap = await getDocs(agentsQ);
        const agentsList: Agent[] = [];
        agentsSnap.forEach(doc => {
          const data = doc.data();
          if (data.isActive !== false) { // Filter active agents in memory to avoid Firebase index error
            agentsList.push({ id: doc.id, name: data.name || "Unnamed Agent" });
          }
        });
        setAgents(agentsList);

        // ---------------------------------------------------------
        // 2. FETCH ROUTES
        // ---------------------------------------------------------
        const routesQ = query(collection(db, "tenants", user.tenantId, "routes"));
        const routesSnap = await getDocs(routesQ);
        const routesList: Route[] = routesSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name || "Unnamed Route",
          assignedAgentId: d.data().assignedAgentId || ""
        }));
        setRoutes(routesList);

        // ---------------------------------------------------------
        // 3. FETCH CUSTOMERS & BUILD ROUTE MAP
        // ---------------------------------------------------------
        const custQ = query(collection(db, "users"), where("tenantId", "==", user.tenantId), where("role", "==", "customer"));
        const custSnap = await getDocs(custQ);
        
        const customerToRouteMap: Record<string, string> = {};
        const stats: Record<string, RouteStats> = {};
        let missingRouteCustomers = 0;

        // Initialize stats for all routes
        routesList.forEach(r => {
          stats[r.id] = { totalCustomers: 0, todaysDeliveries: 0, deliveredCount: 0, todaysVolume: 0 };
        });

        custSnap.forEach(d => {
          const c = d.data();
          const rId = c.routeId;
          customerToRouteMap[d.id] = rId || "unassigned";
          
          if (rId && stats[rId]) {
            stats[rId].totalCustomers += 1;
          } else {
            missingRouteCustomers += 1;
          }
        });
        setUnassignedCustomersCount(missingRouteCustomers);

        // ---------------------------------------------------------
        // 4. FETCH TODAY'S ORDERS & CALCULATE LIVE PROGRESS
        // ---------------------------------------------------------
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const ordersQ = query(collection(db, "tenants", user.tenantId, "orders"), where("date", "==", todayStr));
        const ordersSnap = await getDocs(ordersQ);
        
        let missingRouteOrders = 0;

        ordersSnap.forEach(d => {
          const order = d.data();
          const rId = customerToRouteMap[order.customerId];

          // Calculate items in this order
          let itemsCount = 0;
          (order.items || []).forEach((item: any) => itemsCount += (item.qty || 1));

          if (rId && stats[rId]) {
            stats[rId].todaysDeliveries += 1;
            stats[rId].todaysVolume += itemsCount;
            if (order.status === "delivered") {
              stats[rId].deliveredCount += 1;
            }
          } else {
            missingRouteOrders += 1;
          }
        });
        
        setUnassignedOrdersCount(missingRouteOrders);
        setRouteStats(stats);

      } catch (error) {
        console.error("Error fetching live data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveDispatchData();
  }, [user]);

  const handleAssignAgent = async (routeId: string, newAgentId: string) => {
    // Tell TypeScript: "If the user somehow isn't logged in, stop here."
    if (!user?.tenantId) return;

    // Optimistic UI update
    setRoutes(routes.map(r => r.id === routeId ? { ...r, assignedAgentId: newAgentId } : r));
    
    try {
      await updateDoc(doc(db, "tenants", user.tenantId, "routes", routeId), {
        assignedAgentId: newAgentId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to update agent assignment", error);
      alert("Failed to save assignment. Please try again.");
    }
  };

  const handleNotifyAgent = (agentId: string) => {
    if (!agentId) return;
    alert("🔔 Pinged Agent App!");
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Syncing Live Operations...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>🚚 Live Dispatch Center</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Assign agents and track today's live deliveries.</p>
      </div>

      {/* 🚨 UNASSIGNED WARNINGS */}
      {(unassignedCustomersCount > 0 || unassignedOrdersCount > 0) && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <h4 style={{ margin: 0, color: "#92400e", fontSize: 15 }}>Unassigned Customers Detected</h4>
              <p style={{ margin: "4px 0 0 0", color: "#b45309", fontSize: 13, fontWeight: 500 }}>
                {unassignedCustomersCount} customers are not assigned to a route. 
                {unassignedOrdersCount > 0 && <strong style={{color:"#dc2626"}}> {unassignedOrdersCount} of today's orders are orphaned!</strong>}
              </p>
            </div>
          </div>
          <button style={{ background: "#d97706", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Fix in Customers Tab
          </button>
        </div>
      )}

      {/* 📋 LIVE ROUTE TABLE */}
      {routes.length === 0 ? (
        <div style={{ background: "#fff", padding: 40, textAlign: "center", borderRadius: 16, border: "1px dashed #d1d5db" }}>
          <p style={{ color: "#6b7280", fontSize: 15 }}>No routes found. Please create them in the Logistics tab.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563" }}>Route Details</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563" }}>Today's Load</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563" }}>Assigned Agent</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563", width: "20%" }}>Live Status</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => {
                const stat = routeStats[route.id] || { totalCustomers: 0, todaysDeliveries: 0, deliveredCount: 0, todaysVolume: 0 };
                const isComplete = stat.deliveredCount === stat.todaysDeliveries && stat.todaysDeliveries > 0;
                const progressPercent = stat.todaysDeliveries === 0 ? 0 : Math.round((stat.deliveredCount / stat.todaysDeliveries) * 100);
                
                return (
                  <tr key={route.id} style={{ borderBottom: "1px solid #f3f4f6", background: isComplete ? "#f0fdf4" : "#fff" }}>
                    
                    {/* Route Info */}
                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 700, color: "#111827", fontSize: 15, marginBottom: 4 }}>{route.name}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{stat.totalCustomers} Active Customers</div>
                    </td>

                    {/* Load Info */}
                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600, color: stat.todaysDeliveries > 0 ? "#111827" : "#9ca3af" }}>
                        {stat.todaysDeliveries} Orders
                      </div>
                      <div style={{ color: stat.todaysVolume > 0 ? "#2563eb" : "#9ca3af", fontSize: 13, fontWeight: 600, marginTop: 4, background: stat.todaysVolume > 0 ? "#eff6ff" : "#f3f4f6", padding: "2px 8px", borderRadius: 12, display: "inline-block" }}>
                        {stat.todaysVolume} Items
                      </div>
                    </td>

                    {/* Agent Dropdown */}
                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <select 
                        value={route.assignedAgentId}
                        onChange={(e) => handleAssignAgent(route.id, e.target.value)}
                        style={{ 
                          width: "100%", padding: "10px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
                          border: route.assignedAgentId ? "1px solid #d1d5db" : "2px solid #ef4444",
                          background: route.assignedAgentId ? "#fff" : "#fef2f2",
                          color: route.assignedAgentId ? "#111827" : "#ef4444"
                        }}
                      >
                        <option value="">🚨 Unassigned</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>

                    {/* Progress Bar */}
                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6, color: isComplete ? "#16a34a" : "#4b5563" }}>
                        <span>{stat.deliveredCount} / {stat.todaysDeliveries}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div style={{ width: "100%", height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${progressPercent}%`, height: "100%", background: isComplete ? "#16a34a" : "#2563eb", transition: "width 0.5s ease" }} />
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "20px", verticalAlign: "top", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button disabled={!route.assignedAgentId} onClick={() => handleNotifyAgent(route.assignedAgentId)} style={{ padding: "8px", background: route.assignedAgentId ? "#eff6ff" : "#f3f4f6", border: route.assignedAgentId ? "1px solid #bfdbfe" : "1px solid #e5e7eb", borderRadius: 8, cursor: route.assignedAgentId ? "pointer" : "not-allowed", color: route.assignedAgentId ? "#2563eb" : "#9ca3af" }}>
                          🔔
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}