import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getLocalDateString } from "../../services/deliverySlots";
import { fetchOrdersForDeliveryDate, normalizeOrderStatus } from "../../services/deliveryOrders";

interface Agent { id: string; name: string; }
interface Route { id: string; name: string; assignedAgentId: string; zoneId?: string; }
interface CustomerRoute { routeId?: string; routeName?: string; }

interface RouteStats {
  totalCustomers: number;
  selectedDeliveries: number;
  completedCount: number;
  selectedVolume: number;
}

export default function DeliveryTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeStats, setRouteStats] = useState<Record<string, RouteStats>>({});
  const [unassignedCustomersCount, setUnassignedCustomersCount] = useState(0);
  const [unassignedOrdersCount, setUnassignedOrdersCount] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState(getLocalDateString(new Date()));
  const [selectedShift, setSelectedShift] = useState<"All" | "Morning" | "Evening">("All");

  useEffect(() => {
    async function fetchLiveDispatchData() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        const tenantId = user.tenantId;

        const [agentsSnap, routesSnap, usersSnap, assignmentsSnap, addressesSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), where("tenantId", "==", tenantId), where("role", "==", "agent"))),
          getDocs(query(collection(db, "tenants", tenantId, "routes"))),
          getDocs(query(collection(db, "users"), where("tenantId", "==", tenantId))),
          getDocs(query(collection(db, "tenants", tenantId, "customerAssignments"))),
          getDocs(query(collection(db, "tenants", tenantId, "addresses"))),
        ]);

        const agentsList: Agent[] = [];
        agentsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.isActive !== false) {
            agentsList.push({ id: docSnap.id, name: data.name || "Unnamed Agent" });
          }
        });
        setAgents(agentsList);

        const routesList: Route[] = routesSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name || "Unnamed Route",
          zoneId: docSnap.data().zoneId || undefined,
          assignedAgentId: docSnap.data().assignedAgentId || "",
        }));
        setRoutes(routesList);

        const routeByName = new Map(routesList.map((route) => [route.name, route]));
        const routeById = new Map(routesList.map((route) => [route.id, route]));
        const stats: Record<string, RouteStats> = {};
        routesList.forEach((route) => {
          stats[route.id] = { totalCustomers: 0, selectedDeliveries: 0, completedCount: 0, selectedVolume: 0 };
        });

        const customerToRouteMap: Record<string, CustomerRoute> = {};

        assignmentsSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data.customerId) return;
          const routeFromId = data.routeId ? routeById.get(data.routeId) : undefined;
          const routeFromName = data.routeName ? routeByName.get(data.routeName) : undefined;
          const route = routeFromId || routeFromName;
          customerToRouteMap[data.customerId] = {
            routeId: data.routeId || route?.id || undefined,
            routeName: data.routeName || route?.name || undefined,
          };
        });

        usersSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.role !== "customer") return;
          if (customerToRouteMap[docSnap.id]) return;
          const routeFromId = data.routeId ? routeById.get(data.routeId) : undefined;
          const routeFromName = data.routeName ? routeByName.get(data.routeName) : undefined;
          const route = routeFromId || routeFromName;
          customerToRouteMap[docSnap.id] = {
            routeId: data.routeId || route?.id || undefined,
            routeName: data.routeName || route?.name || undefined,
          };
        });

        const customersWithAddressRoute = new Set<string>();
        const routeCustomerPairs = new Set<string>();

        addressesSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data.customerId) return;
          const routeId = resolveRouteId(data.routeId, data.routeName, routeByName, stats);
          if (!routeId) return;

          customersWithAddressRoute.add(data.customerId);
          const pairKey = `${routeId}_${data.customerId}`;
          if (!routeCustomerPairs.has(pairKey)) {
            routeCustomerPairs.add(pairKey);
            stats[routeId].totalCustomers += 1;
          }

          customerToRouteMap[data.customerId] = {
            routeId: data.routeId || routeId,
            routeName: data.routeName || statsRouteName(routeId, routesList),
          };
        });

        let missingRouteCustomers = 0;
        Object.entries(customerToRouteMap).forEach(([customerId, mapping]) => {
          if (customersWithAddressRoute.has(customerId)) return;
          const routeId = resolveRouteId(mapping.routeId, mapping.routeName, routeByName, stats);
          if (routeId) {
            stats[routeId].totalCustomers += 1;
          } else {
            missingRouteCustomers += 1;
          }
        });
        setUnassignedCustomersCount(missingRouteCustomers);

        const orders = await fetchOrdersForDeliveryDate(tenantId, selectedDateStr);
        const ordersForShift = selectedShift === "All" ? orders : orders.filter((order) => order.computedShift === selectedShift);
        let missingRouteOrders = 0;

        ordersForShift.forEach((order) => {
          const mappedRoute = customerToRouteMap[order.customerId] || {};
          const addressRoute = order.deliveryAddress || {};
          const routeId = resolveRouteId(
            order.routeId || addressRoute.routeId || mappedRoute.routeId,
            order.routeName || addressRoute.routeName || mappedRoute.routeName,
            routeByName,
            stats
          );

          if (!routeId) {
            missingRouteOrders += 1;
            return;
          }

          const itemsCount = (order.items || []).reduce((sum: number, item: any) => sum + Number(item.qty || 1), 0);
          stats[routeId].selectedDeliveries += 1;
          stats[routeId].selectedVolume += itemsCount;

          const status = normalizeOrderStatus(order.status);
          if (status === "delivered" || status === "cancelled") {
            stats[routeId].completedCount += 1;
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

    void fetchLiveDispatchData();
  }, [selectedDateStr, selectedShift, user]);

  const handleAssignAgent = async (routeId: string, newAgentId: string) => {
    if (!user?.tenantId) return;
    setRoutes(routes.map((route) => route.id === routeId ? { ...route, assignedAgentId: newAgentId } : route));

    try {
      await updateDoc(doc(db, "tenants", user.tenantId, "routes", routeId), {
        assignedAgentId: newAgentId,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update agent assignment", error);
      alert("Failed to save assignment. Please try again.");
    }
  };

  const handleNotifyAgent = (agentId: string) => {
    if (!agentId) return;
    alert("Alert sent to agent app.");
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Syncing live operations...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>Delivery Live Dispatch Center</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Assign agents and track deliveries by selected date and shift.</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "#4b5563" }}>
            Delivery Date
            <input type="date" value={selectedDateStr} onChange={(event) => setSelectedDateStr(event.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "#4b5563" }}>
            Shift
            <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value as any)} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" }}>
              <option value="All">All Shifts</option>
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
            </select>
          </label>
        </div>
      </div>

      {(unassignedCustomersCount > 0 || unassignedOrdersCount > 0) && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24, color: "#d97706", fontWeight: 800 }}>!</span>
            <div>
              <h4 style={{ margin: 0, color: "#92400e", fontSize: 15 }}>Route mapping needs attention</h4>
              <p style={{ margin: "4px 0 0 0", color: "#b45309", fontSize: 13, fontWeight: 500 }}>
                {unassignedCustomersCount} customers are not assigned to a valid route.
                {unassignedOrdersCount > 0 && <strong style={{ color: "#dc2626" }}> {unassignedOrdersCount} selected orders are not linked to a valid route.</strong>}
              </p>
            </div>
          </div>
          <button style={{ background: "#d97706", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Fix in Customers
          </button>
        </div>
      )}

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
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563" }}>Selected Load</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563" }}>Assigned Agent</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563", width: "20%" }}>Live Status</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, color: "#4b5563", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => {
                const stat = routeStats[route.id] || { totalCustomers: 0, selectedDeliveries: 0, completedCount: 0, selectedVolume: 0 };
                const isComplete = stat.completedCount === stat.selectedDeliveries && stat.selectedDeliveries > 0;
                const progressPercent = stat.selectedDeliveries === 0 ? 0 : Math.round((stat.completedCount / stat.selectedDeliveries) * 100);

                return (
                  <tr key={route.id} style={{ borderBottom: "1px solid #f3f4f6", background: isComplete ? "#f0fdf4" : "#fff" }}>
                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 700, color: "#111827", fontSize: 15, marginBottom: 4 }}>{route.name}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{stat.totalCustomers} Active Customers</div>
                    </td>

                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600, color: stat.selectedDeliveries > 0 ? "#111827" : "#9ca3af" }}>
                        {stat.selectedDeliveries} Orders
                      </div>
                      <div style={{ color: stat.selectedVolume > 0 ? "#2563eb" : "#9ca3af", fontSize: 13, fontWeight: 600, marginTop: 4, background: stat.selectedVolume > 0 ? "#eff6ff" : "#f3f4f6", padding: "2px 8px", borderRadius: 12, display: "inline-block" }}>
                        {stat.selectedVolume} Items
                      </div>
                    </td>

                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <select
                        value={route.assignedAgentId}
                        onChange={(event) => handleAssignAgent(route.id, event.target.value)}
                        style={{
                          width: "100%", padding: "10px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
                          border: route.assignedAgentId ? "1px solid #d1d5db" : "2px solid #ef4444",
                          background: route.assignedAgentId ? "#fff" : "#fef2f2",
                          color: route.assignedAgentId ? "#111827" : "#ef4444",
                        }}
                      >
                        <option value="">Alert Unassigned</option>
                        {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                      </select>
                    </td>

                    <td style={{ padding: "20px", verticalAlign: "top" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6, color: isComplete ? "#16a34a" : "#4b5563" }}>
                        <span>{stat.completedCount} / {stat.selectedDeliveries}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div style={{ width: "100%", height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${progressPercent}%`, height: "100%", background: isComplete ? "#16a34a" : "#2563eb", transition: "width 0.5s ease" }} />
                      </div>
                    </td>

                    <td style={{ padding: "20px", verticalAlign: "top", textAlign: "right" }}>
                      <button disabled={!route.assignedAgentId} onClick={() => handleNotifyAgent(route.assignedAgentId)} style={{ padding: "8px 12px", background: route.assignedAgentId ? "#eff6ff" : "#f3f4f6", border: route.assignedAgentId ? "1px solid #bfdbfe" : "1px solid #e5e7eb", borderRadius: 8, cursor: route.assignedAgentId ? "pointer" : "not-allowed", color: route.assignedAgentId ? "#2563eb" : "#9ca3af", fontWeight: 700 }}>
                        Alert
                      </button>
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

function resolveRouteId(
  routeId: string | undefined,
  routeName: string | undefined,
  routeByName: Map<string, Route>,
  stats: Record<string, RouteStats>
) {
  if (routeId && stats[routeId]) return routeId;
  if (!routeName) return "";
  const route = routeByName.get(routeName);
  return route?.id && stats[route.id] ? route.id : "";
}

function statsRouteName(routeId: string, routes: Route[]) {
  return routes.find((route) => route.id === routeId)?.name || "Unassigned";
}
