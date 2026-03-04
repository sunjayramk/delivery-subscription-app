// src/services/notifications.ts
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function createNotification(params: {
  tenantId: string;
  userId: string;
  type: "order" | "payment" | "delivery" | "wallet";
  title: string;
  message: string;
}) {
  const { tenantId, userId, type, title, message } = params;

  await addDoc(collection(db, "notifications"), {
    tenantId,
    userId,
    type,
    title,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}
