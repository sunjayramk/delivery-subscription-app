// This page is for platform_super_admin to manage tenants (stores) and see global analytics.

import { useEffect, useState } from "react";
import TopBar from "../../components/common/TopBar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getCountFromServer
} from "firebase/firestore";

import Toast from "../../components/common/Toast";

interface TenantRow {
  id: string;
  name: string;
  code: string;
  city?: string;
  isActive: boolean;
  totalOrders: number;
  totalCustomers: number;
}

export default function PlatformDashboard() {
  const { user } = useAuth();

  const [rows, setRows] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create-tenant form state (from old version)
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
  };

  // ===== Load tenants + basic stats =====
  // ===== Load tenants + basic stats =====
  async function loadData() {
    // Only platform_super_admin can see this
    if (!user || user.role !== "platform_super_admin") {
      setError("Access denied. This page is only for platform_super_admin.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const tenantsSnap = await getDocs(collection(db, "tenants"));
      const tempRows: TenantRow[] = [];

      for (const tDoc of tenantsSnap.docs) {
        const data = tDoc.data() as any;
        const tenantId = tDoc.id;

        // ✅ NEW LOGIC: Fast, cheap server-side counting
        const ordersQuery = query(collection(db, "tenants", tenantId, "orders"));
        const ordersCountSnap = await getCountFromServer(ordersQuery);

        const customersQuery = query(
          collection(db, "users"),
          where("tenantId", "==", tenantId),
          where("role", "==", "customer")
        );
        const customersCountSnap = await getCountFromServer(customersQuery);

        tempRows.push({
          id: tenantId,
          name: data.name || "",
          code: data.code || "",
          city: data.city || "",
          isActive: data.isActive ?? true,
          totalOrders: ordersCountSnap.data().count,       // Pulls the count integer
          totalCustomers: customersCountSnap.data().count, // Pulls the count integer
        });
      }

      setRows(tempRows);
    } catch (err) {
      console.error("Failed to load tenants for platform dashboard", err);
      setError("Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ===== Create new tenant (old feature restored) =====
  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!name.trim() || !code.trim() || !adminEmail.trim()) {
  setFormError("Name, code and admin email are required");
  return;
}

    if (!user || user.role !== "platform_super_admin") {
      setFormError("Only platform_super_admin can create tenants.");
      return;
    }

    setSaving(true);
    try {
  await addDoc(collection(db, "tenants"), {
    name: name.trim(),
    code: code.trim(),
    city: city.trim(),
    adminEmail: adminEmail.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
  

  setName("");
  setCode("");
  setCity("");
  setAdminEmail("");

  await loadData();
} catch (err) {
  console.error("Error creating tenant", err);
  setFormError("Failed to create tenant");
} finally {
  setSaving(false);
}
  }

  // ===== Toggle tenant active/inactive =====
  async function toggleTenantActive(id: string, current: boolean) {
    try {
      await updateDoc(doc(db, "tenants", id), { isActive: !current });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !current } : r))
      );
    } catch (err) {
      console.error("Failed to update tenant status", err);
      showToast("Failed to update tenant status.", "error");
    }
  }

  if (loading) {
    return (
      <div>
        {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage("")}
        />
      )}
        <TopBar title="Platform Super Admin" />
        <div style={{ padding: 24 }}>Loading tenants...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <TopBar title="Platform Super Admin" />
        <div style={{ padding: 24, color: "red" }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Platform Super Admin" />
      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1>Platform Super Admin</h1>
        <p>Manage tenants (stores) and see global analytics here.</p>

        {/* ===== Create New Tenant (restored) ===== */}
        <section style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 8 }}>Create New Tenant</h2>
          <form
            onSubmit={handleCreateTenant}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div>
              <label>Name</label>
              <input
                style={{ width: "100%", padding: 8 }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Thane Milk Hub"
              />
            </div>
            <div>
              <label>Code</label>
              <input
                style={{ width: "100%", padding: 8 }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. THANE01"
              />
            </div>
            <div>
              <label>City</label>
              <input
                style={{ width: "100%", padding: 8 }}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Thane"
              />
            </div>
            <div>
  <label>Admin Email</label>
  <input
    style={{ width: "100%", padding: 8 }}
    value={adminEmail}
    onChange={(e) => setAdminEmail(e.target.value)}
    placeholder="e.g. admin@thane.com"
  />
</div>
            <button
              type="submit"
              style={{ padding: "10px 16px", height: 42 }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Create"}
            </button>
          </form>
          {formError && (
            <p style={{ color: "red", marginTop: 8 }}>{formError}</p>
          )}
        </section>

        {/* ===== Existing Tenants + Stats (combined view) ===== */}
        <section style={{ marginTop: 32 }}>
          <h2>Existing Tenants</h2>
          {rows.length === 0 ? (
            <p>No tenants created yet.</p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 12,
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Name</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Code</th>
                  <th style={{ textAlign: "left", padding: 8 }}>City</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Customers</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Orders</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Status</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td style={{ padding: 8 }}>{t.name}</td>
                    <td style={{ padding: 8 }}>{t.code}</td>
                    <td style={{ padding: 8 }}>{t.city || "—"}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      {t.totalCustomers}
                    </td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      {t.totalOrders}
                    </td>
                    <td style={{ padding: 8 }}>
                      {t.isActive ? "Active" : "Inactive"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <button
                        onClick={() =>
                          void toggleTenantActive(t.id, t.isActive)
                        }
                      >
                        {t.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
