import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();

const db = admin.firestore();

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

const subsSnap = await db
  .collection("subscriptions")
  .where("isActive", "==", true)
  .get();

for (const subDoc of subsSnap.docs) {
  const data = subDoc.data();

  const scheduleType = data.scheduleType || "daily";

  let shouldRun = true;

  if (scheduleType === "mon_fri") {
    shouldRun = weekday >= 1 && weekday <= 5;
  }

  if (scheduleType === "weekends") {
    shouldRun = weekday === 0 || weekday === 6;
  }

  if (!shouldRun) continue;

  const existing = await db
    .collection("orders")
    .where("subscriptionId", "==", subDoc.id)
    .where("orderDate", "==", todayStr)
    .get();

  if (!existing.empty) continue;

  await db.collection("orders").add({
    tenantId: data.tenantId,
    customerId: data.customerId,
    status: "pending",
    source: "subscription",
    subscriptionId: subDoc.id,
    orderDate: todayStr,
    items: [
      {
        productId: data.productId,
        name: data.productName,
        unit: data.unit,
        price: data.price,
        qty: data.qty || 1,
      },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

console.log("Daily orders generated successfully");


}
);
