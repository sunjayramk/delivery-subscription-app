// src/services/invoices.ts
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  setDoc,
  increment,
} from "firebase/firestore";

export async function generateInvoiceForCustomerMonth(params: {
  tenantId: string;
  customerId: string;
  year: number;
  month: number;
  deliveryCharge?: number; // ✅ 1. We tell TypeScript to expect the new fee
}) {
  const { tenantId, customerId, year, month, deliveryCharge } = params;
  
  // Default to 0 if the manager left the box blank
  const deliveryFee = deliveryCharge || 0;

  // Prevent duplicate invoices
  const existingQ = query(
    collection(db, "tenants", tenantId, "invoices"),
    where("customerId", "==", customerId),
    where("periodYear", "==", year),
    where("periodMonth", "==", month)
  );
  const existing = await getDocs(existingQ);
  if (!existing.empty) {
    throw new Error("Invoice already exists for this period");
  }

  // Filter transactions by month and year
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end = Timestamp.fromDate(new Date(year, month, 1));

  const txQ = query(
    collection(db, "tenants", tenantId, "billingTransactions"),
    where("customerId", "==", customerId),
    where("createdAt", ">=", start),
    where("createdAt", "<", end)
  );
  const snap = await getDocs(txQ);

  let totalDebits = 0;
  let totalCredits = 0;

  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const type = (data.type || "").toString().toLowerCase();
    const amount = typeof data.amount === "number" ? data.amount : 0;
    if (type === "order_charge" || type === "debit") {
      totalDebits += amount;
    } else {
      totalCredits += amount;
    }
  });

  // ✅ 2. Add the delivery fee to the invoice total
  totalDebits += deliveryFee;
  const closingBalance = totalDebits - totalCredits;

  // ✅ 3. Actually charge the customer's wallet so the math balances out everywhere
  if (deliveryFee > 0) {
    // Record it in the ledger
    await addDoc(collection(db, "tenants", tenantId, "billingTransactions"), {
      customerId: customerId,
      type: "debit", // "debit" means we are taking money / charging them
      amount: deliveryFee,
      note: `Delivery Charge for ${month}/${year}`,
      createdAt: serverTimestamp(),
    });

    // Add it to their total outstanding due
    const accountRef = doc(db, "tenants", tenantId, "customerAccounts", `${tenantId}_${customerId}`);
    await setDoc(accountRef, {
      outstandingDue: increment(deliveryFee)
    }, { merge: true });
  }

  // Save invoice under tenant subcollection
  await addDoc(collection(db, "tenants", tenantId, "invoices"), {
    tenantId,
    customerId,
    periodYear: year,
    periodMonth: month,
    deliveryCharge: deliveryFee, // Save it on the receipt
    totalDebits,
    totalCredits,
    closingBalance,
    createdAt: serverTimestamp(),
  });
}