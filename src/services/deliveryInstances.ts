import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeShift, type DeliveryShift } from "./deliverySlots";

export type DeliveryInstanceStatus = "expected" | "confirmed" | "pending" | "delivered" | "cancelled";
export type DeliveryInstanceItemSource = "subscription" | "one-time" | "manual";

export interface DeliveryInstanceItem {
  source: DeliveryInstanceItemSource;
  sourceId?: string;
  productId?: string;
  name: string;
  unit: string;
  price: number;
  originalQty: number;
  plannedQty: number;
  deliveredQty?: number | null;
  billingTransactionId?: string | null;
  billedAmount?: number | null;
  billedAt?: any;
  fulfillmentStatus?: "pending" | "delivered" | "partially_delivered" | "cancelled" | "rescheduled" | null;
  rescheduledQty?: number | null;
  followUpOrderId?: string | null;
}

export interface DeliveryInstanceChangeLogEntry {
  type: "sheet_confirmed" | "qty_change" | "status_change" | "route_change" | "note";
  productId?: string;
  productName?: string;
  fromQty?: number;
  toQty?: number;
  reason?: string;
  changedBy?: string;
  changedByName?: string;
  changedByRole?: string;
  changedAt?: any;
}

export interface DeliveryInstance {
  id: string;
  tenantId?: string;
  customerId: string;
  customerName?: string;
  deliveryDate: string;
  shift: DeliveryShift;
  addressId?: string;
  deliveryAddress?: any;
  routeId?: string | null;
  routeName?: string | null;
  zoneId?: string | null;
  hubId?: string | null;
  status: DeliveryInstanceStatus;
  items: DeliveryInstanceItem[];
  changeLog?: DeliveryInstanceChangeLogEntry[];
  createdAt?: any;
  updatedAt?: any;
}

export interface DeliveryInstanceWriteInput {
  customerId: string;
  customerName?: string;
  deliveryDate: string;
  shift: DeliveryShift;
  addressId?: string;
  deliveryAddress?: any;
  routeId?: string | null;
  routeName?: string | null;
  zoneId?: string | null;
  hubId?: string | null;
  status: DeliveryInstanceStatus;
  items: DeliveryInstanceItem[];
  changeLog?: DeliveryInstanceChangeLogEntry[];
}

export interface DeliveryInstanceKeyInput {
  customerId?: string;
  deliveryDate?: string;
  shift?: string;
  addressId?: string | null;
  deliveryAddress?: any;
}

function normalizeKeyPart(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildAddressFingerprint(address: any) {
  if (!address) return "";
  return [
    normalizeKeyPart(address.line1),
    normalizeKeyPart(address.area),
    normalizeKeyPart(address.city),
    normalizeKeyPart(address.pincode),
  ].filter(Boolean).join("|");
}

export function getDeliveryInstanceAddressKey(input: DeliveryInstanceKeyInput) {
  const addressId = input.addressId || input.deliveryAddress?.addressId || input.deliveryAddress?.id || "";
  return String(buildAddressFingerprint(input.deliveryAddress) || addressId || "default");
}

export function buildDeliveryInstanceLookupKey(input: DeliveryInstanceKeyInput) {
  const customerId = String(input.customerId || "");
  const deliveryDate = String(input.deliveryDate || "");
  const shift = normalizeShift(input.shift) || "Morning";
  const addressKey = getDeliveryInstanceAddressKey(input);
  return `${customerId}::${deliveryDate}::${shift}::${addressKey}`;
}

function cleanDocIdPart(value: any) {
  return String(value || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "default";
}

export function buildDeliveryInstanceId(input: DeliveryInstanceKeyInput) {
  const shift = normalizeShift(input.shift) || "Morning";
  return [
    cleanDocIdPart(input.deliveryDate),
    cleanDocIdPart(shift),
    cleanDocIdPart(input.customerId),
    cleanDocIdPart(getDeliveryInstanceAddressKey(input)),
  ].join("_");
}

export function normalizeDeliveryInstanceStatus(status: any): DeliveryInstanceStatus {
  const raw = String(status || "pending").trim().toLowerCase();
  if (raw === "expected") return "expected";
  if (raw === "confirmed") return "confirmed";
  if (raw === "delivered") return "delivered";
  if (raw === "cancelled" || raw === "canceled" || raw === "not_delivered") return "cancelled";
  return "pending";
}

function toNumber(value: any, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function normalizeDeliveryInstanceItem(raw: any): DeliveryInstanceItem {
  const originalQty = toNumber(raw?.originalQty ?? raw?.orderedQty ?? raw?.qty, 0);
  const plannedQty = toNumber(raw?.plannedQty ?? raw?.qty, originalQty);
  const deliveredQty = raw?.deliveredQty === null || raw?.deliveredQty === undefined ? null : toNumber(raw.deliveredQty, plannedQty);
  const rawSource = String(raw?.source || "manual").trim().toLowerCase();
  const source: DeliveryInstanceItemSource =
    rawSource === "subscription" ? "subscription" :
    rawSource === "one-time" || rawSource === "one_time" ? "one-time" :
    "manual";

  return {
    source,
    sourceId: raw?.sourceId || raw?.orderId || raw?.subscriptionId || undefined,
    productId: raw?.productId || undefined,
    name: raw?.name || raw?.productName || "Item",
    unit: raw?.unit || "unit",
    price: toNumber(raw?.price, 0),
    originalQty,
    plannedQty,
    deliveredQty,
    billingTransactionId: raw?.billingTransactionId || null,
    billedAmount: raw?.billedAmount === null || raw?.billedAmount === undefined ? null : toNumber(raw.billedAmount, 0),
    billedAt: raw?.billedAt || null,
    fulfillmentStatus: raw?.fulfillmentStatus || undefined,
    rescheduledQty: raw?.rescheduledQty === null || raw?.rescheduledQty === undefined ? null : toNumber(raw.rescheduledQty, 0),
    followUpOrderId: raw?.followUpOrderId || null,
  };
}

export function readDeliveryInstanceItemQty(item: DeliveryInstanceItem, status?: string) {
  const normalizedStatus = normalizeDeliveryInstanceStatus(status);
  if (normalizedStatus === "delivered" && item.deliveredQty !== null && item.deliveredQty !== undefined) {
    return item.deliveredQty;
  }
  return item.plannedQty;
}

export function normalizeDeliveryInstance(raw: any, id: string): DeliveryInstance {
  const shift = normalizeShift(raw?.shift || raw?.deliveryShift) || "Morning";
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeDeliveryInstanceItem) : [];

  return {
    id,
    tenantId: raw?.tenantId,
    customerId: raw?.customerId || "",
    customerName: raw?.customerName || "",
    deliveryDate: String(raw?.deliveryDate || raw?.date || ""),
    shift,
    addressId: raw?.addressId || raw?.deliveryAddress?.addressId || undefined,
    deliveryAddress: raw?.deliveryAddress || null,
    routeId: raw?.routeId || raw?.deliveryAddress?.routeId || null,
    routeName: raw?.routeName || raw?.deliveryAddress?.routeName || null,
    zoneId: raw?.zoneId || raw?.deliveryAddress?.zoneId || null,
    hubId: raw?.hubId || raw?.deliveryAddress?.hubId || null,
    status: normalizeDeliveryInstanceStatus(raw?.status),
    items,
    changeLog: Array.isArray(raw?.changeLog) ? raw.changeLog : [],
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

function stripUndefinedDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const cleaned: Record<string, any> = {};
  Object.entries(value).forEach(([key, child]) => {
    if (child === undefined) return;
    cleaned[key] = stripUndefinedDeep(child);
  });
  return cleaned;
}

export async function fetchDeliveryInstancesForDate(tenantId: string, deliveryDate: string): Promise<DeliveryInstance[]> {
  const instancesQ = query(
    collection(db, "tenants", tenantId, "deliveryInstances"),
    where("deliveryDate", "==", deliveryDate)
  );
  const snap = await getDocs(instancesQ);
  return snap.docs.map((docSnap) => normalizeDeliveryInstance(docSnap.data(), docSnap.id));
}

export async function fetchDeliveryInstancesForDates(tenantId: string, deliveryDates: string[]): Promise<DeliveryInstance[]> {
  const uniqueDates = Array.from(new Set(deliveryDates.filter(Boolean)));
  if (uniqueDates.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueDates.length; i += 10) {
    chunks.push(uniqueDates.slice(i, i + 10));
  }

  const snaps = await Promise.all(
    chunks.map((dates) => getDocs(query(
      collection(db, "tenants", tenantId, "deliveryInstances"),
      where("deliveryDate", "in", dates)
    )))
  );

  return snaps.flatMap((snap) => snap.docs.map((docSnap) => normalizeDeliveryInstance(docSnap.data(), docSnap.id)));
}

export async function createDeliveryInstances(tenantId: string, instances: DeliveryInstanceWriteInput[]) {
  if (instances.length === 0) return [];

  const batch = writeBatch(db);
  const ids: string[] = [];
  instances.forEach((instance) => {
    const id = buildDeliveryInstanceId(instance);
    ids.push(id);
    const ref = doc(db, "tenants", tenantId, "deliveryInstances", id);
    const items = instance.items.map((item) => ({
      ...item,
      billingTransactionId: item.billingTransactionId || (
        item.source === "subscription"
          ? `${id}_${cleanDocIdPart(item.sourceId || item.productId || item.name)}_sheet_charge`
          : item.billingTransactionId
      ),
    }));
    batch.set(ref, stripUndefinedDeep({
      ...instance,
      items,
      tenantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  await batch.commit();
  return ids;
}
