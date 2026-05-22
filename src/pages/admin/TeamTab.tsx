import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db, getSecondaryAuth } from "../../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export default function TeamTab() {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form States (Add)
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("agent");

  // Form State (Edit)
  const [editRole, setEditRole] = useState("agent");

  // Role Definitions for the UI
  const ROLES: Record<string, { label: string, color: string, bg: string, desc: string }> = {
    agent: { label: "Delivery Agent", color: "#d97706", bg: "#fef3c7", desc: "Mobile app access only for deliveries." },
    view_only: { label: "View Only", color: "#4b5563", bg: "#f3f4f6", desc: "Can view dashboard and reports. Cannot edit." },
    delivery_manager: { label: "Delivery Manager", color: "#2563eb", bg: "#eff6ff", desc: "Can manage routes, hubs, and dispatch orders." },
    account_manager: { label: "Account Manager", color: "#16a34a", bg: "#dcfce7", desc: "Can manage billing, wallets, and invoices." },
    data_manager: { label: "Data Manager", color: "#9333ea", bg: "#f3e8ff", desc: "Can manage products, plans, and inventory." },
    admin: { label: "Super Admin", color: "#dc2626", bg: "#fef2f2", desc: "Full access to all settings and financial limits." }
  };

  useEffect(() => {
    async function loadTeam() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        const q = query(collection(db, "users"), where("tenantId", "==", user.tenantId));
        const snap = await getDocs(q);
        
        const list: TeamMember[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.role !== "customer") {
            list.push({
              id: d.id,
              name: data.name || "Unknown",
              email: data.email || "",
              phone: data.phone || "-",
              role: data.role || "agent",
              isActive: data.isActive !== false,
              createdAt: data.createdAt?.toDate() || new Date()
            });
          }
        });
        
        list.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
        setTeam(list);
      } catch (err) {
        console.error("Failed to load team", err);
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, [user]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.tenantId) return;
    setIsAdding(true);
    try {
      const cred = await createUserWithEmailAndPassword(getSecondaryAuth(), newEmail, newPassword);
      
      const newMemberData = {
        name: newName,
        email: newEmail,
        phone: newPhone,
        role: newRole,
        tenantId: user.tenantId,
        isActive: true,
        createdAt: serverTimestamp()
      };
      
      await setDoc(doc(db, "users", cred.user.uid), newMemberData);
      setTeam([{ id: cred.user.uid, ...newMemberData, createdAt: new Date() } as TeamMember, ...team]);
      
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewPassword(""); setNewRole("agent");
      setShowAddModal(false);
      alert("✅ Team member added successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsAdding(false);
    }
  }

  // ✅ NEW: Update an existing member's role
  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!editMember) return;
    setIsAdding(true);
    try {
      await updateDoc(doc(db, "users", editMember.id), { role: editRole });
      setTeam(team.map(t => t.id === editMember.id ? { ...t, role: editRole } : t));
      setEditMember(null);
      alert("Role updated successfully!");
    } catch (err) {
      alert("Failed to update role.");
    } finally {
      setIsAdding(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    if (!user?.tenantId) return;
    if (!window.confirm(`Are you sure you want to ${currentStatus ? "suspend" : "activate"} this account?`)) return;
    
    await updateDoc(doc(db, "users", id), { isActive: !currentStatus });
    setTeam(team.map(t => t.id === id ? { ...t, isActive: !currentStatus } : t));
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading Team Roster...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "#111827" }}>🛡️ Team & Access Control</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Manage agents and internal staff permissions.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ padding: "8px 16px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span>+</span> Add App User
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1f2937", color: "#fff" }}>
              <th style={{ padding: "12px 16px", fontWeight: 600, borderRight: "1px solid #374151" }}>Staff Member</th>
              <th style={{ padding: "12px 16px", fontWeight: 600, borderRight: "1px solid #374151" }}>Contact</th>
              <th style={{ padding: "12px 16px", fontWeight: 600, borderRight: "1px solid #374151" }}>App Role / Permissions</th>
              <th style={{ padding: "12px 16px", fontWeight: 600, borderRight: "1px solid #374151" }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {team.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>No team members found.</td></tr>
            ) : (
              team.map((t, index) => {
                const roleUI = ROLES[t.role] || ROLES["agent"];
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #e5e7eb", background: index % 2 === 0 ? "#fff" : "#f9fafb", opacity: t.isActive ? 1 : 0.5 }}>
                    <td style={{ padding: "12px 16px", borderRight: "1px solid #e5e7eb", color: "#111827", fontWeight: 600 }}>
                      {t.name}
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, fontWeight: 400 }}>ID: {t.id.slice(0, 8)}</div>
                    </td>
                    <td style={{ padding: "12px 16px", borderRight: "1px solid #e5e7eb", color: "#4b5563" }}>
                      <div>{t.email}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>{t.phone}</div>
                    </td>
                    <td style={{ padding: "12px 16px", borderRight: "1px solid #e5e7eb" }}>
                      <span style={{ background: roleUI.bg, color: roleUI.color, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                        {roleUI.label}
                      </span>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{roleUI.desc}</div>
                    </td>
                    <td style={{ padding: "12px 16px", borderRight: "1px solid #e5e7eb" }}>
                      <span style={{ background: t.isActive ? "#dcfce7" : "#fee2e2", color: t.isActive ? "#16a34a" : "#dc2626", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                        {t.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {/* ✅ EDIT BUTTON ADDED */}
                      <button onClick={() => { setEditMember(t); setEditRole(ROLES[t.role] ? t.role : "admin"); }} style={{ background: "#eff6ff", color: "#2563eb", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, marginRight: 8 }}>
                        Edit Role
                      </button>
                      
                      {t.role !== "admin" && (
                        <button onClick={() => toggleStatus(t.id, t.isActive)} style={{ background: t.isActive ? "#fee2e2" : "#dcfce7", color: t.isActive ? "#dc2626" : "#16a34a", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                          {t.isActive ? "Suspend" : "Restore"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ EDIT ROLE MODAL */}
      {editMember && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => !isAdding && setEditMember(null)} style={{ position: "absolute", inset: 0, background: "rgba(17, 24, 39, 0.4)", backdropFilter: "blur(2px)" }}></div>
          <div style={{ position: "relative", width: 400, maxWidth: "90%", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", animation: "fadeIn 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Edit Role: {editMember.name}</h2>
              <button onClick={() => !isAdding && setEditMember(null)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <form onSubmit={handleUpdateRole}>
              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Assign Security Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "#fff", fontWeight: 600 }}>
                  <option value="admin">⭐ Super Admin (Full Access)</option>
                  <option value="agent">🛵 Delivery Agent (Rider App Only)</option>
                  <option value="view_only">👁️ View Only (No Edits)</option>
                  <option value="delivery_manager">📦 Delivery Manager (Routes & Dispatch)</option>
                  <option value="account_manager">💰 Account Manager (Billing & Wallets)</option>
                  <option value="data_manager">📊 Data Manager (Products & Plans)</option>
                </select>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                  {ROLES[editRole]?.desc || ROLES["admin"].desc}
                </div>
              </div>
              <button type="submit" disabled={isAdding} style={{ marginTop: 16, width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: isAdding ? "not-allowed" : "pointer" }}>
                {isAdding ? "Saving..." : "Update Role"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL (Unchanged) */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => !isAdding && setShowAddModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(17, 24, 39, 0.4)", backdropFilter: "blur(2px)" }}></div>
          
          <div style={{ position: "relative", width: 450, maxWidth: "90%", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", animation: "fadeIn 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Create App User</h2>
              <button onClick={() => !isAdding && setShowAddModal(false)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            
            <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Full Name</label><input required type="text" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} placeholder="John Doe" /></div>
                <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Phone</label><input required type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} placeholder="+91 98765..." /></div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Login Email</label><input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} placeholder="john@company.com" /></div>
                <div style={{ flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Login Password</label><input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} placeholder="Minimum 6 chars" /></div>
              </div>
              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Assign Security Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "#fff", fontWeight: 600 }}>
                  <option value="agent">🛵 Delivery Agent (Rider App Only)</option>
                  <option value="view_only">👁️ View Only (No Edits)</option>
                  <option value="delivery_manager">📦 Delivery Manager (Routes & Dispatch)</option>
                  <option value="account_manager">💰 Account Manager (Billing & Wallets)</option>
                  <option value="data_manager">📊 Data Manager (Products & Plans)</option>
                  <option value="admin">⭐ Super Admin</option>
                </select>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                  {ROLES[newRole]?.desc || ROLES["admin"].desc}
                </div>
              </div>
              <button type="submit" disabled={isAdding || !newName || !newEmail || newPassword.length < 6} style={{ marginTop: 8, width: "100%", padding: "12px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: isAdding ? "not-allowed" : "pointer" }}>
                {isAdding ? "Creating User..." : "Create App User"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}