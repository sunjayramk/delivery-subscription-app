import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

// 1. Clean Initialization (Run only once)
if (!admin.apps.length) {
  admin.initializeApp(); 
}
const db = admin.firestore();

// ============================================================================
// AUTOMATION 1: MONTHLY BILLING (Runs at Midnight on the 1st of every month)
// ============================================================================
export const autoGenerateMonthlyInvoices = onSchedule(
  {
    schedule: "0 0 1 * *", // 1st of every month at 00:00
    timeZone: "Asia/Kolkata",
  },
  async (event) => {
    try {
      const now = new Date();
      // If it is running on May 1st, we are billing for April (Month 4)
      let year = now.getFullYear();
      let month = now.getMonth(); // getMonth() is 0-indexed (May = 4, which is perfect for April billing)
      if (month === 0) { month = 12; year -= 1; } // Handle January rollbacks to December

      console.log(`Starting automated billing for ${month}/${year}`);

      // 1. Find every active Store (Tenant)
      const tenantsSnap = await db.collection("tenants").where("isActive", "==", true).get();

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;

        // 2. Find all customers for this store
        const usersSnap = await db.collection("users")
          .where("tenantId", "==", tenantId)
          .where("role", "==", "customer")
          .get();

        // 3. Calculate and generate the invoice for each customer
        for (const userDoc of usersSnap.docs) {
          const customerId = userDoc.id;
          
          const start = admin.firestore.Timestamp.fromDate(new Date(year, month - 1, 1));
          const end = admin.firestore.Timestamp.fromDate(new Date(year, month, 1));

          // Get their billing transactions
          const txQ = await db.collection("tenants").doc(tenantId).collection("billingTransactions")
            .where("customerId", "==", customerId)
            .where("createdAt", ">=", start)
            .where("createdAt", "<", end)
            .get();

          let totalDebits = 0;
          let totalCredits = 0;

          txQ.forEach((docSnap) => {
            const data = docSnap.data();
            const type = (data.type || "").toString().toLowerCase();
            const amount = typeof data.amount === "number" ? data.amount : 0;
            if (type === "order_charge" || type === "debit") { totalDebits += amount; } 
            else { totalCredits += amount; }
          });

          const closingBalance = totalDebits - totalCredits;

          // Skip if there is absolutely zero activity and zero balance
          if (totalDebits === 0 && totalCredits === 0 && closingBalance === 0) continue;

          // Save the generated invoice to the database
          await db.collection("tenants").doc(tenantId).collection("invoices").add({
            tenantId,
            customerId,
            periodYear: year,
            periodMonth: month,
            deliveryCharge: 0, 
            totalDebits,
            totalCredits,
            closingBalance,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      console.log("Automated monthly billing complete!");
    } catch (error) {
      console.error("Billing Automation Error:", error);
    }
  }
);


// ============================================================================
// AUTOMATION 2: DAILY ORDERS (Your existing code!)
// ============================================================================

// Helper: should this subscription run on a specific date?
function shouldRunOnDate(
  scheduleType: string,
  scheduleDays: number[] | undefined,
  startDate: Date | undefined,
  targetDate: Date
): boolean {
  const weekday = targetDate.getDay();

  switch (scheduleType) {
    case "daily": return true;
    case "mon_fri": return weekday >= 1 && weekday <= 5;
    case "weekends": return weekday === 0 || weekday === 6;
    case "custom":
      if (!scheduleDays || scheduleDays.length === 0) return false;
      return scheduleDays.includes(weekday);
    case "alternate_days": {
      if (!startDate) return true;
      const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const diffDays = Math.floor((targetMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % 2 === 0;
    }
    default: return true;
  }
}

export const generateDailyOrders = onSchedule(
  {
    schedule: "0 1 * * *", // Runs at 1:00 AM IST every night
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Launch Running 7-Day subscription order generator");

    // 1. Setup 7 Target Dates
    const datesToGenerate: { dateObj: Date; dateStr: string; dayOfWeek: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      
      const offset = d.getTimezoneOffset();
      const localD = new Date(d.getTime() - (offset * 60 * 1000));
      const dateStr = localD.toISOString().split("T")[0];
      
      datesToGenerate.push({ dateObj: d, dateStr, dayOfWeek: d.getDay() });
    }

    // 2. Load all tenants
    const tenantsSnap = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      console.log(`Processing tenant: ${tenantId}`);

      try {
        // Fetch Active Subs
        const subsSnap = await db.collection("tenants").doc(tenantId).collection("subscriptions")
          .where("isActive", "==", true).get();

        // Fetch Route Assignments
        const assignSnap = await db.collection("tenants").doc(tenantId).collection("customerAssignments").get();
        const routeMap: Record<string, any> = {};
        assignSnap.forEach((d) => {
          const data = d.data();
          if (data.customerId) {
            routeMap[data.customerId] = {
              routeId: data.routeId || "",
              routeName: data.routeName || "",
              zoneId: data.zoneId || "",
              zoneName: data.zoneName || "",
              hubId: data.hubId || "",
              hubName: data.hubName || "",
            };
          }
        });

        const ordersToCreate = new Map<string, any>();

        // 3. Loop through all 7 days
        datesToGenerate.forEach(({ dateObj, dateStr, dayOfWeek }) => {
          subsSnap.forEach((subDoc) => {
            const data = subDoc.data();
            const customerId = data.customerId;
            if (!customerId) return;

            const scheduleType = data.scheduleType || "daily";
            const scheduleDays = data.scheduleDays as number[] | undefined;
            const startDate = data.startDate?.toDate?.() ?? undefined;

            if (!shouldRunOnDate(scheduleType, scheduleDays, startDate, dateObj)) return;

            const skipDates = data.skipDates as string[] | undefined;
            if (skipDates && skipDates.includes(dateStr)) return;

            const vacationFrom = data.vacationFrom as string | undefined;
            const vacationTo = data.vacationTo as string | undefined;
            if (vacationFrom && vacationTo && dateStr >= vacationFrom && dateStr <= vacationTo) return;

            const baseQty = data.qty ?? 1;
            const dayQuantities = data.dayQuantities as Record<string, number> | undefined;
            const overrideQty = dayQuantities?.[String(dayOfWeek)];
            const finalQty = typeof overrideQty === "number" && overrideQty > 0 ? overrideQty : baseQty;

            if (finalQty <= 0) return;

            const shift = data.deliveryShift || data.shift || "Morning";
            const deliveryAddress = data.deliveryAddress || null;
            const fallbackRoute = routeMap[customerId] || {};
            const addressId = data.addressId || deliveryAddress?.addressId || "";
            const routeId = data.routeId || deliveryAddress?.routeId || fallbackRoute.routeId || "";
            const routeName = data.routeName || deliveryAddress?.routeName || fallbackRoute.routeName || "";
            const routeStatus = data.routeStatus || deliveryAddress?.routeStatus || (routeId || routeName ? "assigned" : "needs_review");
            const uniqueKey = addressId ? `${customerId}_${shift}_${addressId}_${dateStr}` : `${customerId}_${shift}_${dateStr}`;

            // Group multiple subscriptions for the same person/day into one Order
            if (!ordersToCreate.has(uniqueKey)) {
              ordersToCreate.set(uniqueKey, {
                tenantId,
                customerId,
                customerName: data.customerName || "Customer",
                addressId: addressId || null,
                deliveryAddress,
                routeStatus,
                routeId: routeId || null,
                routeName: routeName || null,
                zoneId: data.zoneId || deliveryAddress?.zoneId || fallbackRoute.zoneId || null,
                zoneName: data.zoneName || deliveryAddress?.zoneName || fallbackRoute.zoneName || null,
                hubId: data.hubId || deliveryAddress?.hubId || fallbackRoute.hubId || null,
                hubName: data.hubName || deliveryAddress?.hubName || fallbackRoute.hubName || null,
                routeSource: data.routeSource || (addressId ? "address" : "customer_fallback"),
                status: "pending",
                source: "subscription",
                shift: shift,
                deliveryShift: shift,
                deliveryDate: dateStr,
                date: dateStr,
                orderDate: dateStr, 
                items: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            const masterOrder = ordersToCreate.get(uniqueKey);
            masterOrder.items.push({
              productId: data.productId,
              name: data.productName,
              unit: data.unit,
              price: data.price ?? 0,
              qty: finalQty,
            });
            
            masterOrder.totalAmount = (masterOrder.totalAmount || 0) + ((data.price ?? 0) * finalQty);
          });
        });

        // 4. Safely Batch Write to Firestore (Max 500 per chunk)
        if (ordersToCreate.size > 0) {
          const batchChunks = [db.batch()];
          let opCount = 0;
          let chunkIndex = 0;
          let totalCount = 0;

          for (const [uniqueKey, orderData] of ordersToCreate.entries()) {
            const newOrderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(uniqueKey);
            batchChunks[chunkIndex].set(newOrderRef, orderData, { merge: true });
            opCount++;
            totalCount++;

            if (opCount === 450) { 
              batchChunks.push(db.batch());
              chunkIndex++;
              opCount = 0;
            }
          }

          for (const batch of batchChunks) {
            await batch.commit();
          }
          
          console.log(`Generated ${totalCount} new orders for tenant: ${tenantId}`);
        } else {
          console.log(`No new orders needed for tenant: ${tenantId}`);
        }

      } catch (tenantErr) {
        console.error(`Error processing tenant ${tenantId}:`, tenantErr);
      }
    }

    console.log("Finish 7-Day Order generation complete.");
  }
);
