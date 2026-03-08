import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();

const db = admin.firestore();

// ===== Helper: should this subscription run today? =====
function shouldRunToday(
  scheduleType: string,
  scheduleDays: number[] | undefined,
  startDate: Date | undefined,
  today: Date
): boolean {
  const weekday = today.getDay();

  switch (scheduleType) {
    case "daily":
      return true;

    case "mon_fri":
      return weekday >= 1 && weekday <= 5;

    case "weekends":
      return weekday === 0 || weekday === 6;

    case "custom":
      if (!scheduleDays || scheduleDays.length === 0) return false;
      return scheduleDays.includes(weekday);

    case "alternate_days": {
      if (!startDate) return true;
      const todayMidnight = new Date(
        today.getFullYear(), today.getMonth(), today.getDate()
      );
      const startMidnight = new Date(
        startDate.getFullYear(), startDate.getMonth(), startDate.getDate()
      );
      const diffDays = Math.floor(
        (todayMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays % 2 === 0;
    }

    default:
      return true;
  }
}

export const generateDailyOrders = onSchedule(
  {
    schedule: "0 5 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Running daily subscription order generator");

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const weekday = today.getDay();

    // ✅ Fix 1: Load all tenants first
    const tenantsSnap = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;

      console.log(`Processing tenant: ${tenantId}`);

      try {
        // ✅ Fix 2: Load subscriptions per tenant subcollection
        const subsSnap = await db
          .collection("tenants")
          .doc(tenantId)
          .collection("subscriptions")
          .where("isActive", "==", true)
          .get();

        // ✅ Fix 3: Load customer assignments for routeName
        const assignSnap = await db
          .collection("tenants")
          .doc(tenantId)
          .collection("customerAssignments")
          .get();

        const routeMap: Record<string, string> = {};
        assignSnap.forEach((d) => {
          const data = d.data();
          if (data.customerId && data.routeName) {
            routeMap[data.customerId] = data.routeName;
          }
        });

        for (const subDoc of subsSnap.docs) {
          try {
            const data = subDoc.data();
            const customerId = data.customerId;
            if (!customerId) continue;

            const scheduleType = data.scheduleType || "daily";
            const scheduleDays = data.scheduleDays as number[] | undefined;
            const startDate = data.startDate?.toDate?.() ?? undefined;

            // ✅ Fix 4: Full schedule type support
            if (!shouldRunToday(scheduleType, scheduleDays, startDate, today)) {
              continue;
            }

            // ✅ Fix 5: Check skip dates
            const skipDates = data.skipDates as string[] | undefined;
            if (skipDates && skipDates.includes(todayStr)) {
              console.log(`Skipping subscription ${subDoc.id} — skip date`);
              continue;
            }

            // ✅ Fix 6: Check vacation range
            const vacationFrom = data.vacationFrom as string | undefined;
            const vacationTo = data.vacationTo as string | undefined;
            if (
              vacationFrom && vacationTo &&
              todayStr >= vacationFrom &&
              todayStr <= vacationTo
            ) {
              console.log(`Skipping subscription ${subDoc.id} — vacation`);
              continue;
            }

            // ✅ Fix 7: Apply day quantity overrides
            const baseQty = data.qty ?? 1;
            const dayQuantities = data.dayQuantities as
              | Record<string, number>
              | undefined;
            const overrideQty = dayQuantities?.[String(weekday)];
            const finalQty =
              typeof overrideQty === "number" && overrideQty > 0
                ? overrideQty
                : baseQty;

            // ✅ Fix 8: Duplicate check in tenant subcollection
            const existing = await db
              .collection("tenants")
              .doc(tenantId)
              .collection("orders")
              .where("subscriptionId", "==", subDoc.id)
              .where("orderDate", "==", todayStr)
              .get();

            if (!existing.empty) {
              console.log(`Order already exists for subscription ${subDoc.id}`);
              continue;
            }

            // ✅ Fix 9: Add routeName from assignments
            const routeName = routeMap[customerId] || "";

            // ✅ Fix 10: Create order in tenant subcollection
            await db
              .collection("tenants")
              .doc(tenantId)
              .collection("orders")
              .add({
                tenantId,
                customerId,
                routeName,
                status: "pending",
                source: "subscription",
                subscriptionId: subDoc.id,
                orderDate: todayStr,
                items: [
                  {
                    productId: data.productId,
                    name: data.productName,
                    unit: data.unit,
                    price: data.price ?? 0,
                    qty: finalQty,
                  },
                ],
                deliveryAddress: data.deliveryAddress || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

            console.log(`Order created for subscription ${subDoc.id}`);

          } catch (subErr) {
            // ✅ Fix 11: Per-subscription error handling
            console.error(`Error processing subscription ${subDoc.id}:`, subErr);
          }
        }

      } catch (tenantErr) {
        console.error(`Error processing tenant ${tenantId}:`, tenantErr);
      }
    }

    console.log("Daily orders generated successfully");
  }
);