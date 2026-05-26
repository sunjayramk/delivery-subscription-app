import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeOrderStatus } from "./deliveryOrders";

export type LedgerDirection = "debit" | "credit" | "neutral";

export interface CustomerBalanceSummary {
  customerId: string;
  orderCharges: number;
  syntheticOrderCharges: number;
  otherDebits: number;
  credits: number;
  totalBilled: number;
  totalPaid: number;
  outstandingDue: number;
  hasFinancialActivity: boolean;
  lastActivityMs: number;
}

function createSummary(customerId: string): CustomerBalanceSummary {
  return {
    customerId,
    orderCharges: 0,
    syntheticOrderCharges: 0,
    otherDebits: 0,
    credits: 0,
    totalBilled: 0,
    totalPaid: 0,
    outstandingDue: 0,
    hasFinancialActivity: false,
    lastActivityMs: 0,
  };
}

function ensureSummary(map: Record<string, CustomerBalanceSummary>, customerId: string) {
  if (!map[customerId]) map[customerId] = createSummary(customerId);
  return map[customerId];
}

export function readActivityMs(value: any): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getOrderChargeTotal(order: any): number {
  const explicitTotal = Number(order?.totalAmount);
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal;

  return (order?.items || []).reduce((sum: number, item: any) => {
    const price = Number(item?.price || 0);
    const qty = Number(item?.qty || 1);
    return sum + price * qty;
  }, 0);
}

export function getBillingTransactionDirection(typeValue: any): LedgerDirection {
  const type = String(typeValue || "").trim().toLowerCase();
  if (["order_charge", "sheet_confirmed_charge", "delivery_qty_increase", "manual_charge", "delivery_charge", "invoice_charge", "debit"].includes(type)) return "debit";
  if (["payment", "credit", "wallet_recharge", "recharge", "refund", "order_reversal", "delivery_qty_reduction_credit", "delivery_cancel_credit"].includes(type)) return "credit";
  return "neutral";
}

export function getWalletTransactionDirection(typeValue: any): LedgerDirection {
  const type = String(typeValue || "").trim().toLowerCase();
  return type === "debit" ? "debit" : "credit";
}

function applyDebit(summary: CustomerBalanceSummary, amount: number, createdAtMs: number, isOrderCharge = false, isSynthetic = false) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (isOrderCharge) summary.orderCharges += amount;
  else summary.otherDebits += amount;
  if (isSynthetic) summary.syntheticOrderCharges += amount;
  summary.totalBilled += amount;
  summary.hasFinancialActivity = true;
  summary.lastActivityMs = Math.max(summary.lastActivityMs, createdAtMs);
}

function applyCredit(summary: CustomerBalanceSummary, amount: number, createdAtMs: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  summary.credits += amount;
  summary.totalPaid += amount;
  summary.hasFinancialActivity = true;
  summary.lastActivityMs = Math.max(summary.lastActivityMs, createdAtMs);
}

function finishSummary(summary: CustomerBalanceSummary) {
  summary.outstandingDue = summary.totalBilled - summary.totalPaid;
  return summary;
}

export async function fetchCustomerBalances(tenantId: string): Promise<Record<string, CustomerBalanceSummary>> {
  const balances: Record<string, CustomerBalanceSummary> = {};
  const orderChargeNetByOrderId = new Map<string, number>();

  const [ordersSnap, billingSnap, walletSnap] = await Promise.all([
    getDocs(collection(db, "tenants", tenantId, "orders")),
    getDocs(collection(db, "tenants", tenantId, "billingTransactions")),
    getDocs(collection(db, "tenants", tenantId, "walletTransactions")),
  ]);

  billingSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const customerId = String(data.customerId || "");
    if (!customerId) return;

    const type = String(data.type || "").toLowerCase();
    const direction = getBillingTransactionDirection(type);
    const amount = Number(data.amount || 0);
    const createdAtMs = readActivityMs(data.createdAt);
    const summary = ensureSummary(balances, customerId);

    if ((type === "order_charge" || type === "order_reversal") && data.orderId) {
      const orderId = String(data.orderId);
      const signedAmount = type === "order_charge" ? amount : -amount;
      orderChargeNetByOrderId.set(orderId, (orderChargeNetByOrderId.get(orderId) || 0) + signedAmount);
    }

    if (direction === "debit") applyDebit(summary, amount, createdAtMs, type === "order_charge");
    if (direction === "credit") applyCredit(summary, amount, createdAtMs);
  });

  walletSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const customerId = String(data.customerId || "");
    if (!customerId) return;

    const direction = getWalletTransactionDirection(data.type);
    const amount = Number(data.amount || 0);
    const createdAtMs = readActivityMs(data.createdAt);
    const summary = ensureSummary(balances, customerId);

    if (direction === "debit") applyDebit(summary, amount, createdAtMs);
    if (direction === "credit") applyCredit(summary, amount, createdAtMs);
  });

  ordersSnap.forEach((docSnap) => {
    const data = { id: docSnap.id, ...docSnap.data() } as any;
    const customerId = String(data.customerId || "");
    if (!customerId || normalizeOrderStatus(data.status) !== "delivered") return;

    const orderTotal = getOrderChargeTotal(data);
    const recordedOrderCharge = Math.max(0, orderChargeNetByOrderId.get(docSnap.id) || 0);
    const missingOrderCharge = Math.max(0, orderTotal - recordedOrderCharge);
    const summary = ensureSummary(balances, customerId);
    applyDebit(summary, missingOrderCharge, readActivityMs(data.updatedAt || data.createdAt), true, true);
  });

  Object.values(balances).forEach(finishSummary);
  return balances;
}

export async function fetchCustomerBalance(tenantId: string, customerId: string): Promise<CustomerBalanceSummary> {
  const balances: Record<string, CustomerBalanceSummary> = {};
  const orderChargeNetByOrderId = new Map<string, number>();

  const customerFilter = where("customerId", "==", customerId);
  const [ordersSnap, billingSnap, walletSnap] = await Promise.all([
    getDocs(query(collection(db, "tenants", tenantId, "orders"), customerFilter)),
    getDocs(query(collection(db, "tenants", tenantId, "billingTransactions"), customerFilter)),
    getDocs(query(collection(db, "tenants", tenantId, "walletTransactions"), customerFilter)),
  ]);

  billingSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const summary = ensureSummary(balances, customerId);
    const type = String(data.type || "").toLowerCase();
    const direction = getBillingTransactionDirection(type);
    const amount = Number(data.amount || 0);
    const createdAtMs = readActivityMs(data.createdAt);

    if ((type === "order_charge" || type === "order_reversal") && data.orderId) {
      const orderId = String(data.orderId);
      const signedAmount = type === "order_charge" ? amount : -amount;
      orderChargeNetByOrderId.set(orderId, (orderChargeNetByOrderId.get(orderId) || 0) + signedAmount);
    }
    if (direction === "debit") applyDebit(summary, amount, createdAtMs, type === "order_charge");
    if (direction === "credit") applyCredit(summary, amount, createdAtMs);
  });

  walletSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const summary = ensureSummary(balances, customerId);
    const direction = getWalletTransactionDirection(data.type);
    const amount = Number(data.amount || 0);
    const createdAtMs = readActivityMs(data.createdAt);

    if (direction === "debit") applyDebit(summary, amount, createdAtMs);
    if (direction === "credit") applyCredit(summary, amount, createdAtMs);
  });

  ordersSnap.forEach((docSnap) => {
    const data = { id: docSnap.id, ...docSnap.data() } as any;
    if (normalizeOrderStatus(data.status) !== "delivered") return;

    const orderTotal = getOrderChargeTotal(data);
    const recordedOrderCharge = Math.max(0, orderChargeNetByOrderId.get(docSnap.id) || 0);
    const missingOrderCharge = Math.max(0, orderTotal - recordedOrderCharge);
    const summary = ensureSummary(balances, customerId);
    applyDebit(summary, missingOrderCharge, readActivityMs(data.updatedAt || data.createdAt), true, true);
  });

  return finishSummary(balances[customerId] || createSummary(customerId));
}
