import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// ⬇️ Replace this object with config from Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyDUDLUR1NbOM-exNK6e8fxqQMbflFWWVQw",
  authDomain: "ojvatikadoordrop.firebaseapp.com",
  projectId: "ojvatikadoordrop",
  storageBucket: "ojvatikadoordrop.firebasestorage.app",
  messagingSenderId: "723268935004",
  appId: "1:723268935004:web:5025475dd40a60a1ed7599",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// SaaS roles
export type AppUserRole =
  | "platform_super_admin"
  | "tenant_admin"
  | "agent"
  | "customer";

export interface AppUser {
  uid: string;
  email?: string | null;
  role: AppUserRole;
  tenantId?: string | null; // null for platform_super_admin
}

// Load user profile from Firestore /users/{uid}
export async function loadUserProfile(
  firebaseUser: FirebaseUser
): Promise<AppUser | null> {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as any;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role: data.role as AppUserRole,
    tenantId: data.tenantId || null,
  };
}

export { onAuthStateChanged };

// Secondary app for creating users without logging out current admin
export function getSecondaryAuth() {
  const apps = getApps();
  const secondary =
    apps.find((a) => a.name === "Secondary") ||
    initializeApp(firebaseConfig, "Secondary");

  return getAuth(secondary);
}