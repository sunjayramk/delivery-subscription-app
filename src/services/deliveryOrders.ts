import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getLocalDateString } from "./deliverySlots";

export type OrderShift = "Morning" | "Evening";

export interface DeliveryOrder {
  id: string;
  computedDeliveryDate: string;
  computedShift: OrderShift;
  [key: string]: any;
}

export function readDateString(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return getLocalDateString(value);
  if (typeof value.toDate === "function") return getLocalDateString(value.toDate());
  if (typeof value.seconds === "number") return getLocalDateString(new Date(value.seconds * 1000));
  return "";
}

export function readOrderDeliveryDate(data: any): string {
  return (
    readDateString(data.deliveryDate) ||
    readDateString(data.orderDate) ||
    readDateString(data.date) ||
    readDateString(data.createdAt)
  );
}

export function readOrderShift(data: any): OrderShift {
  const raw = String(data.deliveryShift || data.shift || "Morning").trim().toLowerCase();
  return raw === "evening" ? "Evening" : "Morning";
}

export function normalizeOrderStatus(status?: string): "pending" | "delivered" | "cancelled" | "other" {
  const raw = String(status || "pending").trim().toLowerCase();
  if (raw === "delivered") return "delivered";
  if (raw === "not_delivered" || raw === "cancelled" || raw === "canceled") return "cancelled";
  if (raw === "pending") return "pending";
  return "other";
}

export async function fetchOrdersForDeliveryDate(tenantId: string, dateStr: string): Promise<DeliveryOrder[]> {
  const ordersById = new Map<string, DeliveryOrder>();
  const dateFields = ["deliveryDate", "orderDate", "date"] as const;

  await Promise.all(
    dateFields.map(async (fieldName) => {
      const ordersQ = query(
        collection(db, "tenants", tenantId, "orders"),
        where(fieldName, "==", dateStr)
      );
      const snap = await getDocs(ordersQ);
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const computedDeliveryDate = readOrderDeliveryDate(data);
        if (computedDeliveryDate !== dateStr) return;

        ordersById.set(docSnap.id, {
          id: docSnap.id,
          ...data,
          computedDeliveryDate,
          computedShift: readOrderShift(data),
        });
      });
    })
  );

  return Array.from(ordersById.values());
}
