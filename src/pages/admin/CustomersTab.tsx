import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { 
  collection, query, where, getDocs, doc, setDoc, 
  addDoc, serverTimestamp 
} from "firebase/firestore";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: Date;
  walletBalance: number;
  routeId?: string;
  routeName: string;
  status: "Active" | "Inactive";
  hasCustomDeliveryFee?: boolean;
  customDeliveryFeeAmount?: number;
}

function readDate(value: any) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchRoute, setSearchRoute] = useState("");
  const [searchStatus, setSearchStatus] = useState("All");

  // Panel State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [panelTab, setPanelTab] = useState<"settings" | "profile" | "ledger">("settings");
  
  // Deep Customer Data State
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false);
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [customerSubscriptions, setCustomerSubscriptions] = useState<any[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);

  // Settings State
  const [editRoute, setEditRoute] = useState("");
  const [walletAdjType, setWalletAdjType] = useState<"credit" | "debit">("credit");
  const [walletAdjAmount, setWalletAdjAmount] = useState("");
  const [walletAdjNote, setWalletAdjNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [hasCustomFee, setHasCustomFee] = useState(false);
  const [customFeeAmount, setCustomFeeAmount] = useState<number>(0);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addRoute, setAddRoute] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // 1. LOAD ALL CUSTOMERS (Simplified)
useEffect(() => {
  async function loadData() {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      // Fetch Routes first
      const rQ = query(collection(db, "tenants", user.tenantId, "routes"));
      const rSnap = await getDocs(rQ);
      setAvailableRoutes(rSnap.docs.map(d => ({ id: d.id, name: d.data().name })));

      // Fetch tenant users with the same simple query used by the main admin dashboard.
      // Filtering the role locally avoids needing a compound Firestore index for this tab.
      const usersQ = query(collection(db, "users"), where("tenantId", "==", user.tenantId));
      const usersSnap = await getDocs(usersQ);
      
      const rawList: Customer[] = usersSnap.docs.filter(docSnap => docSnap.data().role === "customer").map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || "Unknown",
          email: data.email || "",
          phone: data.phone || "-",
          createdAt: readDate(data.createdAt),
          walletBalance: 0, // We will calculate this when they click 'View'
          routeName: data.routeName || "Unassigned",
          status: "Active"
        };
      });

      setCustomers(rawList);
    } catch (err: any) { 
      console.error("Load Error:", err);
      setError(err?.message ? `Failed to load customer data: ${err.message}` : "Failed to load customer data."); 
    } finally { setLoading(false); }
  }
  loadData();
}, [user]);

  // 2. LOAD DEEP CUSTOMER DETAILS ON CLICK
  useEffect(() => {
    async function loadCustomerDetails() {
      if (!user?.tenantId || !selectedCustomer) return;
      setCustomerDetailsLoading(true);
      setPanelTab("settings"); // Reset tab
      try {
        const customerFilter = where("customerId", "==", selectedCustomer.id);

        // Addresses
        const addrSnap = await getDocs(query(collection(db, "tenants", user.tenantId, "addresses"), customerFilter));
        setCustomerAddresses(addrSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Subscriptions
        const subsSnap = await getDocs(query(collection(db, "tenants", user.tenantId, "subscriptions"), customerFilter));
        setCustomerSubscriptions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Transactions (Ledger)
        const txs: any[] = [];
        const wSnap = await getDocs(query(collection(db, "tenants", user.tenantId, "walletTransactions"), customerFilter));
        wSnap.forEach(d => txs.push({ id: d.id, ...d.data(), type: (d.data().type||"").toLowerCase() === "debit" ? "debit" : "credit" }));
        
        const bSnap = await getDocs(query(collection(db, "tenants", user.tenantId, "billingTransactions"), customerFilter));
        bSnap.forEach(d => {
           const rawType = (d.data().type||"").toLowerCase();
           txs.push({ id: d.id, ...d.data(), type: (rawType === "order_charge" || rawType === "debit") ? "debit" : "credit" });
        });

        txs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setCustomerTransactions(txs);

      } catch (err) { console.error("Failed to fetch deep details", err); } 
      finally { setCustomerDetailsLoading(false); }
    }
    loadCustomerDetails();

    if (selectedCustomer) {
      setEditRoute(selectedCustomer.routeName === "Unassigned" ? "" : selectedCustomer.routeName);
      setWalletAdjAmount(""); setWalletAdjNote("");
      setHasCustomFee(selectedCustomer.hasCustomDeliveryFee || false); setCustomFeeAmount(selectedCustomer.customDeliveryFeeAmount || 0);
    }
  }, [selectedCustomer?.id, user?.tenantId]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchName = c.name.toLowerCase().includes(searchName.toLowerCase());
      const matchPhone = (c.phone || "").toLowerCase().includes(searchPhone.toLowerCase());
      const matchRoute = c.routeName.toLowerCase().includes(searchRoute.toLowerCase());
      const matchStatus = searchStatus === "All" || c.status === searchStatus;
      return matchName && matchPhone && matchRoute && matchStatus;
    });
  }, [customers, searchName, searchPhone, searchRoute, searchStatus]);

  async function handleUpdateRouteAndFees() {
    if (!user?.tenantId || !selectedCustomer) return;
    setIsSaving(true);
    try {
      const selectedRouteObj = availableRoutes.find(r => r.name === editRoute);
      const newRouteId = selectedRouteObj ? selectedRouteObj.id : null;
      await setDoc(doc(db, "users", selectedCustomer.id), { routeId: newRouteId, routeName: editRoute || "Unassigned" }, { merge: true });
      await setDoc(doc(db, "tenants", user.tenantId, "customerAssignments", selectedCustomer.id), { customerId: selectedCustomer.id, routeName: editRoute || "Unassigned", hasCustomDeliveryFee: hasCustomFee, customDeliveryFeeAmount: hasCustomFee ? Number(customFeeAmount) : 0, updatedAt: serverTimestamp() }, { merge: true });
      
      const updatedCustomer = { ...selectedCustomer, routeId: newRouteId || undefined, routeName: editRoute || "Unassigned", hasCustomDeliveryFee: hasCustomFee, customDeliveryFeeAmount: hasCustomFee ? Number(customFeeAmount) : 0 };
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? updatedCustomer : c));
      setSelectedCustomer(updatedCustomer);
      alert("Settings updated successfully!");
    } catch(err) { alert("Failed to update settings."); } finally { setIsSaving(false); }
  }

  async function handleAdjustWallet() {
    if (!user?.tenantId || !selectedCustomer) return;
    const amt = Number(walletAdjAmount);
    if (!amt || amt <= 0) return alert("Enter a valid amount.");
    
    setIsSaving(true);
    try {
      const transactionData = { tenantId: user.tenantId, customerId: selectedCustomer.id, type: walletAdjType === "credit" ? "payment" : "manual_charge", amount: amt, note: walletAdjNote || (walletAdjType === "credit" ? "Manual Credit Added" : "Manual Debit/Charge"), createdAt: serverTimestamp() };
      const docRef = await addDoc(collection(db, "tenants", user.tenantId, "billingTransactions"), transactionData);

      // Optimistically update UI
      const amountChange = walletAdjType === "credit" ? -amt : amt;
      const newBalance = selectedCustomer.walletBalance + amountChange;
      
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, walletBalance: newBalance } : c));
      setSelectedCustomer({ ...selectedCustomer, walletBalance: newBalance });
      setCustomerTransactions(prev => [{ id: docRef.id, ...transactionData, type: walletAdjType === "credit" ? "credit" : "debit", createdAt: new Date() }, ...prev]);
      
      setWalletAdjAmount(""); setWalletAdjNote("");
      alert(`Successfully added Rs.${amt} ${walletAdjType} to wallet!`);
    } catch(err) { alert("Failed to adjust wallet."); } finally { setIsSaving(false); }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId) return;
    setIsAdding(true);
    try {
      const newUserId = doc(collection(db, "users")).id;
      const selectedRouteObj = availableRoutes.find(r => r.name === addRoute);
      await setDoc(doc(db, "users", newUserId), { name: addName, email: addEmail, phone: addPhone, role: "customer", tenantId: user.tenantId, createdAt: serverTimestamp(), routeId: selectedRouteObj ? selectedRouteObj.id : null, routeName: addRoute || "Unassigned" });
      await setDoc(doc(db, "tenants", user.tenantId, "customerAssignments", newUserId), { customerId: newUserId, agentId: "", routeName: addRoute || "Unassigned", hasCustomDeliveryFee: false, customDeliveryFeeAmount: 0, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });

      const newCustomer: Customer = { id: newUserId, name: addName, email: addEmail, phone: addPhone, createdAt: new Date(), walletBalance: 0, routeId: selectedRouteObj?.id || undefined, routeName: addRoute || "Unassigned", status: "Active", hasCustomDeliveryFee: false, customDeliveryFeeAmount: 0 };
      setCustomers([newCustomer, ...customers]);
      setAddName(""); setAddEmail(""); setAddPhone(""); setAddRoute(""); setShowAddModal(false);
      alert("Customer added successfully!");
    } catch (err) { alert("Failed to add user."); } finally { setIsAdding(false); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading Command Center...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .tab-btn { padding: 12px 16px; font-weight: 600; font-size: 14px; cursor: pointer; border: none; background: transparent; transition: all 0.2s; border-bottom: 2px solid transparent; color: #6b7280; }
        .tab-btn.active { color: #2563eb; border-bottom: 2px solid #2563eb; }
        .tab-btn:hover:not(.active) { color: #111827; }
      `}</style>

      {/* HEADER & TABLE (Unchanged) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div><h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>Team Customers</h1><p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Manage your user base, routes, and financials.</p></div>
        <div style={{ display: "flex", gap: 12 }}><button style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>down Export CSV</button><button onClick={() => setShowAddModal(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>+ Add User</button></div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1f2937", color: "#fff" }}>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Name</th><th style={{ padding: "12px 16px", fontWeight: 600 }}>Phone</th><th style={{ padding: "12px 16px", fontWeight: 600 }}>Balance</th><th style={{ padding: "12px 16px", fontWeight: 600 }}>Route / Overrides</th><th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th><th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "center" }}>Action</th>
            </tr>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: 8 }}><input type="text" placeholder="Search..." value={searchName} onChange={e => setSearchName(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }} /></td>
              <td style={{ padding: 8 }}><input type="text" placeholder="Phone..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }} /></td>
              <td style={{ padding: 8 }}></td>
              <td style={{ padding: 8 }}><input type="text" placeholder="Route..." value={searchRoute} onChange={e => setSearchRoute(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }} /></td>
              <td style={{ padding: 8 }}><select value={searchStatus} onChange={e => setSearchStatus(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }}><option value="All">All</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select></td>
              <td style={{ padding: 8, textAlign: "center" }}><button onClick={() => { setSearchName(""); setSearchPhone(""); setSearchRoute(""); setSearchStatus("All"); }} style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Clear</button></td>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>No customers found.</td></tr> : filteredCustomers.map((c, index) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #e5e7eb", background: index % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "12px 16px", color: "#111827", fontWeight: 500 }}>{c.name}<div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{c.email}</div></td>
                <td style={{ padding: "12px 16px", color: "#4b5563" }}>{c.phone}</td>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: c.walletBalance > 0 ? "#dc2626" : c.walletBalance < 0 ? "#16a34a" : "#4b5563" }}>{c.walletBalance > 0 ? "-" : c.walletBalance < 0 ? "+" : ""}Rs.{Math.abs(c.walletBalance).toFixed(2)}</td>
                <td style={{ padding: "12px 16px", color: "#4b5563" }}><div style={{ display: "flex", gap: 8 }}><span style={{ background: c.routeName === "Unassigned" ? "#fef2f2" : "#eff6ff", color: c.routeName === "Unassigned" ? "#dc2626" : "#2563eb", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{c.routeName}</span>{c.hasCustomDeliveryFee && <span style={{ background: "#fef08a", color: "#854d0e", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>*</span>}</div></td>
                <td style={{ padding: "12px 16px" }}><span style={{ background: c.status === "Active" ? "#dcfce7" : "#f3f4f6", color: c.status === "Active" ? "#16a34a" : "#4b5563", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{c.status}</span></td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}><button onClick={() => setSelectedCustomer(c)} style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD CUSTOMER MODAL (Unchanged) */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => !isAdding && setShowAddModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(17, 24, 39, 0.4)", backdropFilter: "blur(2px)" }}></div>
          <div style={{ position: "relative", width: 400, background: "#fff", borderRadius: 16, padding: 24, animation: "fadeIn 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h2 style={{ margin: 0, fontSize: 18 }}>Add New Customer</h2><button onClick={() => !isAdding && setShowAddModal(false)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>x</button></div>
            <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Full Name</label><input required value={addName} onChange={e => setAddName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} /></div>
              <div><label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Phone Number</label><input required type="tel" value={addPhone} onChange={e => setAddPhone(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} /></div>
              <div><label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Initial Route</label><select value={addRoute} onChange={e => setAddRoute(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}><option value="">-- Unassigned --</option>{availableRoutes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
              <button type="submit" disabled={isAdding} style={{ width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{isAdding ? "Creating..." : "Create Customer"}</button>
            </form>
          </div>
        </div>
      )}

      {/* UPGRADED SLIDE-IN 360 DASHBOARD */}
      {selectedCustomer && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={() => setSelectedCustomer(null)} style={{ position: "absolute", inset: 0, background: "rgba(17, 24, 39, 0.4)", backdropFilter: "blur(2px)" }}></div>
          <div style={{ position: "relative", width: 550, maxWidth: "100%", background: "#f9fafb", height: "100%", boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            
            {/* Header */}
            <div style={{ padding: "24px 24px 0 24px", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, color: "#111827", fontWeight: 800 }}>{selectedCustomer.name}</h2>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>ID: {selectedCustomer.id.slice(-8).toUpperCase()} | Joined: {selectedCustomer.createdAt.toLocaleDateString()}</div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} style={{ background: "#f3f4f6", border: "none", width: 32, height: 32, borderRadius: 16, cursor: "pointer", fontSize: 14, fontWeight: "bold", color: "#4b5563" }}>x</button>
              </div>
              
              {/* Internal Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
                <button className={`tab-btn ${panelTab === "settings" ? "active" : ""}`} onClick={() => setPanelTab("settings")}>Settings Settings</button>
                <button className={`tab-btn ${panelTab === "profile" ? "active" : ""}`} onClick={() => setPanelTab("profile")}>User Profile & Subs</button>
                <button className={`tab-btn ${panelTab === "ledger" ? "active" : ""}`} onClick={() => setPanelTab("ledger")}>Log Ledger</button>
              </div>
            </div>
            
            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {customerDetailsLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Fetching full 360 deg profile...</div>
              ) : (
                <>
                  {/* TAB 1: SETTINGS & WALLET */}
                  {panelTab === "settings" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 }}>Delivery Route</h3>
                        <select value={editRoute} onChange={e => setEditRoute(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, marginBottom: 16 }}>
                          <option value="">-- Unassigned --</option>
                          {availableRoutes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>

                        <div style={{ background: "#fefce8", padding: 16, borderRadius: 8, border: "1px solid #fef08a", marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasCustomFee ? 12 : 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#854d0e" }}>Override Route Fee?</span>
                            <div onClick={() => setHasCustomFee(!hasCustomFee)} style={{ width: 44, height: 24, background: hasCustomFee ? "#ca8a04" : "#d1d5db", borderRadius: 12, position: "relative", cursor: "pointer" }}>
                              <div style={{ width: 20, height: 20, background: "#fff", borderRadius: 10, position: "absolute", top: 2, left: hasCustomFee ? 22 : 2, transition: "left 0.3s" }} />
                            </div>
                          </div>
                          {hasCustomFee && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#854d0e" }}>Flat Fee: Rs.</span>
                              <input type="number" value={customFeeAmount} onChange={e => setCustomFeeAmount(Number(e.target.value))} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #fde047", fontSize: 14 }} />
                            </div>
                          )}
                        </div>
                        <button onClick={handleUpdateRouteAndFees} disabled={isSaving} style={{ width: "100%", padding: "12px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Save Route Settings</button>
                      </div>

                      <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                          <h3 style={{ margin: 0, fontSize: 14, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 }}>Manual Adjustment</h3>
                          <div style={{ fontSize: 24, fontWeight: 800, color: selectedCustomer.walletBalance > 0 ? "#dc2626" : selectedCustomer.walletBalance < 0 ? "#16a34a" : "#111827" }}>
                            {selectedCustomer.walletBalance > 0 ? "-" : selectedCustomer.walletBalance < 0 ? "+" : ""}Rs.{Math.abs(selectedCustomer.walletBalance).toFixed(2)}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", gap: 12 }}>
                            <select value={walletAdjType} onChange={e => setWalletAdjType(e.target.value as any)} style={{ width: "110px", padding: "10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: walletAdjType === "credit" ? "#f0fdf4" : "#fef2f2", color: walletAdjType === "credit" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                              <option value="credit">+ Add Credit</option><option value="debit">- Add Debt</option>
                            </select>
                            <input type="number" placeholder="Amount (Rs.)" value={walletAdjAmount} onChange={e => setWalletAdjAmount(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                          </div>
                          <input type="text" placeholder="Note (e.g. Cash Paid)" value={walletAdjNote} onChange={e => setWalletAdjNote(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                          <button onClick={handleAdjustWallet} disabled={isSaving || !walletAdjAmount} style={{ width: "100%", padding: "12px", background: walletAdjType === "credit" ? "#16a34a" : "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Apply Adjustment</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PROFILE & SUBSCRIPTIONS */}
                  {panelTab === "profile" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 }}>Contact Info</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <div><div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>PHONE</div><div style={{ fontSize: 14, fontWeight: 500 }}>{selectedCustomer.phone || "N/A"}</div></div>
                          <div><div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>EMAIL</div><div style={{ fontSize: 14, fontWeight: 500 }}>{selectedCustomer.email || "N/A"}</div></div>
                        </div>
                      </div>

                      <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 }}>Saved Addresses ({customerAddresses.length})</h3>
                        {customerAddresses.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>No addresses saved.</p> : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {customerAddresses.map(addr => (
                              <div key={addr.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, background: addr.isDefault ? "#f0fdf4" : "#fff" }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{addr.label} {addr.isDefault && <span style={{ color: "#16a34a", fontSize: 10, marginLeft: 8 }}>DEFAULT</span>}</div>
                                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{addr.line1}, {addr.area}, {addr.city} - {addr.pincode}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 }}>Active Subscriptions ({customerSubscriptions.filter(s => s.isActive).length})</h3>
                        {customerSubscriptions.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>No subscriptions found.</p> : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {customerSubscriptions.map(sub => (
                              <div key={sub.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, opacity: sub.isActive ? 1 : 0.6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.productName}</div>
                                  <span style={{ background: sub.isActive ? "#dcfce7" : "#f3f4f6", color: sub.isActive ? "#16a34a" : "#4b5563", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>{sub.isActive ? "ACTIVE" : "PAUSED"}</span>
                                </div>
                                <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>{sub.scheduleType.replace("_", " ").toUpperCase()} | {sub.qty} {sub.unit}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: LEDGER */}
                  {panelTab === "ledger" && (
                    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                      <div style={{ padding: "16px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>Transaction History</div>
                      {customerTransactions.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No transactions recorded yet.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {customerTransactions.map((tx, i) => (
                            <div key={tx.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{tx.note || (tx.type === "credit" ? "Recharge" : "Order Deduction")}</div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{tx.createdAt?.toDate?.()?.toLocaleString() || "Recent"}</div>
                              </div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: tx.type === "credit" ? "#16a34a" : "#dc2626" }}>
                                {tx.type === "credit" ? "+" : "-"}Rs.{Number(tx.amount).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
