// src/services/invoices.ts
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export async function generateInvoiceForCustomerMonth(params: {
  tenantId: string;
  customerId: string;
  year: number;  // e.g. 2025
  month: number; // 1-12
}) {
  const { tenantId, customerId, year, month } = params;


  const txQ = query(
    collection(db, "billingTransactions"),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId)
    // NOTE: you can add createdAt range filters once you add composite index:
    // where("createdAt", ">=", start),
    // where("createdAt", "<", end)
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

  const closingBalance = totalDebits - totalCredits;

  await addDoc(collection(db, "invoices"), {
    tenantId,
    customerId,
    periodYear: year,
    periodMonth: month,
    totalDebits,
    totalCredits,
    closingBalance,
    createdAt: serverTimestamp(),
  });
}
