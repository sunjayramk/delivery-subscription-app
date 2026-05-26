import { addDoc, arrayUnion, collection, getDocs, query, serverTimestamp, updateDoc, where, doc } from "firebase/firestore";
import { db } from "../firebase";
import { getFirstAvailableDeliverySlot, parseLocalDate, type DeliveryShift, type DeliverySlotSubscription } from "./deliverySlots";

export interface OneTimeFollowUpItem {
  productId?: string | null;
  name: string;
  unit: string;
  price: number;
  qty: number;
}

export interface CreateOneTimeFollowUpInput {
  tenantId: string;
  customerId: string;
  customerName?: string;
  deliveryAddress?: any;
  routeId?: string | null;
  routeName?: string | null;
  zoneId?: string | null;
  hubId?: string | null;
  parentOrderId?: string | null;
  parentDeliveryInstanceId?: string | null;
  rescheduledFromDate: string;
  rescheduledFromShift?: DeliveryShift | string;
  reason: string;
  items: OneTimeFollowUpItem[];
  createdBy?: string;
  createdByName?: string;
  createdByRole?: string;
}

function stripUndefinedDeep(value: any): any {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (!value || typeof value !== "object") return value;

  const cleaned: Record<string, any> = {};
  Object.entries(value).forEach(([key, child]) => {
    if (child === undefined) return;
    cleaned[key] = stripUndefinedDeep(child);
  });
  return cleaned;
}

async function fetchActiveCustomerSubscriptions(tenantId: string, customerId: string): Promise<DeliverySlotSubscription[]> {
  const subsQ = query(
    collection(db, "tenants", tenantId, "subscriptions"),
    where("customerId", "==", customerId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(subsQ);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as DeliverySlotSubscription));
}

export async function createOneTimeFollowUpOrder(input: CreateOneTimeFollowUpInput) {
  const validItems = input.items
    .map((item) => ({ ...item, qty: Number(item.qty || 0), price: Number(item.price || 0) }))
    .filter((item) => item.qty > 0);

  if (validItems.length === 0) return null;

  const subscriptions = await fetchActiveCustomerSubscriptions(input.tenantId, input.customerId);
  const sourceDate = parseLocalDate(input.rescheduledFromDate) || new Date();
  const nextSlot = getFirstAvailableDeliverySlot(subscriptions, {
    now: sourceDate,
    windowDays: 30,
    includeToday: false,
    blockNearestDateAfterCutoff: false,
  });

  if (!nextSlot) {
    throw new Error("No eligible future subscription delivery slot is available for the follow-up order.");
  }

  const totalAmount = validItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const docRef = await addDoc(collection(db, "tenants", input.tenantId, "orders"), stripUndefinedDeep({
    tenantId: input.tenantId,
    customerId: input.customerId,
    customerName: input.customerName || "Customer",
    items: validItems.map((item) => ({
      productId: item.productId || null,
      name: item.name,
      unit: item.unit || "unit",
      price: Number(item.price || 0),
      qty: Number(item.qty || 0),
      rescheduledFromOrderId: input.parentOrderId || null,
      rescheduledFromDeliveryInstanceId: input.parentDeliveryInstanceId || null,
    })),
    totalAmount,
    status: "pending",
    type: "one-time",
    source: "one-time",
    fulfillmentType: "follow_up",
    paymentStatus: "carried_forward",
    paymentCarryForward: true,
    parentOrderId: input.parentOrderId || null,
    parentDeliveryInstanceId: input.parentDeliveryInstanceId || null,
    rescheduledFromDate: input.rescheduledFromDate,
    rescheduledFromShift: input.rescheduledFromShift || null,
    rescheduleReason: input.reason,
    deliveryDate: nextSlot.date,
    deliveryShift: nextSlot.shift,
    shift: nextSlot.shift,
    date: nextSlot.date,
    orderDate: nextSlot.date,
    deliveryAddress: input.deliveryAddress || null,
    routeId: input.routeId || input.deliveryAddress?.routeId || null,
    routeName: input.routeName || input.deliveryAddress?.routeName || null,
    zoneId: input.zoneId || input.deliveryAddress?.zoneId || null,
    hubId: input.hubId || input.deliveryAddress?.hubId || null,
    routeSource: "carried_forward",
    createdBy: input.createdBy || null,
    createdByName: input.createdByName || null,
    createdByRole: input.createdByRole || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  if (input.parentOrderId) {
    await updateDoc(doc(db, "tenants", input.tenantId, "orders", input.parentOrderId), {
      fulfillmentStatus: "partially_rescheduled",
      followUpOrderIds: arrayUnion(docRef.id),
      updatedAt: serverTimestamp(),
    });
  }

  return { id: docRef.id, slot: nextSlot, totalAmount };
}
