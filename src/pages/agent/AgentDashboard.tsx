import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, getDoc, addDoc, setDoc, increment } from "firebase/firestore";
import Toast from "../../components/common/Toast";

// --- HELPERS ---
function formatAddress(addr: any): string {
  if (!addr) return "No address";
  return [addr.label, addr.line1, addr.area, addr.city, addr.pincode].filter(Boolean).join(", ");
}

function getLocalDateString(date: Date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

function generateDates() {
  const dates = [];
  for (let i = -2; i <= 2; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(getLocalDateString(d));
  }
  return dates;
}

function shiftOrder(shift?: string) {
  if (shift === "Morning") return 1;
  if (shift === "Evening") return 2;
  return 3;
}

const CANCELLATION_REASONS = [
  "Customer not available",
  "Door locked",
  "Customer requested cancellation",
  "Address issue",
  "Payment issue",
  "Product unavailable",
  "Other",
];

export default function AgentDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"route" | "summary" | "profile">("route");
  const [routeView, setRouteView] = useState<"pending" | "completed" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  // --- SETTINGS & PERMISSIONS ---
  const [agentSettings, setAgentSettings] = useState({
    agentCanEditQty: false, allowRiderCalling: true, agentCanCollectCash: true, agentCanMarkNonDelivery: true
  });

  // --- ROUTING & DATES ---
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const availableDates = useMemo(() => generateDates(), []);
  const [debugInfo, setDebugInfo] = useState({ customers: 0, totalOrdersFound: 0 });
  const todayStr = getLocalDateString(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<"All" | "Morning" | "Evening">("All");
  const [selectedRoute, setSelectedRoute] = useState<string>("All");

  const [podFiles, setPodFiles] = useState<Record<string, File>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editedQuantities, setEditedQuantities] = useState<Record<string, Record<number, number>>>({}); 
  const [showOverdue, setShowOverdue] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const isPastDate = selectedDateStr < todayStr;

  useEffect(() => {
    async function loadAgentData() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        // 1. Fetch Global Settings
        const settingsSnap = await getDoc(doc(db, "tenants", user.tenantId, "settings", "global"));
        if (settingsSnap.exists()) {
          const d = settingsSnap.data();
          setAgentSettings({
            agentCanEditQty: d.agentCanEditQty ?? false, allowRiderCalling: d.allowRiderCalling ?? true,
            agentCanCollectCash: d.agentCanCollectCash ?? true, agentCanMarkNonDelivery: d.agentCanMarkNonDelivery ?? true
          });
        }

        // FIX 1: Only fetch THIS agent's assigned customers, not the whole store
        const assignQ = query(
          collection(db, "tenants", user.tenantId, "customerAssignments"),
          where("agentId", "==", user.uid)
        );
        const assignSnap = await getDocs(assignQ);
        
        const myCustomerIds = new Set<string>();
        const routeMap: Record<string, string> = {};
        
        assignSnap.forEach((d) => {
          const data = d.data() as any;
          if (data.customerId) {
            myCustomerIds.add(data.customerId);
            routeMap[data.customerId] = data.routeName || "Unassigned";
          }
        });

        // If this agent has no assigned customers, stop here and save database reads!
        if (myCustomerIds.size === 0) {
          setAllOrders([]);
          setDebugInfo({ customers: 0, totalOrdersFound: 0 });
          setLoading(false);
          return;
        }

        // FIX 2: Only fetch orders for the 5 dates shown in the UI slider.
        // (This prevents the app from downloading years of historical data)
        const qOrders = query(
          collection(db, "tenants", user.tenantId, "orders"), 
          where("orderDate", "in", availableDates) // 'orderDate' is what our automated script saves!
        );
        const ordersSnap = await getDocs(qOrders);
        const rawList: any[] = [];
        
        // FIX 3: Cache user names so we don't fetch the same customer's name multiple times
        const userCache: Record<string, string> = {};

        for (const docSnap of ordersSnap.docs) {
          const data = docSnap.data() as any;
          
          // Only process orders belonging to THIS agent's customers
          if (!myCustomerIds.has(data.customerId)) continue;
          // Filter out cancelled orders in memory
          if (["pending", "delivered", "not_delivered"].indexOf(data.status) === -1) continue;

          let orderDateStr = data.orderDate || data.date;
          if (!orderDateStr && data.createdAt) {
             orderDateStr = getLocalDateString(data.createdAt.toDate());
          }
          if (!orderDateStr) orderDateStr = todayStr;

          // ROLLOVER LOGIC: Move missed pending orders to today
          if (data.status === "pending" && orderDateStr < todayStr) {
             orderDateStr = todayStr;
          }

          // Fetch missing names safely and cache them
          let finalName = data.customerName;
          if (!finalName) {
            if (!userCache[data.customerId]) {
               const uSnap = await getDoc(doc(db, "users", data.customerId));
               userCache[data.customerId] = uSnap.exists() ? uSnap.data().name : "Unknown";
            }
            finalName = userCache[data.customerId];
          }

          rawList.push({ 
            id: docSnap.id, 
            ...data, 
            customerName: finalName,
            routeName: routeMap[data.customerId],
            computedDate: orderDateStr
          });
        }

        setDebugInfo({ customers: myCustomerIds.size, totalOrdersFound: rawList.length });
        setAllOrders(rawList);
        setEditedQuantities({}); 
      } catch (err) { 
        console.error("Agent Load Error:", err); 
      } finally { 
        setLoading(false); 
      }
    }
    loadAgentData();
  }, [user, availableDates, todayStr]);

  // --- FILTERING ---
  const ordersForSelectedDate = allOrders.filter(o => o.computedDate === selectedDateStr);
  const uniqueRoutes = useMemo(() => Array.from(new Set(ordersForSelectedDate.map(o => o.routeName))).filter(Boolean), [ordersForSelectedDate]);
  
  const filteredOrders = ordersForSelectedDate.filter(o => 
    (selectedShift === "All" || o.shift === selectedShift) &&
    (selectedRoute === "All" || o.routeName === selectedRoute)
  );

  const overdueOrders = useMemo(() => {
    return allOrders
      .filter(o =>
        o.status === "pending" &&
        o.computedDate < todayStr &&
        (selectedShift === "All" || o.shift === selectedShift) &&
        (selectedRoute === "All" || o.routeName === selectedRoute)
      )
      .sort((a, b) => {
        const dateCompare = String(a.computedDate || "").localeCompare(String(b.computedDate || ""));
        if (dateCompare !== 0) return dateCompare;
        const shiftCompare = shiftOrder(a.shift) - shiftOrder(b.shift);
        if (shiftCompare !== 0) return shiftCompare;
        return String(a.customerName || "").localeCompare(String(b.customerName || ""));
      });
  }, [allOrders, selectedShift, selectedRoute, todayStr]);
  
  const pendingOrders = filteredOrders.filter(o => o.status === "pending");
  const completedOrders = filteredOrders.filter(o => o.status === "delivered" || o.status === "not_delivered");
  const routeViewOrders = useMemo(() => {
    if (routeView === "pending") return pendingOrders;
    if (routeView === "completed") return completedOrders;
    return filteredOrders;
  }, [routeView, pendingOrders, completedOrders, filteredOrders]);

  // NEW: Sort orders so pending are at the top, completed at the bottom
  const sortedRouteOrders = useMemo(() => {
    return [...routeViewOrders].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return 0;
    });
  }, [routeViewOrders]);

  // --- ACTIONS ---
  const handleQtyChange = (orderId: string, itemIdx: number, delta: number, currentQty: number) => {
    if (!agentSettings.agentCanEditQty || isPastDate) return;
    setEditedQuantities(prev => {
      const orderEdits = prev[orderId] || {};
      const newQty = Math.max(0, (orderEdits[itemIdx] ?? currentQty) + delta);
      return { ...prev, [orderId]: { ...orderEdits, [itemIdx]: newQty } };
    });
  };

  async function updateOrderStatus(order: any, status: "delivered" | "not_delivered", cancellationReason?: string) {
    if (!user) return;
    setUpdatingId(order.id);
    try {
      const refDoc = doc(db, "tenants", user.tenantId!, "orders", order.id);
      let finalPodUrl = "";

      if (status === "delivered" && podFiles[order.id]) {
        const fileRef = ref(storage, `tenants/${user.tenantId}/pod/${order.id}_${Date.now()}`);
        await uploadBytes(fileRef, podFiles[order.id]);
        finalPodUrl = await getDownloadURL(fileRef);
      }

      // FIX: Added (order.items || []) so it doesn't crash on old test orders
      const finalItems = (order.items || []).map((it: any, idx: number) => {
        const editedQty = editedQuantities[order.id]?.[idx];
        return editedQty !== undefined ? { ...it, qty: editedQty } : it;
      });

      if (status === "delivered") {
        let total = finalItems.reduce((sum: number, it: any) => sum + ((it.price || 0) * (it.qty || 0)), 0);
        
        if (total > 0) {
          await addDoc(collection(db, "tenants", user.tenantId!, "billingTransactions"), { tenantId: user.tenantId, customerId: order.customerId, orderId: order.id, type: "order_charge", amount: total, createdAt: serverTimestamp() });
          await setDoc(doc(db, "tenants", user.tenantId!, "customerAccounts", `${user.tenantId}_${order.customerId}`), { outstandingDue: increment(total), updatedAt: serverTimestamp() }, { merge: true });
        }
        
        // FIX: Build the update object safely to prevent 'undefined' crashes
        const updateData: any = { 
          status, 
          items: finalItems, 
          updatedAt: serverTimestamp() 
        };
        
        if (finalPodUrl || order.podUrl) {
          updateData.podUrl = finalPodUrl || order.podUrl;
        }

        await updateDoc(refDoc, updateData);
      } else {
        await updateDoc(refDoc, { status, cancellationReason: cancellationReason || "Cancelled by agent", updatedAt: serverTimestamp() });
      }

      setPodFiles(prev => { const copy = { ...prev }; delete copy[order.id]; return copy; });
      setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status, items: finalItems, podUrl: finalPodUrl || order.podUrl, cancellationReason } : o));
      setCancelOrder(null);
      setToastMessage(status === "delivered" ? "Delivered!" : "Cancelled.");
    } catch (err: any) { 
      // FIX: Log the actual error to the console so we can debug it!
      console.error("UPDATE ORDER ERROR:", err);
      setToastMessage(err.message || "Failed to update."); 
    } finally { 
      setUpdatingId(null); 
    }
  }

  if (loading) return <div style={{ background: "#f9fafb", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#6b7280" }}>Syncing route...</div>;

  return (
    <div style={{ background: "#e5e7eb", height: "100vh", overflow: "hidden", display: "flex", justifyContent: "center" }}>
      {toastMessage && <Toast message={toastMessage} type="success" onClose={() => setToastMessage("")} />}

      <div style={{ width: "100%", maxWidth: 480, background: "#f9fafb", display: "flex", flexDirection: "column", position: "relative", height: "100%", boxShadow: "0 0 40px rgba(0,0,0,0.1)" }}>
        
        {/* HEADER */}
        <div style={{ background: "#111827", padding: "20px 16px 12px 16px", color: "#fff", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>Hi, {user?.name || "Agent"}</div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Delivery Route</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{pendingOrders.length}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>of {filteredOrders.length} Stops Left</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Assigned {debugInfo.customers} customers · {debugInfo.totalOrdersFound} orders</div>
              {selectedDateStr === todayStr && overdueOrders.length > 0 && (
                <div style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700, marginTop: 4 }}>{overdueOrders.length} overdue</div>
              )}
            </div>
          </div>

          {/* Date TIME MACHINE SLIDER */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {availableDates.map(d => {
              const isToday = d === todayStr;
              const dObj = new Date(d);
              const label = isToday ? "Today" : dObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
              return (
                <button key={d} onClick={() => setSelectedDateStr(d)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", background: selectedDateStr === d ? "#fff" : "rgba(255,255,255,0.1)", color: selectedDateStr === d ? "#111827" : "#fff", transition: "all 0.2s" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* PAST DATE WARNING */}
        {isPastDate && (
          <div style={{ background: "#fef2f2", color: "#991b1b", padding: 10, textAlign: "center", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #fecaca" }}>
            ! Viewing History (Read-Only Mode)
          </div>
        )}

        {/* SCROLLABLE CONTENT */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: 100 }}>
          
          {activeTab === "route" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* FILTERS */}
              <div style={{ display: "flex", gap: 8 }}>
                <select value={selectedShift} onChange={e => setSelectedShift(e.target.value as any)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 600, background: "#fff" }}>
                  <option value="All">All Shifts</option><option value="Morning">Morning</option><option value="Evening">Evening</option>
                </select>
                {uniqueRoutes.length > 1 && (
                  <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 600, background: "#fff" }}>
                    <option value="All">All Routes</option>
                    {uniqueRoutes.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, background: "#eef2f7", padding: 4, borderRadius: 12 }}>
                {[
                  { key: "pending", label: `Pending (${pendingOrders.length})` },
                  { key: "completed", label: `Completed (${completedOrders.length})` },
                  { key: "all", label: `All (${filteredOrders.length})` },
                ].map((item) => {
                  const isActive = routeView === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setRouteView(item.key as "pending" | "completed" | "all")}
                      style={{
                        flex: 1,
                        padding: "9px 6px",
                        borderRadius: 9,
                        border: "none",
                        background: isActive ? "#fff" : "transparent",
                        color: isActive ? "#111827" : "#6b7280",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: isActive ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {selectedDateStr === todayStr && overdueOrders.length > 0 && (
                <button
                  onClick={() => setShowOverdue(true)}
                  style={{ width: "100%", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "10px 12px", color: "#9a3412", fontSize: 13, fontWeight: 800, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span>{overdueOrders.length} overdue pending {overdueOrders.length === 1 ? "stop" : "stops"}</span>
                  <span style={{ color: "#ea580c" }}>View</span>
                </button>
              )}

              {sortedRouteOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>Finish</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {routeView === "pending" ? "No pending stops" : routeView === "completed" ? "No completed stops yet" : "No stops found"}
                  </div>
                </div>
              ) : (
                sortedRouteOrders.map((order, idx) => {
                  const isCompleted = order.status !== "pending";
                  return (
                    <div key={order.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", opacity: isCompleted ? 0.75 : 1, transition: "opacity 0.2s" }}>
                      
                      {/* Customer Header */}
                      <div style={{ padding: 16, borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ background: isCompleted ? "#9ca3af" : "#111827", color: "#fff", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{idx + 1}</span>
                            <span style={{ fontSize: 16, fontWeight: 800, color: "#111827", textDecoration: isCompleted ? "line-through" : "none" }}>{order.customerName || "Customer"}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#4b5563", paddingLeft: 32, lineHeight: 1.45 }}>{formatAddress(order.deliveryAddress)}</div>
                        </div>
                        
                        {/* Permission: Calling */}
                        {agentSettings.allowRiderCalling && order.deliveryAddress?.phone && !isCompleted && !isPastDate && (
                          <button onClick={() => window.open(`tel:${order.deliveryAddress?.phone}`)} style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", minWidth: 54, height: 34, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Call</button>
                        )}
                      </div>

                      {/* Items & Editing */}
                      <div style={{ padding: 16, background: "#f8fafc" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>Drop-off Items</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {(order.items || []).map((item: any, i: number) => {
                            const displayQty = editedQuantities[order.id]?.[i] ?? item.qty;
                            return (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 700, color: "#111827" }}>
                                <span style={{ textDecoration: isCompleted ? "line-through" : "none" }}>{item.name} <span style={{fontSize:11, color:"#6b7280", fontWeight:500}}>({item.unit})</span></span>
                                
                                {/* Permission: Edit Qty */}
                                {agentSettings.agentCanEditQty && !isPastDate && !isCompleted ? (
                                  <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
                                    <button onClick={() => handleQtyChange(order.id, i, -1, item.qty)} style={{ width: 28, height: 28, background: "#f3f4f6", border: "none", fontWeight: 800, color: "#4b5563", cursor: "pointer" }}>-</button>
                                    <div style={{ width: 30, textAlign: "center", fontSize: 13, color: displayQty !== item.qty ? "#2563eb" : "#111827" }}>{displayQty}</div>
                                    <button onClick={() => handleQtyChange(order.id, i, 1, item.qty)} style={{ width: 28, height: 28, background: "#f3f4f6", border: "none", fontWeight: 800, color: "#4b5563", cursor: "pointer" }}>+</button>
                                  </div>
                                ) : (
                                  <span style={{ color: isCompleted ? "#9ca3af" : "#2563eb" }}>x{item.qty}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions (Hidden if Completed or Past Date) */}
                      {!isCompleted && !isPastDate && (
                        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="file" accept="image/*" capture="environment" id={`pod-${order.id}`} style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) setPodFiles(prev => ({ ...prev, [order.id]: e.target.files![0] })); }} />
                            <label htmlFor={`pod-${order.id}`} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: podFiles[order.id] ? "#dcfce7" : "#f1f5f9", color: podFiles[order.id] ? "#16a34a" : "#475569", border: `1px solid ${podFiles[order.id] ? "#bbf7d0" : "#e2e8f0"}` }}>
                              {podFiles[order.id] ? "Photo ready" : "Add door photo"}
                            </label>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {agentSettings.agentCanMarkNonDelivery && (
                              <button disabled={updatingId === order.id} onClick={() => { setCancelOrder(order); setCancelReason(CANCELLATION_REASONS[0]); }} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontWeight: 700, fontSize: 14 }}>Cancel</button>
                            )}
                            <button disabled={updatingId === order.id} onClick={() => void updateOrderStatus(order, "delivered")} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 15, boxShadow: "0 4px 10px rgba(22,163,74,0.3)" }}>
                              {updatingId === order.id ? "Saving..." : "OK Delivered"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Read-Only Status Tag for Completed Orders */}
                      {isCompleted && (
                        <div style={{ padding: 12, background: order.status === "delivered" ? "#dcfce7" : "#fee2e2", textAlign: "center", fontSize: 13, fontWeight: 700, color: order.status === "delivered" ? "#166534" : "#991b1b" }}>
                          {order.status === "delivered" ? "Successfully Delivered" : `Cancelled${order.cancellationReason ? `: ${order.cancellationReason}` : ""}`}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
               <h3 style={{ fontSize: 15, margin: 0 }}>Completed on {selectedDateStr}</h3>
               {completedOrders.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>No finished stops for this date.</p> : null}
               {completedOrders.map(o => (
                  <div key={o.id} style={{ background: o.status === "delivered" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${o.status === "delivered" ? "#bbf7d0" : "#fecaca"}`, padding: 12, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: o.status === "delivered" ? "#166534" : "#991b1b", fontSize: 14 }}>{o.customerName}</div>
                      {o.podUrl && <a href={o.podUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb", marginTop: 4, display: "inline-block" }}>View photo</a>}
                    </div>
                    <div style={{ fontSize: 12, color: o.status === "delivered" ? "#15803d" : "#dc2626", fontWeight: 700 }}>{o.status === "delivered" ? "OK Done" : "Cancelled"}</div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "profile" && (
            <button onClick={() => void signOut(auth)} style={{ width: "100%", padding: 16, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Log Out</button>
          )}

        </div>

        {showOverdue && (
          <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", alignItems: "flex-end" }}>
            <div onClick={() => setShowOverdue(false)} style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.4)" }} />
            <div style={{ position: "relative", width: "100%", maxHeight: "72%", background: "#fff", borderRadius: "20px 20px 0 0", padding: 16, overflowY: "auto", boxShadow: "0 -10px 30px rgba(0,0,0,0.16)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>Overdue Pending</div>
                  <div style={{ fontSize: 12, color: "#9a3412", marginTop: 2 }}>{overdueOrders.length} older stops not counted in today's route</div>
                </div>
                <button onClick={() => setShowOverdue(false)} style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "#f3f4f6", color: "#4b5563", fontWeight: 800, cursor: "pointer" }}>x</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {overdueOrders.map((order) => (
                  <div key={order.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ color: "#111827", fontSize: 14, fontWeight: 800 }}>{order.customerName || "Customer"}</div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>{order.computedDate} · {order.shift || "No shift"}</div>
                      </div>
                      <div style={{ color: "#9a3412", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{(order.items || []).length} items</div>
                    </div>
                    <div style={{ marginTop: 8, color: "#4b5563", fontSize: 12, lineHeight: 1.4 }}>{formatAddress(order.deliveryAddress)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {cancelOrder && (
          <div style={{ position: "absolute", inset: 0, zIndex: 90, display: "flex", alignItems: "flex-end" }}>
            <div onClick={() => updatingId ? null : setCancelOrder(null)} style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.45)" }} />
            <div style={{ position: "relative", width: "100%", background: "#fff", borderRadius: "20px 20px 0 0", padding: 18, boxShadow: "0 -10px 30px rgba(0,0,0,0.16)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>Cancel Delivery</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{cancelOrder.customerName || "Customer"}</div>
                </div>
                <button disabled={!!updatingId} onClick={() => setCancelOrder(null)} style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "#f3f4f6", color: "#4b5563", fontWeight: 800, cursor: updatingId ? "not-allowed" : "pointer" }}>x</button>
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Reason</label>
              <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
                {CANCELLATION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={!!updatingId} onClick={() => setCancelOrder(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff", color: "#4b5563", fontWeight: 800, fontSize: 14, cursor: updatingId ? "not-allowed" : "pointer" }}>Back</button>
                <button disabled={!!updatingId} onClick={() => void updateOrderStatus(cancelOrder, "not_delivered", cancelReason)} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 14, cursor: updatingId ? "not-allowed" : "pointer", opacity: updatingId ? 0.75 : 1 }}>
                  {updatingId ? "Saving..." : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", zIndex: 40 }}>
          {[
            { key: "route", label: "Route" },
            { key: "summary", label: "Summary" },
            { key: "profile", label: "Profile" },
          ].map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key as "route" | "summary" | "profile")}
                style={{
                  flex: 1,
                  height: 46,
                  border: "none",
                  borderRadius: 12,
                  background: isActive ? "#eff6ff" : "#fff",
                  color: isActive ? "#2563eb" : "#6b7280",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
