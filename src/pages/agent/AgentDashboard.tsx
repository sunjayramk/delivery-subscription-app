import { useEffect, useState } from "react";
import TopBar from "../../components/common/TopBar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { createNotification } from "../../services/Notifications";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  addDoc,
  setDoc,
  increment,
} from "firebase/firestore";

import Toast from "../../components/common/Toast";
interface OrderItem {
  name: string;
  unit: string;
  price: number;
  qty: number;
}

interface DeliveryAddress {
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  mapUrl?: string;
}

interface Order {
  id: string;
  status: string;
  createdAt?: Date;
  items: OrderItem[];
  customerId: string;
  deliveryAddress?: DeliveryAddress;
  routeName?: string;
}

function formatAddress(addr: DeliveryAddress | undefined): string {
  if (!addr) return "No address";
  const parts = [
    addr.label,
    addr.line1,
    addr.area,
    addr.city,
    addr.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function AgentDashboard() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);

  const routeGroups: Record<string, Order[]> = orders.reduce(
  (acc: Record<string, Order[]>, order) => {
    const route = order.routeName || "Unassigned Route";

    if (!acc[route]) {
      acc[route] = [];
    }

    acc[route].push(order);
    return acc;
  }, {});

  const totalOrders = orders.length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  const [customerNameMap, setCustomerNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
const [toastMessage, setToastMessage] = useState("");
const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
  setToastMessage(msg);
  setToastType(type);
};

  async function loadOrders() {
    if (!user || !user.tenantId) {
      setError("No tenant assigned to this delivery agent.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1) Load customer → agent assignments for this tenant
      const assignQ = query(
       collection(db, "tenants", user.tenantId, "customerAssignments")
      );
      const assignSnap = await getDocs(assignQ);

      const assignmentMap: Record<
        string,
        { agentId?: string; routeName?: string }
      > = {};
      assignSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const customerId = data.customerId as string | undefined;
        if (!customerId) return;
        assignmentMap[customerId] = {
          agentId: data.agentId || undefined,
          routeName: data.routeName || undefined,
        };
      });

      
      // 2) Load all pending orders for this tenant
      const qOrders = query(
  collection(db, "tenants", user.tenantId, "orders"),
where("status", "==", "pending")
);

      const snap = await getDocs(qOrders);
      const list: Order[] = [];
      const customerIds = new Set<string>();

      snap.forEach((docSnap) => {
        

  const data = docSnap.data() as any;

  // 🔹 Filter only today's orders
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orderDate = data.createdAt?.toDate?.();

  if (!orderDate || orderDate < today) {
    return;
  }

  const customerId = data.customerId || "";
const assignment = assignmentMap[customerId];

        // If this customer is not assigned to this agent, skip
        if (!assignment || assignment.agentId !== user.uid) {
          return;
        }

        customerIds.add(customerId);

        list.push({
          id: docSnap.id,
          status: data.status || "pending",
          items: (data.items || []) as OrderItem[],
          customerId,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : undefined,
          deliveryAddress:
            (data.deliveryAddress as DeliveryAddress | undefined) ??
            undefined,
          routeName: assignment.routeName,
        });
      });

      const nameMap: Record<string, string> = {};

for (const cid of customerIds) {
  const userRef = doc(db, "users", cid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data() as any;
    nameMap[cid] = data.name || cid;
  } else {
    nameMap[cid] = cid;
  }
}

setCustomerNameMap(nameMap);

      // Newest first
      list.sort((a, b) => {
  // 1) sort by routeName
  const ra = (a.routeName || "").toLowerCase();
  const rb = (b.routeName || "").toLowerCase();
  if (ra < rb) return -1;
  if (ra > rb) return 1;

  // 2) then by area / pincode if available
  const aa = (a.deliveryAddress?.area || a.deliveryAddress?.pincode || "").toLowerCase();
  const ab = (b.deliveryAddress?.area || b.deliveryAddress?.pincode || "").toLowerCase();
  if (aa < ab) return -1;
  if (aa > ab) return 1;

  // 3) finally by createdAt (older first so route list is stable)
  const ta = a.createdAt?.getTime() ?? 0;
  const tb = b.createdAt?.getTime() ?? 0;
  return ta - tb;
});


      setOrders(list);
    } catch (err) {
      console.error("Error loading orders for agent", err);
      setError("Failed to load deliveries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function updateOrderStatus(
    orderId: string,
    status: "delivered" | "not_delivered"
  ) {
    if (!user) return;
    setUpdatingId(orderId);
    try {
      const ref = doc(db, "tenants", user.tenantId!, "orders", orderId);

      if (status === "delivered") {
        // Load order details
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          throw new Error("Order not found");
        }
        const data = snap.data() as any;

        const items = (data.items as any[]) ?? [];
        let total = 0;
        items.forEach((it) => {
          const price =
            typeof it.price === "number" && !Number.isNaN(it.price)
              ? it.price
              : 0;
          const qty =
            typeof it.qty === "number" && !Number.isNaN(it.qty) ? it.qty : 0;
          total += price * qty;
        });

        const tenantId = (data.tenantId as string) || user.tenantId;
        const customerId = data.customerId as string | undefined;

                if (tenantId && customerId && total > 0) {
          // 1) Add billing transaction (debit)
          await addDoc(collection(db, "tenants", user.tenantId!, "billingTransactions"), {
            tenantId,
            customerId,
            orderId,
            type: "order_charge",
            amount: total,
            note: "Auto debit for delivered order",
            createdAt: serverTimestamp(),
          });

          // 2) Update customerAccounts.outstandingDue
          const accId = `${tenantId}_${customerId}`;
          const accRef = doc(db, "tenants", user.tenantId!, "customerAccounts", accId);

          await setDoc(
            accRef,
            {
              tenantId,
              customerId,
              outstandingDue: increment(total),
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );

          // 3) Create notification for the customer
          await createNotification({
            tenantId,
            userId: customerId,
            type: "delivery",
            title: "Order delivered",
            message: `Your order (${orderId.slice(-6)}) has been delivered.`,
          });
        }


        // 3) Mark order as delivered
        await updateDoc(ref, {
          status,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Not delivered, only update status
        await updateDoc(ref, {
          status,
          updatedAt: serverTimestamp(),
        });
      }

      await loadOrders();
    } catch (err) {
      console.error("Error updating order status", err);
      showToast("Failed to update order status.", "error");
    } finally {
      setUpdatingId(null);
    }
  }
function navigateRoute(routeOrders: Order[]) {
  const firstOrder = routeOrders[0];

  if (!firstOrder?.deliveryAddress?.mapUrl) {
    showToast("No map location available for this route.", "info");
    return;
  }

  window.open(firstOrder.deliveryAddress.mapUrl, "_blank");
}

  return (
    <div>
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage("")}
        />
      )}
      <TopBar title="Delivery Agent App" />
      <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
        <h1>Today's Deliveries</h1>

<div style={{ marginBottom: 16 }}>
  <strong>Progress:</strong> {deliveredCount} / {totalOrders} completed
</div>

<p>Orders assigned to you for this store.</p>

        {error && <p style={{ color: "red" }}>{error}</p>}

        {loading ? (
  <p>Loading deliveries...</p>
) : orders.length === 0 ? (
  <p>No pending deliveries assigned to you right now.</p>
) : (
  <>
    {Object.entries(routeGroups as Record<string, Order[]>).map(
      ([route, routeOrders]) => (
        <div key={route} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
  <h2 style={{ marginTop: 20 }}>🚚 {route}</h2>

  <button
    style={{
      padding: "6px 12px",
      background: "#2563eb",
      color: "white",
      border: "none",
      borderRadius: 6,
      cursor: "pointer",
    }}
    onClick={() => navigateRoute(routeOrders)}
  >
    Navigate Route
  </button>
</div>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {routeOrders.map((o) => (
              <li
                key={o.id}
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <strong>Order #{o.id.slice(-6)}</strong>
                  <span
                    style={{ fontSize: 12, color: "#666", marginLeft: 8 }}
                  >
                    {o.createdAt ? o.createdAt.toLocaleString() : ""}
                  </span>
                </div>

                {o.routeName && (
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <strong>Route:</strong> {o.routeName}
                  </div>
                )}

                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  <strong>Customer:</strong>{" "}
                  {customerNameMap[o.customerId] || o.customerId}
                </div>

                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  <strong>Items:</strong>{" "}
                  {o.items.map((it, idx) => (
                    <span key={idx}>
                      {it.name} × {it.qty}
                      {idx < o.items.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  <strong>Address:</strong>{" "}
                  {formatAddress(o.deliveryAddress)}
                </div>

                {o.deliveryAddress?.phone && (
                  <div style={{ fontSize: 13 }}>
                    Phone:{" "}
                    <a href={`tel:${o.deliveryAddress.phone}`}>
                      {o.deliveryAddress.phone}
                    </a>
                  </div>
                )}

                {o.deliveryAddress?.mapUrl && (
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    <a
                      href={o.deliveryAddress.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                )}

                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    disabled={updatingId === o.id}
                    onClick={() =>
                      void updateOrderStatus(o.id, "delivered")
                    }
                  >
                    {updatingId === o.id
                      ? "Updating..."
                      : "Mark as Delivered"}
                  </button>

                  <button
                    disabled={updatingId === o.id}
                    onClick={() =>
                      void updateOrderStatus(o.id, "not_delivered")
                    }
                  >
                    Mark as Not Delivered
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )
    )}
  </>
)}
      </div>
    </div>
  );
}