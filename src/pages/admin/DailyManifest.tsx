import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

interface Subscription {
  id: string;
  customerId: string;
  customerName?: string;
  productName: string;
  unit: string;
  price: number;
  qty: number;
  scheduleType: string;
  scheduleDays?: number[];
  dayQuantities?: Record<string, number>;
  skipDates?: string[];
  vacationFrom?: string;
  vacationTo?: string;
  deliveryAddress?: any;
}

export default function DailyManifest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [oneTimeOrders, setOneTimeOrders] = useState<any[]>([]);
  
  // Default to Today's date (so it matches your dashboard instantly)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split("T")[0]);

  // Load Subscriptions AND One-Time Orders for the selected date
  // 1. Fetch ALL Subscriptions ONCE when the component opens
  useEffect(() => {
    async function fetchSubscriptions() {
      if (!user?.tenantId) return;
      try {
        const subQ = query(
          collection(db, "tenants", user.tenantId, "subscriptions"),
          where("isActive", "==", true)
        );
        const subSnap = await getDocs(subQ);
        const subs: Subscription[] = [];
        subSnap.forEach(doc => subs.push({ id: doc.id, ...doc.data() } as Subscription));
        setSubscriptions(subs);
      } catch (error) {
        console.error("Error fetching subscriptions:", error);
      }
    }
    fetchSubscriptions();
  }, [user]); // Notice selectedDateStr is NOT here! It only runs once.

  // 2. Fetch One-Time Orders EVERY TIME the date changes
  useEffect(() => {
    async function fetchDailyOrders() {
      if (!user?.tenantId) return;
      setLoading(true);
      try {
        const ordQ = query(
          collection(db, "tenants", user.tenantId, "orders"),
          where("date", "==", selectedDateStr)
        );
        const ordSnap = await getDocs(ordQ);
        const orders: any[] = [];
        ordSnap.forEach(doc => {
          const data = doc.data();
          if (data.type === "one-time" && data.status !== "cancelled") {
             orders.push({ id: doc.id, ...data });
          }
        });
        setOneTimeOrders(orders);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDailyOrders();
  }, [user, selectedDateStr]); // This only fetches that specific day's orders!
  
  // --- THE CORE LOGIC ENGINE ---
  const manifestData = useMemo(() => {
    const targetDate = new Date(selectedDateStr);
    const dayOfWeek = targetDate.getDay();
    const epochDay = Math.floor(targetDate.getTime() / (1000 * 60 * 60 * 24));
    
    const productTotals: Record<string, { unit: string; totalQty: number }> = {};
    const groupedByCustomer: Record<string, { customerName: string; address: string; items: any[] }> = {};

    // --- PART A: PROCESS SUBSCRIPTIONS ---
    subscriptions.forEach(sub => {
      if (sub.vacationFrom && sub.vacationTo && selectedDateStr >= sub.vacationFrom && selectedDateStr <= sub.vacationTo) return;
      if (sub.skipDates?.includes(selectedDateStr)) return;

      let isDelivering = false;
      let qty = sub.qty;

      if (sub.scheduleType === "daily") isDelivering = true;
      else if (sub.scheduleType === "mon_fri" && dayOfWeek >= 1 && dayOfWeek <= 5) isDelivering = true;
      else if (sub.scheduleType === "weekends" && (dayOfWeek === 0 || dayOfWeek === 6)) isDelivering = true;
      else if (sub.scheduleType === "custom" && sub.scheduleDays?.includes(dayOfWeek)) isDelivering = true;
      else if (sub.scheduleType === "alternate_days" && epochDay % 2 === 0) isDelivering = true; 

      if (isDelivering) {
        if (sub.dayQuantities && sub.dayQuantities[dayOfWeek]) {
          qty = sub.dayQuantities[dayOfWeek];
        }

        if (qty > 0) {
          // Add to Customer Packing List
          const addrString = sub.deliveryAddress ? `${sub.deliveryAddress.line1}, ${sub.deliveryAddress.area}` : "No Address Listed";
          if (!groupedByCustomer[sub.customerId]) {
            groupedByCustomer[sub.customerId] = { customerName: sub.customerName || "Customer", address: addrString, items: [] };
          }
          groupedByCustomer[sub.customerId].items.push({ productName: sub.productName, qty: qty, unit: sub.unit, type: "Sub" });

          // Add to Product Totals
          if (!productTotals[sub.productName]) {
            productTotals[sub.productName] = { unit: sub.unit, totalQty: 0 };
          }
          productTotals[sub.productName].totalQty += qty;
        }
      }
    });

    // --- PART B: PROCESS ONE-TIME CART ORDERS ---
    oneTimeOrders.forEach(order => {
      const addrString = order.deliveryAddress ? `${order.deliveryAddress.line1}, ${order.deliveryAddress.area}` : "No Address Listed";
      
      if (!groupedByCustomer[order.customerId]) {
        groupedByCustomer[order.customerId] = {
          customerName: order.customerName || "Customer",
          address: addrString,
          items: []
        };
      }

      order.items.forEach((item: any) => {
        // Add to Customer Packing List
        groupedByCustomer[order.customerId].items.push({ 
          productName: item.name, 
          qty: item.qty, 
          unit: item.unit || "unit",
          type: "One-Time" 
        });

        // Add to Product Totals
        if (!productTotals[item.name]) {
          productTotals[item.name] = { unit: item.unit || "unit", totalQty: 0 };
        }
        productTotals[item.name].totalQty += item.qty;
      });
    });

    return { productTotals, customerDeliveries: Object.values(groupedByCustomer) };
  }, [subscriptions, oneTimeOrders, selectedDateStr]);


  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontWeight: 600 }}>Syncing Today's Orders...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      
      {/* HEADER & CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #e5e7eb" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#111827" }}>Daily Delivery Manifest</h1>
          <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>Calculate procurement and packing lists automatically.</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ fontWeight: 600, color: "#374151" }}>Select Date:</label>
          <input 
            type="date" 
            value={selectedDateStr} 
            onChange={(e) => setSelectedDateStr(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15 }}
          />
          <button 
            onClick={() => window.print()}
            style={{ background: "#111827", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}
          >
            Print Manifest
          </button>
        </div>
      </div>

      {/* SECTION 1: PROCUREMENT TOTALS */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, color: "#111827", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>Package</span> Warehouse Totals
        </h2>
        {Object.keys(manifestData.productTotals).length === 0 ? (
          <div style={{ background: "#f9fafb", padding: 24, borderRadius: 12, border: "1px dashed #d1d5db", textAlign: "center", color: "#6b7280" }}>
            No deliveries scheduled for this date.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {Object.entries(manifestData.productTotals).map(([productName, data]) => (
              <div key={productName} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 600, marginBottom: 4 }}>{productName}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1d4ed8" }}>
                  {data.totalQty} <span style={{ fontSize: 14, fontWeight: 600 }}>{data.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: CUSTOMER PACKING LIST */}
      <div>
        <h2 style={{ fontSize: 18, color: "#111827", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>Delivery</span> Route Packing List
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {manifestData.customerDeliveries.map((delivery, index) => (
            <div key={index} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#111827", fontSize: 15 }}>{delivery.customerName}</div>
                <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <span>Location</span> {delivery.address}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", flex: 1 }}>
                {delivery.items.map((item, idx) => (
                  <div key={idx} style={{ background: item.type === "One-Time" ? "#fef3c7" : "#f3f4f6", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#374151", border: item.type === "One-Time" ? "1px solid #fde68a" : "1px solid #d1d5db" }}>
                    {item.qty} {item.unit} {item.productName} 
                    {item.type === "One-Time" && <span style={{ fontSize: 10, color: "#d97706", marginLeft: 4 }}>(1-Time)</span>}
                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: #fff; }
          button { display: none !important; }
          input[type="date"] { border: none; font-weight: bold; }
        }
      `}</style>
    </div>
  );
}