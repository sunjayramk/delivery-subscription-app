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
} from "firebase/firestore";

export async function generateInvoiceForCustomerMonth(params: {
  tenantId: string;
  customerId: string;
  year: number;
  month: number;
}) {
  const { tenantId, customerId, year, month } = params;

  // ✅ Fix 1: Prevent duplicate invoices
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

  // ✅ Fix 2: Filter transactions by month and year
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

  const closingBalance = totalDebits - totalCredits;

  // ✅ Fix 3: Save invoice under tenant subcollection
  await addDoc(collection(db, "tenants", tenantId, "invoices"), {
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