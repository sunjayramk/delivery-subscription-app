import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

// ===== Helper: should this subscription run on a specific date? =====
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
        const routeMap: Record<string, string> = {};
        assignSnap.forEach((d) => {
          const data = d.data();
          if (data.customerId && data.routeName) routeMap[data.customerId] = data.routeName;
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

            const shift = data.shift || "Morning";
            const uniqueKey = `${customerId}_${shift}_${dateStr}`;

           
            // Group multiple subscriptions for the same person/day into one Order
            if (!ordersToCreate.has(uniqueKey)) {
              const routeName = routeMap[customerId] || "";
              ordersToCreate.set(uniqueKey, {
                tenantId,
                customerId,
                customerName: data.customerName || "Customer",
                deliveryAddress: data.deliveryAddress || null,
                routeName,
                status: "pending",
                source: "subscription",
                shift: shift,
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
            // Use the unique key (customerId_shift_date) as the actual document ID
            const newOrderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(uniqueKey);

            // Use { merge: true } so if the order already exists, it safely ignores it instead of creating a duplicate
            batchChunks[chunkIndex].set(newOrderRef, orderData, { merge: true });
            opCount++;
            totalCount++;

            if (opCount === 450) { // Safety buffer before hitting 500
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
