// src/services/notifications.ts
import { db } from "../firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export async function createNotification(params: {
  tenantId: string;
  userId: string;
  type: "order" | "payment" | "delivery" | "wallet";
  title: string;
  message: string;
}) {
  const { tenantId, userId, type, title, message } = params;

  try {
    // Fix 1: Check notification count and limit to 100 per user
    const existingQ = query(
      collection(db, "tenants", tenantId, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false)
    );
    const existing = await getDocs(existingQ);
    if (existing.size >= 100) {
      console.warn("Notification limit reached for user:", userId);
      return;
    }

    // Fix 2: Save under tenant subcollection
    await addDoc(collection(db, "tenants", tenantId, "notifications"), {
      tenantId,
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

  } catch (err) {
    // Fix 3: Proper error handling
    console.error("Failed to create notification:", err);
    throw err;
  }
}
