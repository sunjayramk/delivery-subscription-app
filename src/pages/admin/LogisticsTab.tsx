//Admin - LogisticsTab.tsx

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, doc, updateDoc } from "firebase/firestore";

interface Hub { id: string; name: string; address?: string; }
interface Zone { id: string; hubId: string; name: string; pincodes: string; }
interface Route { 
  id: string; 
  zoneId: string; 
  name: string; 
  // NEW: Route Pricing Overrides
  hasCustomDeliveryFee?: boolean; 
  customDeliveryFeeAmount?: number; 
}

export default function LogisticsTab() {
  const { user } = useAuth();
  
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Form State
  const [newHub, setNewHub] = useState("");
  const [newZone, setNewZone] = useState("");
  const [newPincodes, setNewPincodes] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // NEW: Route Editing Modal State
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editRouteName, setEditRouteName] = useState("");
  const [editRouteHasFee, setEditRouteHasFee] = useState(false);
  const [editRouteFeeAmount, setEditRouteFeeAmount] = useState<number>(0);

  useEffect(() => {
    async function loadLogistics() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        const [hubSnap, zoneSnap, routeSnap] = await Promise.all([
          getDocs(query(collection(db, "tenants", user.tenantId, "hubs"), orderBy("createdAt", "asc"))),
          getDocs(query(collection(db, "tenants", user.tenantId, "zones"), orderBy("createdAt", "asc"))),
          getDocs(query(collection(db, "tenants", user.tenantId, "routes"), orderBy("createdAt", "asc")))
        ]);

        setHubs(hubSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hub)));
        setZones(zoneSnap.docs.map(d => ({ id: d.id, ...d.data() } as Zone)));
        setRoutes(routeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));

        if (hubSnap.docs.length > 0) setSelectedHub(hubSnap.docs[0].id);
      } catch (err) {
        console.error("Failed to load logistics", err);
      } finally {
        setLoading(false);
      }
    }
    loadLogistics();
  }, [user]);

  useEffect(() => {
    if (selectedHub) {
      const hubZones = zones.filter(z => z.hubId === selectedHub);
      setSelectedZone(hubZones.length > 0 ? hubZones[0].id : null);
    } else {
      setSelectedZone(null);
    }
  }, [selectedHub, zones]);

  // Load selected route data into modal
  useEffect(() => {
    if (editingRoute) {
      setEditRouteName(editingRoute.name);
      setEditRouteHasFee(editingRoute.hasCustomDeliveryFee || false);
      setEditRouteFeeAmount(editingRoute.customDeliveryFeeAmount || 0);
    }
  }, [editingRoute]);

  async function handleAddHub(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId || !newHub.trim()) return;
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "tenants", user.tenantId, "hubs"), { name: newHub.trim(), createdAt: serverTimestamp() });
      setHubs([...hubs, { id: docRef.id, name: newHub.trim() }]);
      setNewHub(""); setSelectedHub(docRef.id);
    } finally { setIsSaving(false); }
  }

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId || !selectedHub || !newZone.trim()) return;
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "tenants", user.tenantId, "zones"), { hubId: selectedHub, name: newZone.trim(), pincodes: newPincodes.trim(), createdAt: serverTimestamp() });
      setZones([...zones, { id: docRef.id, hubId: selectedHub, name: newZone.trim(), pincodes: newPincodes.trim() }]);
      setNewZone(""); setNewPincodes(""); setSelectedZone(docRef.id);
    } finally { setIsSaving(false); }
  }

  async function handleAddRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId || !selectedZone || !newRoute.trim()) return;
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "tenants", user.tenantId, "routes"), { 
        zoneId: selectedZone, name: newRoute.trim(), createdAt: serverTimestamp(),
        hasCustomDeliveryFee: false, customDeliveryFeeAmount: 0
      });
      setRoutes([...routes, { id: docRef.id, zoneId: selectedZone, name: newRoute.trim(), hasCustomDeliveryFee: false, customDeliveryFeeAmount: 0 }]);
      setNewRoute("");
    } finally { setIsSaving(false); }
  }

  // NEW: Save Route Overrides
  async function handleUpdateRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId || !editingRoute) return;
    setIsSaving(true);
    try {
      const routeRef = doc(db, "tenants", user.tenantId, "routes", editingRoute.id);
      
      const updateData = {
        name: editRouteName.trim(),
        hasCustomDeliveryFee: editRouteHasFee,
        customDeliveryFeeAmount: editRouteHasFee ? Number(editRouteFeeAmount) : 0
      };

      await updateDoc(routeRef, updateData);
      
      setRoutes(routes.map(r => r.id === editingRoute.id ? { ...r, ...updateData } : r));
      setEditingRoute(null);
    } catch (err) {
      alert("Failed to update route settings.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Mapping Logistics Network...</div>;

  const filteredZones = zones.filter(z => z.hubId === selectedHub);
  const filteredRoutes = routes.filter(r => r.zoneId === selectedZone);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>Location Network & Logistics</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Build your delivery hierarchy: Hubs {'>'} Zones {'>'} Routes.</p>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* COLUMN 1: HUBS (Unchanged) */}
        <div style={{ flex: "1 1 300px", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ background: "#1f2937", padding: "16px", color: "#fff", fontWeight: 600 }}>1. Hubs (Warehouses)</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, minHeight: 300, maxHeight: 500, overflowY: "auto", background: "#f9fafb" }}>
            {hubs.length === 0 ? <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 20 }}>No Hubs created yet.</div> : null}
            {hubs.map(hub => (
              <div 
                key={hub.id} 
                onClick={() => setSelectedHub(hub.id)}
                style={{ padding: "12px 16px", background: selectedHub === hub.id ? "#2563eb" : "#fff", color: selectedHub === hub.id ? "#fff" : "#111827", borderRadius: 8, border: `1px solid ${selectedHub === hub.id ? "#2563eb" : "#d1d5db"}`, cursor: "pointer", fontWeight: selectedHub === hub.id ? 700 : 500, transition: "all 0.2s", boxShadow: selectedHub === hub.id ? "0 4px 12px rgba(37, 99, 235, 0.2)" : "none" }}
              >
                {hub.name}
              </div>
            ))}
          </div>
          <form onSubmit={handleAddHub} style={{ padding: 16, borderTop: "1px solid #e5e7eb", background: "#fff", display: "flex", gap: 8 }}>
            <input required type="text" placeholder="New Hub Name" value={newHub} onChange={e => setNewHub(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
            <button disabled={isSaving || !newHub} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 6, padding: "0 16px", fontWeight: 600, cursor: "pointer" }}>Add</button>
          </form>
        </div>

        {/* COLUMN 2: ZONES (Unchanged) */}
        <div style={{ flex: "1 1 300px", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", opacity: selectedHub ? 1 : 0.5, pointerEvents: selectedHub ? "auto" : "none" }}>
          <div style={{ background: "#374151", padding: "16px", color: "#fff", fontWeight: 600 }}>2. Zones (Geo-Fencing)</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, minHeight: 300, maxHeight: 500, overflowY: "auto", background: "#f9fafb" }}>
            {!selectedHub ? <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 20 }}>Select a Hub first.</div> : 
             filteredZones.length === 0 ? <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 20 }}>No Zones in this Hub.</div> : null}
            
            {filteredZones.map(zone => (
              <div 
                key={zone.id} 
                onClick={() => setSelectedZone(zone.id)}
                style={{ padding: "12px 16px", background: selectedZone === zone.id ? "#059669" : "#fff", color: selectedZone === zone.id ? "#fff" : "#111827", borderRadius: 8, border: `1px solid ${selectedZone === zone.id ? "#059669" : "#d1d5db"}`, cursor: "pointer", transition: "all 0.2s", boxShadow: selectedZone === zone.id ? "0 4px 12px rgba(5, 150, 105, 0.2)" : "none" }}
              >
                <div style={{ fontWeight: selectedZone === zone.id ? 700 : 500 }}>Map {zone.name}</div>
                {zone.pincodes && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Location Pincodes: {zone.pincodes}</div>}
              </div>
            ))}
          </div>
          <form onSubmit={handleAddZone} style={{ padding: 16, borderTop: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column", gap: 8 }}>
            <input required type="text" placeholder="New Zone Name" value={newZone} onChange={e => setNewZone(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" placeholder="Pincodes (e.g. 400091, 400092)" value={newPincodes} onChange={e => setNewPincodes(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
              <button disabled={isSaving || !newZone} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 6, padding: "0 16px", fontWeight: 600, cursor: "pointer" }}>Add</button>
            </div>
          </form>
        </div>

        {/* COLUMN 3: ROUTES (UPDATED WITH SETTINGS GEAR) */}
        <div style={{ flex: "1 1 300px", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", opacity: selectedZone ? 1 : 0.5, pointerEvents: selectedZone ? "auto" : "none" }}>
          <div style={{ background: "#4b5563", padding: "16px", color: "#fff", fontWeight: 600 }}>3. Routes (Micro-paths)</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, minHeight: 300, maxHeight: 500, overflowY: "auto", background: "#f9fafb" }}>
            {!selectedZone ? <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 20 }}>Select a Zone first.</div> : 
             filteredRoutes.length === 0 ? <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 20 }}>No Routes in this Zone.</div> : null}
            
            {filteredRoutes.map(route => (
              <div key={route.id} style={{ padding: "12px 16px", background: "#fff", color: "#111827", borderRadius: 8, border: "1px solid #d1d5db", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>Delivery</span> 
                  <span style={{ fontWeight: 600 }}>{route.name}</span>
                  {/* Show tag if route has a custom price */}
                  {route.hasCustomDeliveryFee && (
                    <span title="Route-wide delivery override" style={{ background: "#fef08a", color: "#854d0e", padding: "2px 6px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                      * Rs.{route.customDeliveryFeeAmount}
                    </span>
                  )}
                </div>
                {/* SETTINGS GEAR */}
                <button 
                  onClick={() => setEditingRoute(route)} 
                  style={{ background: "#f3f4f6", border: "none", width: 28, height: 28, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, transition: "all 0.2s" }}
                  title="Edit Route Settings"
                >
                  Settings
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddRoute} style={{ padding: 16, borderTop: "1px solid #e5e7eb", background: "#fff", display: "flex", gap: 8 }}>
            <input required type="text" placeholder="New Route Name" value={newRoute} onChange={e => setNewRoute(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
            <button disabled={isSaving || !newRoute} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 6, padding: "0 16px", fontWeight: 600, cursor: "pointer" }}>Add</button>
          </form>
        </div>
      </div>

      {/* ROUTE EDITING MODAL */}
      {editingRoute && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => !isSaving && setEditingRoute(null)} style={{ position: "absolute", inset: 0, background: "rgba(17, 24, 39, 0.4)", backdropFilter: "blur(2px)" }}></div>
          
          <div style={{ position: "relative", width: 400, maxWidth: "90%", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", animation: "fadeIn 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Route Settings</h2>
              <button onClick={() => !isSaving && setEditingRoute(null)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>x</button>
            </div>
            
            <form onSubmit={handleUpdateRoute} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Route Name</label>
                <input required type="text" value={editRouteName} onChange={e => setEditRouteName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
              </div>
              
              <div style={{ background: "#fefce8", padding: 16, borderRadius: 8, border: "1px solid #fef08a", marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editRouteHasFee ? 12 : 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#854d0e" }}>Override Global Delivery Fee?</span>
                  <div onClick={() => setEditRouteHasFee(!editRouteHasFee)} style={{ width: 44, height: 24, background: editRouteHasFee ? "#ca8a04" : "#d1d5db", borderRadius: 12, position: "relative", cursor: "pointer", transition: "background 0.3s" }}>
                    <div style={{ width: 20, height: 20, background: "#fff", borderRadius: 10, position: "absolute", top: 2, left: editRouteHasFee ? 22 : 2, transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
                  </div>
                </div>
                
                {editRouteHasFee && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#854d0e" }}>Route Flat Fee: Rs.</span>
                    <input type="number" value={editRouteFeeAmount} onChange={e => setEditRouteFeeAmount(Number(e.target.value))} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #fde047", background: "#fff", fontSize: 14 }} placeholder="0 for free" />
                  </div>
                )}
                {editRouteHasFee && <div style={{ fontSize: 11, color: "#a16207", marginTop: 8 }}>Every customer on this route will be charged this fee, unless they have a personal override.</div>}
              </div>
              
              <button type="submit" disabled={isSaving || !editRouteName} style={{ marginTop: 8, width: "100%", padding: "12px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: isSaving || !editRouteName ? "not-allowed" : "pointer", opacity: isSaving || !editRouteName ? 0.7 : 1 }}>
                {isSaving ? "Saving..." : "Save Route Settings"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}