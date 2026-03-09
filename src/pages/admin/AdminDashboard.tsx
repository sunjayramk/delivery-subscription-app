// Admin dashboard for tenant management

import SettingsTab from "./SettingsTab";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getSecondaryAuth } from "../../firebase";
import { useEffect, useState } from "react";
import TopBar from "../../components/common/TopBar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { createNotification } from "../../services/Notifications";
import { generateInvoiceForCustomerMonth } from "../../services/invoices";
import CustomersTab from "./CustomersTab";
import AgentsTab from "./AgentsTab";
import DeliveryTab from "./DeliveryTab";
import BillingTab from "./BillingTab";
import ProductsTab from "./ProductsTab";
import OrdersTab from "./OrdersTab";
import DashboardTab from "./DashboardTab";
import Toast from "../../components/common/Toast";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  setDoc,
  increment,
  updateDoc,
  limit, orderBy
} from "firebase/firestore";

interface Tenant {
  id: string;
  name: string;
  code: string;
  city: string;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  isActive: boolean;
  categoryId?: string;
}

interface OrderItem {
  productId?: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
}

interface Order {
  id: string;
  status: string;
  createdAt?: Date;
  items: OrderItem[];
  customerId: string;
  source?: string; 
  routeName?: string;// "subscription" | "one_time" | etc.
}

interface CustomerAccount {
  id: string;
  customerId: string;
  outstandingDue: number;
}

interface TenantUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  phone?: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
  };

  const [activeTab, setActiveTab] = useState<
  "dashboard" |
  "customers" |
  "agents" |
  "delivery" |
  "products" |
  "billing" |
  "orders" |
  "settings"
>("dashboard");

  // Tenant
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState("");

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState("");

  // Categories
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  // Billing accounts (outstanding)
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState("");

  // Product form
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  // Customer form
const [custEmail, setCustEmail] = useState("");
const [custPassword, setCustPassword] = useState("");
const [custName, setCustName] = useState("");
const [custPhone, setCustPhone] = useState("");
const [savingCustomer, setSavingCustomer] = useState(false);
const [customerError, setCustomerError] = useState("");
 
// Agent form
const [agentEmail, setAgentEmail] = useState("");
const [agentPassword, setAgentPassword] = useState("");
const [agentName, setAgentName] = useState("");
const [agentPhone, setAgentPhone] = useState("");
const [savingAgent, setSavingAgent] = useState(false);
const [agentError, setAgentError] = useState("");

  // Payment form
  const [paymentCustomerId, setPaymentCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Invoice generation state
  const [invCustomerId, setInvCustomerId] = useState("");
  const [invYear, setInvYear] = useState("2026");
  const [invMonth, setInvMonth] = useState("1");
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError] = useState("");

  // Delivery Routes / Assignments
  const [tenantCustomers, setTenantCustomers] = useState<TenantUser[]>([]);
  const [tenantAgents, setTenantAgents] = useState<TenantUser[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
 
 
  // Customer profile data (name + phone)
const [customerProfileMap, setCustomerProfileMap] = useState<
  Record<string, { name?: string; phone?: string }>
>({});

  const [assignmentAgent, setAssignmentAgent] = useState<Record<string, string>>(
    {}
  );
  const [assignmentRoute, setAssignmentRoute] = useState<Record<string, string>>(
    {}
  );
  const [savingAssignmentFor, setSavingAssignmentFor] = useState<string | null>(
    null
  );

  const cardStyle: React.CSSProperties = {
  marginTop: 24,
  padding: 20,
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
};

//===== Create customer user =====
async function handleCreateCustomer(e: React.FormEvent) {
  e.preventDefault();
  if (!tenant) return;

  if (!custEmail || !custPassword || !custName) {
    setCustomerError("Email, password and name are required.");
    return;
  }

  setSavingCustomer(true);
  setCustomerError("");

  try {
    const secondaryAuth = getSecondaryAuth();

const cred = await createUserWithEmailAndPassword(
  secondaryAuth,
  custEmail,
  custPassword
);

    const newUid = cred.user.uid;

    await setDoc(doc(db, "users", newUid), {
      email: custEmail,
      role: "customer",
      tenantId: tenant.id,
      name: custName,
      phone: custPhone,
      createdAt: serverTimestamp(),
    });

    setCustEmail("");
    setCustPassword("");
    setCustName("");
    setCustPhone("");

    await loadUsersAndAssignments(tenant.id);

    showToast("Customer created successfully!", "success");
  } catch (err: any) {
    console.error(err);
    setCustomerError(err.message || "Failed to create customer.");
  } finally {
    setSavingCustomer(false);
  }
}
  
//===== Create agent user =====
  async function handleCreateAgent(e: React.FormEvent) {
  e.preventDefault();
  if (!tenant) return;

  if (!agentEmail || !agentPassword || !agentName) {
    setAgentError("Email, password and name are required.");
    return;
  }

  setSavingAgent(true);
  setAgentError("");

  try {
    const secondaryAuth = getSecondaryAuth();

    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      agentEmail,
      agentPassword
    );

    const newUid = cred.user.uid;

    await setDoc(doc(db, "users", newUid), {
      email: agentEmail,
      role: "agent",
      tenantId: tenant.id,
      name: agentName,
      phone: agentPhone,
      createdAt: serverTimestamp(),
    });

    setAgentEmail("");
    setAgentPassword("");
    setAgentName("");
    setAgentPhone("");

    await loadUsersAndAssignments(tenant.id);

    showToast("Agent created successfully!");
  } catch (err: any) {
    console.error(err);
    setAgentError(err.message || "Failed to create agent.");
  } finally {
    setSavingAgent(false);
  }
}

  // ===== Load tenant details =====
  useEffect(() => {
    async function loadTenant() {
      if (!user || !user.tenantId) {
        setTenantError("No tenant assigned to this admin user.");
        setLoadingTenant(false);
        return;
      }

      try {
        const ref = doc(db, "tenants", user.tenantId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setTenantError("Tenant not found.");
        } else {
          const data = snap.data() as any;
          setTenant({
            id: snap.id,
            name: data.name || "",
            code: data.code || "",
            city: data.city || "",
            isActive: data.isActive ?? true,
          });
        }
      } catch (err) {
        console.error("Error loading tenant", err);
        setTenantError("Failed to load tenant details.");
      } finally {
        setLoadingTenant(false);
      }
    }

    void loadTenant();
  }, [user]);

  // ===== Categories for this tenant =====
  async function loadCategories(tenantId: string) {
    try {
      const snap = await getDocs(collection(db, "tenants", tenantId, "categories"));
      const list: { id: string; name: string }[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({ id: docSnap.id, name: data.name || "" });
      });
      setCategories(list);
    } catch (err) {
      console.error("Error loading categories", err);
    }
  }

  // ===== Products for this tenant =====
  async function loadProducts(tenantId: string) {
    setLoadingProducts(true);
    setProductsError("");
    try {
      const qProd = query(
        collection(db, "tenants", tenantId, "products")
      );
      const snap = await getDocs(qProd);
      const list: Product[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          name: data.name || "",
          unit: data.unit || "",
          price: data.price ?? 0,
          isActive: data.isActive ?? true,
          categoryId: data.categoryId || "",
        });
      });
      setProducts(list);
    } catch (err) {
      console.error("Error loading products", err);
      setProductsError("Failed to load products.");
    } finally {
      setLoadingProducts(false);
    }
  }

  // ===== Orders for this tenant =====
  async function loadOrders(tenantId: string) {
    setLoadingOrders(true);
    setOrdersError("");
    try {
      const qOrders = query(
        collection(db, "tenants", tenantId, "orders"),
        orderBy("createdAt", "desc"),
        limit(300)
      );
      const snap = await getDocs(qOrders);
      const list: Order[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          status: data.status || "pending",
          items: (data.items || []) as OrderItem[],
          customerId: data.customerId || "",
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : undefined,
          source: data.source || "unknown",
        });
      });
      setOrders(list);
    } catch (err) {
      console.error("Error loading orders", err);
      setOrdersError("Failed to load orders.");
    } finally {
      setLoadingOrders(false);
    }
  }

  // ===== Billing accounts (outstanding due per customer) =====
  async function loadAccounts(tenantId: string) {
    setLoadingAccounts(true);
    setAccountsError("");
    try {
      const qAcc = query(
        collection(db, "tenants", tenantId, "customerAccounts")
      );
      const snap = await getDocs(qAcc);
      const list: CustomerAccount[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          customerId: data.customerId || "",
          outstandingDue: data.outstandingDue ?? 0,
        });
      });
      setAccounts(list);
    } catch (err) {
      console.error("Error loading customer accounts", err);
      setAccountsError("Failed to load customer billing data.");
    } finally {
      setLoadingAccounts(false);
    }
  }

  // ===== Users & Assignments (customers ↔ agents) =====
  async function loadUsersAndAssignments(tenantId: string) {
    setLoadingAssignments(true);
    setAssignmentError("");
    try {
      // Fetch all users for this tenant
      const usersQ = query(
        collection(db, "users"),
        where("tenantId", "==", tenantId)
      );
      const usersSnap = await getDocs(usersQ);
console.log("Users found:", usersSnap.size, "for tenantId:", tenantId);
      const customers: TenantUser[] = [];
      const agents: TenantUser[] = [];

      const profileMap: Record<string, { name?: string; phone?: string }> = {};

      usersSnap.forEach((docSnap) => {
  const data = docSnap.data() as any;
  const role = data.role || "";
  const id = docSnap.id; // ✅ add this line

  const entry: TenantUser = {
    id,
    email: data.email || "",
    role,
  };

  if (role === "customer") {
        customers.push({
          ...entry,
          name: data.name || "",
          phone: data.phone || "",
        });
        profileMap[id] = {
          name: data.name || "",
          phone: data.phone || "",
        };
      } else if (role === "agent") {
        agents.push({
          ...entry,
          name: data.name || "",
          phone: data.phone || "",
        });
      }
});


      setTenantCustomers(customers);
      setTenantAgents(agents);
      setCustomerProfileMap(profileMap);

      // Existing assignments
      const assignQ = query(
        collection(db, "tenants", tenantId, "customerAssignments")
      );
      const assignSnap = await getDocs(assignQ);

      const agentMap: Record<string, string> = {};
      const routeMap: Record<string, string> = {};
      assignSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const customerId = data.customerId as string | undefined;
        if (!customerId) return;
        if (data.agentId) agentMap[customerId] = data.agentId;
        if (data.routeName) routeMap[customerId] = data.routeName;
      });

      setAssignmentAgent(agentMap);
      setAssignmentRoute(routeMap);
    } catch (err) {
      console.error("Error loading users/assignments", err);
      setAssignmentError("Failed to load delivery routes.");
    } finally {
      setLoadingAssignments(false);
    }
  }

  // ===== When tenant is loaded, load all data =====
  useEffect(() => {
    if (tenant) {
      void loadProducts(tenant.id);
      void loadOrders(tenant.id);
      void loadAccounts(tenant.id);
      void loadUsersAndAssignments(tenant.id);
      void loadCategories(tenant.id);
    }
  }, [tenant]);

  // ===== Update product =====
  async function handleUpdateProduct(id: string, updates: Partial<{ name: string; unit: string; price: number; categoryId: string }>) {
    if (!tenant) return;
    try {
      const ref = doc(db, "tenants", tenant.id, "products", id);
      await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
      await loadProducts(tenant.id);
      showToast("Product updated successfully!");
    } catch (err) {
      console.error("Error updating product", err);
      showToast("Failed to update product.", "error");
    }
  }

  // ===== Toggle product active =====
  async function handleToggleProductActive(id: string, isActive: boolean) {
    if (!tenant) return;
    try {
      const ref = doc(db, "tenants", tenant.id, "products", id);
      await updateDoc(ref, { isActive: !isActive, updatedAt: serverTimestamp() });
      await loadProducts(tenant.id);
      showToast(!isActive ? "Product activated!" : "Product deactivated!");
    } catch (err) {
      console.error("Error toggling product", err);
      showToast("Failed to update product.", "error");
    }
  }

// ===== Create category =====
  async function handleCreateCategory(name: string) {
    if (!tenant) return;
    try {
      await addDoc(collection(db, "tenants", tenant.id, "categories"), {
        name,
        tenantId: tenant.id,
        createdAt: serverTimestamp(),
      });
      console.log("Category saved, reloading...");
      await loadCategories(tenant.id);
      console.log("Categories after reload:", categories);
    } catch (err) {
      console.error("Error creating category", err);
    }
  }

  // ===== Create product =====
  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;

    if (!newName.trim() || !newUnit.trim() || !newPrice.trim()) {
      setProductsError("Please fill all product fields.");
      return;
    }

    const priceNumber = Number(newPrice);
    if (Number.isNaN(priceNumber)) {
      setProductsError("Price must be a valid number.");
      return;
    }

    setSavingProduct(true);
    setProductsError("");
    try {
      await addDoc(collection(db, "tenants", tenant.id, "products"), {
        tenantId: tenant.id,
        name: newName.trim(),
        unit: newUnit.trim(),
        price: priceNumber,
        isActive: true,
        categoryId: newCategory || "",
        createdAt: serverTimestamp(),
      });

      setNewName("");
      setNewUnit("");
      setNewPrice("");
      setNewCategory("");

      await loadProducts(tenant.id);
    } catch (err) {
      console.error("Error creating product", err);
      setProductsError("Failed to create product.");
    } finally {
      setSavingProduct(false);
    }
  }
function formatCustomerLabel(customerId: string): string {
  const p = customerProfileMap[customerId];
  if (p?.name && p.name.trim().length > 0) {
    return `${p.name} (${customerId.slice(-6)})`;
  }
  return customerId;
}

  // ===== Subscription scheduling helper =====
  function shouldGenerateForToday(
    scheduleType: string,
    scheduleDays?: number[],
    startDate?: Date
  ): boolean {
    const now = new Date();
    const today = now.getDay(); // 0=Sun,1=Mon,...6=Sat

    switch (scheduleType) {
      case "daily":
        return true;

      case "mon_fri":
        return today >= 1 && today <= 5;

      case "weekends":
        return today === 0 || today === 6;

      case "custom":
        if (!scheduleDays || scheduleDays.length === 0) return false;
        return scheduleDays.includes(today);

      case "alternate_days": {
        if (!startDate) return true; // fallback
        const todayMidnight = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const startMidnight = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate()
        );
        const diffMs = todayMidnight.getTime() - startMidnight.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays % 2 === 0;
      }

      default:
        return true;
    }
  }

  // ===== Generate orders from subscriptions =====
  async function handleGenerateOrdersFromSubscriptions() {
    if (!tenant) return;


    const now = new Date();
    const todayWeekday = now.getDay();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      // Active subscriptions
      const subsQ = query(
        collection(db, "tenants", tenant.id, "subscriptions"),
        where("isActive", "==", true)
      );
      const subsSnap = await getDocs(subsQ);
      const createPromises: Promise<unknown>[] = [];

      subsSnap.forEach((subDoc) => {
        const data = subDoc.data() as any;
        const customerId = data.customerId;
        if (!customerId) return;

        const scheduleType = data.scheduleType || "daily";
        const scheduleDays =
          (data.scheduleDays as number[] | undefined) ?? undefined;
        const startDate =
          data.startDate?.toDate?.() ??
          (data.createdAt?.toDate?.() ?? undefined);

        // Schedule-type logic
        if (!shouldGenerateForToday(scheduleType, scheduleDays, startDate)) {
          return;
        }

        // Skip dates
        const skipDates =
          (data.skipDates as string[] | undefined) ?? undefined;
        if (skipDates && skipDates.includes(todayStr)) {
          return;
        }

        // Vacation range
        const vacationFrom = data.vacationFrom as string | undefined;
        const vacationTo = data.vacationTo as string | undefined;
        if (
          vacationFrom &&
          vacationTo &&
          todayStr >= vacationFrom &&
          todayStr <= vacationTo
        ) {
          return;
        }

        // Determine quantity (per-weekday overrides)
        const baseQty = data.qty ?? 1;
        const dayQuantities =
          (data.dayQuantities as Record<string, number> | undefined) ??
          undefined;
        const overrideQty =
          dayQuantities && dayQuantities[String(todayWeekday)];
        const finalQty =
          typeof overrideQty === "number" && overrideQty > 0
            ? overrideQty
            : baseQty;

        const item: OrderItem = {
          productId: data.productId,
          name: data.productName,
          unit: data.unit,
          price: data.price ?? 0,
          qty: finalQty,
        };

        const deliveryAddress = data.deliveryAddress || null;

        const routeName = assignmentRoute[customerId] || "";

const p = addDoc(collection(db, "tenants", tenant.id, "orders"), {
  tenantId: tenant.id,
  customerId,
  routeName,
  status: "pending",
  createdAt: serverTimestamp(),
  source: "subscription",
  subscriptionId: subDoc.id,
  orderDate: todayStr,
  items: [item],
  deliveryAddress,
});

        createPromises.push(p);
      });

      await Promise.all(createPromises);
      showToast("Orders generated from subscriptions!", "success");

      await loadOrders(tenant.id);
    } catch (err) {
      console.error("Error generating orders from subscriptions", err);
      showToast("Failed to generate orders from subscriptions.", "error");
    }
  }

  // ===== DAILY SUMMARY =====
  const today = new Date();
  function isSameDay(d?: Date): boolean {
    if (!d) return false;
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }

  const todaysOrders = orders.filter((o) => isSameDay(o.createdAt));

  let totalOrdersToday = todaysOrders.length;
  let subscriptionOrders = 0;
  let oneTimeOrders = 0;

  let pendingCount = 0;
  let deliveredCount = 0;
  let notDeliveredCount = 0;

  const routePackingMap: Record<
  string,
  Record<string, { name: string; unit: string; qty: number }>
> = {};

  const productSummaryMap: Record<
    string,
    {
      productId: string;
      name: string;
      unit: string;
      totalQty: number;
      subscriptionQty: number;
      oneTimeQty: number;
      totalRevenue: number;
    }
  > = {};

  todaysOrders.forEach((order) => {
    const source = order.source || "unknown";
    if (source === "subscription") subscriptionOrders += 1;
    if (source === "one_time") oneTimeOrders += 1;

    const status = (order.status || "").toLowerCase();
    if (status === "pending") pendingCount += 1;
    else if (status === "delivered") deliveredCount += 1;
    else if (status === "not_delivered") notDeliveredCount += 1;

    order.items.forEach((it) => {
      const route =
  order.routeName ||
  assignmentRoute[order.customerId] ||
  "Unassigned";

if (!routePackingMap[route]) {
  routePackingMap[route] = {};
}

const routeKey = it.productId || it.name;

if (!routePackingMap[route][routeKey]) {
  routePackingMap[route][routeKey] = {
    name: it.name,
    unit: it.unit,
    qty: 0,
  };
}

routePackingMap[route][routeKey].qty += it.qty;
      const pid = it.productId || it.name;
      const key = pid || it.name;

      if (!productSummaryMap[key]) {
        productSummaryMap[key] = {
          productId: pid,
          name: it.name,
          unit: it.unit,
          totalQty: 0,
          subscriptionQty: 0,
          oneTimeQty: 0,
          totalRevenue: 0,
        };
      }

      productSummaryMap[key].totalQty += it.qty;
      productSummaryMap[key].totalRevenue += it.qty * (it.price ?? 0);

      if (source === "subscription") {
        productSummaryMap[key].subscriptionQty += it.qty;
      } else if (source === "one_time") {
        productSummaryMap[key].oneTimeQty += it.qty;
      }
    });
  });

  const productSummaryList = Object.values(productSummaryMap).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
const routePackingList = Object.entries(routePackingMap).map(
  ([route, products]) => ({
    route,
    products: Object.values(products),
  })
);

  // ===== RECORD PAYMENT =====
  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;

    if (!paymentCustomerId.trim() || !paymentAmount.trim()) {
      setAccountsError("Please enter customer ID and amount.");
      return;
    }

    const amountNum = Number(paymentAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setAccountsError("Amount must be a positive number.");
      return;
    }

    setSavingPayment(true);
    setAccountsError("");
    try {
      // Transaction log
      await addDoc(collection(db, "tenants", tenant.id, "billingTransactions"), {
        tenantId: tenant.id,
        customerId: paymentCustomerId.trim(),
        type: "payment",
        amount: amountNum,
        note: paymentNote.trim(),
        createdAt: serverTimestamp(),
      });

      // Update outstanding due
      const accId = `${tenant.id}_${paymentCustomerId.trim()}`;
      const accRef = doc(db, "tenants", tenant.id, "customerAccounts", accId);

      await setDoc(
        accRef,
        {
          tenantId: tenant.id,
          customerId: paymentCustomerId.trim(),
          outstandingDue: increment(-amountNum),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
await createNotification({
  tenantId: tenant.id,
  userId: paymentCustomerId.trim(),
  type: "payment",
  title: "Payment received",
  message: `Payment of ₹${amountNum.toFixed(2)} recorded.`,
});

      setPaymentCustomerId("");
      setPaymentAmount("");
      setPaymentNote("");

      await loadAccounts(tenant.id);
    } catch (err) {
      console.error("Error recording payment", err);
      setAccountsError("Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  }
async function handleGenerateInvoice(e: React.FormEvent) {
  e.preventDefault();
  if (!tenant) return;

  if (!invCustomerId.trim()) {
    setInvError("Enter customer ID.");
    return;
  }

  setInvSaving(true);
  setInvError("");
  try {
    await generateInvoiceForCustomerMonth({
      tenantId: tenant.id,
      customerId: invCustomerId.trim(),
      year: Number(invYear),
      month: Number(invMonth),
    });
    showToast("Invoice generated successfully!", "success");
  } catch (err) {
    console.error("Failed to generate invoice", err);
    setInvError("Failed to generate invoice.");
  } finally {
    setInvSaving(false);
  }
}

 // ===== UPDATE ORDER STATUS =====
  async function handleUpdateOrderStatus(orderId: string, status: string) {
    if (!tenant) return;
    try {
      const ref = doc(db, "tenants", tenant.id, "orders", orderId);
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });
      await loadOrders(tenant.id);
    } catch (err) {
      console.error("Error updating order status", err);
    }
  }

  // ===== SAVE ASSIGNMENT (customer ↔ agent + route) =====
  async function handleSaveAssignment(customerId: string) {
    if (!tenant) return;
    const agentId = assignmentAgent[customerId] || "";
    const routeName = assignmentRoute[customerId] || "";

    setSavingAssignmentFor(customerId);
    setAssignmentError("");

    try {
      const ref = doc(
  db,
  "tenants", tenant.id,
  "customerAssignments",
  `${tenant.id}_${customerId}`
);
      await setDoc(
        ref,
        {
          tenantId: tenant.id,
          customerId,
          agentId: agentId || null,
          routeName: routeName || "",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error saving assignment", err);
      setAssignmentError("Failed to save assignment.");
    } finally {
      setSavingAssignmentFor(null);
    }
  }

  // ===== RENDER =====
  if (loadingTenant) {
    return (
      <div style={{ background: "#f9fafb", minHeight: "100vh" }}>
        <TopBar title="Tenant Admin Panel" />
        <div style={{ padding: 24 }}>
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (tenantError) {
    return (
      <div style={{ background: "#f9fafb", minHeight: "100vh" }}>
        <TopBar title="Tenant Admin Panel" />
        <div style={{ padding: 24 }}>
          <h1>Tenant Admin Panel</h1>
          <p style={{ color: "red" }}>{tenantError}</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ background: "#f9fafb", minHeight: "100vh" }}>
        <TopBar title="Tenant Admin Panel" />
        <div style={{ padding: 24 }}>
          <h1>Tenant Admin Panel</h1>
          <p>No tenant data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh" }}>
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage("")}
        />
      )}
      <TopBar title="Tenant Admin Panel" />
      <div
  style={{
    padding: 32,
    maxWidth: 1100,
    margin: "0 auto",
  }}
>
        <p>You are managing this store:</p>

        {/* Tenant Info */}
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>{tenant.name}</h2>
          <p>
            <strong>Code:</strong> {tenant.code}
          </p>
          <p>
            <strong>City:</strong> {tenant.city || "—"}
          </p>
          <p>
            <strong>Status:</strong> {tenant.isActive ? "Active" : "Inactive"}
          </p>
        </div>

<div
  style={{
    display: "flex",
    gap: 12,
    margin: "16px 0 24px 0",
    flexWrap: "wrap",
  }}
>
  {[
    { key: "dashboard", label: "📊 Dashboard" },
    { key: "customers", label: "👤 Customers" },
    { key: "agents", label: "🚚 Agents" },
    { key: "delivery", label: "🗺 Delivery" },
    { key: "products", label: "📦 Products" },
    { key: "billing", label: "💰 Billing" },
    { key: "orders", label: "🧾 Orders" },
    { key: "settings", label: "⚙️ Settings" },
  ].map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key as any)}
      style={{
        padding: "8px 14px",
        borderRadius: 20,
        border: activeTab === tab.key ? "none" : "1px solid #d1d5db",
        background:
          activeTab === tab.key ? "#111827" : "#ffffff",
        color:
          activeTab === tab.key ? "#ffffff" : "#374151",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {tab.label}
    </button>
  ))}
</div>
        
        {activeTab === "customers" && (
  <CustomersTab
    cardStyle={cardStyle}
    custEmail={custEmail}
    custPassword={custPassword}
    custName={custName}
    custPhone={custPhone}
    savingCustomer={savingCustomer}
    customerError={customerError}
    customers={tenantCustomers}
    setCustEmail={setCustEmail}
    setCustPassword={setCustPassword}
    setCustName={setCustName}
    setCustPhone={setCustPhone}
    handleCreateCustomer={handleCreateCustomer}
  />
)}

{activeTab === "agents" && (
  <AgentsTab
    cardStyle={cardStyle}
    agentEmail={agentEmail}
    agentPassword={agentPassword}
    agentName={agentName}
    agentPhone={agentPhone}
    savingAgent={savingAgent}
    agentError={agentError}
    agents={tenantAgents}
    setAgentEmail={setAgentEmail}
    setAgentPassword={setAgentPassword}
    setAgentName={setAgentName}
    setAgentPhone={setAgentPhone}
    handleCreateAgent={handleCreateAgent}
  />
)}

{activeTab === "settings" && (
          <SettingsTab />
        )}
        
        {/* Delivery Routes & Customer Assignment */}
        {activeTab === "delivery" && (
  <DeliveryTab
    cardStyle={cardStyle}
    tenantCustomers={tenantCustomers}
    tenantAgents={tenantAgents}
    customerProfileMap={customerProfileMap}
    assignmentAgent={assignmentAgent}
    assignmentRoute={assignmentRoute}
    savingAssignmentFor={savingAssignmentFor}
    loadingAssignments={loadingAssignments}
    assignmentError={assignmentError}
    formatCustomerLabel={formatCustomerLabel}
    setAssignmentAgent={setAssignmentAgent}
    setAssignmentRoute={setAssignmentRoute}
    handleSaveAssignment={handleSaveAssignment}
  />
)}

        {/* DAILY SUMMARY */}
        {activeTab === "dashboard" && (
  <DashboardTab
        cardStyle={cardStyle}
    totalOrdersToday={totalOrdersToday}
    subscriptionOrders={subscriptionOrders}
    oneTimeOrders={oneTimeOrders}
    pendingCount={pendingCount}
    deliveredCount={deliveredCount}
    notDeliveredCount={notDeliveredCount}
    productSummaryList={productSummaryList}
    routePackingList={routePackingList}
    today={today}
    handleGenerateOrdersFromSubscriptions={
      handleGenerateOrdersFromSubscriptions
    }
  />
)}
        {/* CUSTOMER BILLING */}
        {/* CUSTOMER BILLING */}

{activeTab === "billing" && (
  <BillingTab
    cardStyle={cardStyle}
    accounts={accounts}
    loadingAccounts={loadingAccounts}
    accountsError={accountsError}
    paymentCustomerId={paymentCustomerId}
    paymentAmount={paymentAmount}
    paymentNote={paymentNote}
    savingPayment={savingPayment}
    invCustomerId={invCustomerId}
    invYear={invYear}
    invMonth={invMonth}
    invSaving={invSaving}
    invError={invError}
    customers={tenantCustomers}
    setPaymentCustomerId={setPaymentCustomerId}
    setPaymentAmount={setPaymentAmount}
    setPaymentNote={setPaymentNote}
    setInvCustomerId={setInvCustomerId}
    setInvYear={setInvYear}
    setInvMonth={setInvMonth}
    handleRecordPayment={handleRecordPayment}
    handleGenerateInvoice={handleGenerateInvoice}
    formatCustomerLabel={formatCustomerLabel}
  />
)}

        {/* PRODUCT MANAGEMENT */}
        {activeTab === "products" && (
  <ProductsTab
    cardStyle={cardStyle}
    products={products}
    categories={categories}
    loadingProducts={loadingProducts}
    productsError={productsError}
    newName={newName}
    newUnit={newUnit}
    newPrice={newPrice}
    newCategory={newCategory}
    savingProduct={savingProduct}
    setNewName={setNewName}
    setNewUnit={setNewUnit}
    setNewPrice={setNewPrice}
    setNewCategory={setNewCategory}
    handleCreateProduct={handleCreateProduct}
    handleCreateCategory={handleCreateCategory}
    handleUpdateProduct={handleUpdateProduct}
    handleToggleProductActive={handleToggleProductActive}
  />
)}

        {/* ORDERS */}
        {activeTab === "orders" && (
  <OrdersTab
    cardStyle={cardStyle}
    orders={orders}
    loadingOrders={loadingOrders}
    ordersError={ordersError}
    formatCustomerLabel={formatCustomerLabel}
    handleUpdateOrderStatus={handleUpdateOrderStatus}
  />
)}
      </div>
    </div>
  );
}
