//Customer - CustomerHome.tsx

import { useEffect, useState } from "react";
import { db, auth } from "../../firebase"; 
import { signOut } from "firebase/auth"; 
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";

// UI Components
import Toast from "../../components/common/Toast";
import WalletTab from "./WalletTab";
import AddressesTab from "./AddressesTab";
import ProductsTab from "./ProductsTab";
import SubscriptionsTab from "./SubscriptionsTab";
import OrdersTab from "./OrdersTab";
import DashboardTab from "./DashboardTab";
import ProfileTab from "./ProfileTab";
import CartTab from "./CartTab";
import SubscriptionModal from "./SubscriptionModal";
import { useCart } from "../../context/CartContext";
import type { DateLike, DeliverySlot } from "../../services/deliverySlots";
import { buildAddressServiceFields, buildDeliveryAddressSnapshot, buildOrderRouteSnapshot, getAddressRouteStatus, type AddressRouteStatus, type ServiceHub, type ServiceZone } from "../../services/addressRoutes";

// Authentication & Tenant Bouncers
import { useTenantResolver } from "../../hooks/useTenantResolver";
import CustomerAuth from "./CustomerAuth";
import CustomerOnboarding from "./CustomerOnboarding";
import { useAuth } from "../../context/AuthContext"; 
import { fetchCustomerBalance, getBillingTransactionDirection, getWalletTransactionDirection } from "../../services/balances";

// --- INTERFACES ---
interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  categoryId?: string;
  imageUrl?: string;
  isSubscribable?: boolean;
}

interface Order {
  id: string;
  createdAt?: Date;
  status: string;
  fulfillmentType?: string;
  parentOrderId?: string;
  parentDeliveryInstanceId?: string;
  rescheduledFromDate?: string;
  rescheduledFromShift?: string;
  rescheduleReason?: string;
  paymentStatus?: string;
  items: {
    name: string;
    unit: string;
    price: number;
    qty: number;
  }[];
  deliveryAddress?: DeliveryAddress;
  shift?: string;
}

interface DeliveryAddress {
  addressId?: string;
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  mapUrl?: string;
  routeStatus?: AddressRouteStatus;
  hubId?: string | null;
  hubName?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  routeId?: string | null;
  routeName?: string | null;
}

interface Subscription {
  id: string;
  productName: string;
  unit: string;
  price: number;
  qty: number;
  scheduleType: string;
  scheduleDays?: number[];
  isActive: boolean;
  dayQuantities?: Record<string, number>;
  skipDates?: string[];
  vacationFrom?: string;
  vacationTo?: string;
  deliveryAddress?: DeliveryAddress;
  shift?: string;
  deliveryShift?: string;
  startDate?: DateLike;
}

interface Address {
  id: string;
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  mapUrl?: string;
  isDefault?: boolean;
  routeStatus?: AddressRouteStatus;
  hubId?: string | null;
  hubName?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  routeId?: string | null;
  routeName?: string | null;
}

interface WalletTransaction {
  id: string;
  type: "debit" | "credit";
  amount: number;
  note?: string;
  orderId?: string;
  createdAt?: Date;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSchedule(sub: Subscription): string {
  switch (sub.scheduleType) {
    case "daily": return "Daily";
    case "alternate_days": return "Alternate days";
    case "mon_fri": return "Mon-Fri";
    case "weekends": return "Weekends";
    case "custom":
      if (!sub.scheduleDays || sub.scheduleDays.length === 0) return "Custom days";
      return sub.scheduleDays.slice().sort().map((d) => DAY_LABELS[d] ?? "").join(", ");
    default: return sub.scheduleType;
  }
}

function formatAddress(addr: DeliveryAddress | undefined): string {
  if (!addr) return "No address set";
  return [addr.label, addr.line1, addr.area, addr.city, addr.pincode].filter(Boolean).join(", ");
}

function mapAddressDoc(docSnap: any, zones: ServiceZone[] = [], hubs: ServiceHub[] = []): Address {
  const data = docSnap.data() as any;
  const serviceFields = buildAddressServiceFields(data, zones, hubs);
  return {
    id: docSnap.id,
    label: data.label || "",
    line1: data.line1 || "",
    area: data.area || "",
    city: data.city || "",
    pincode: data.pincode || "",
    phone: data.phone || "",
    mapUrl: data.mapUrl || "",
    isDefault: data.isDefault ?? false,
    routeStatus: serviceFields.routeStatus,
    hubId: serviceFields.hubId || null,
    hubName: serviceFields.hubName || null,
    zoneId: serviceFields.zoneId || null,
    zoneName: serviceFields.zoneName || null,
    routeId: serviceFields.routeId || null,
    routeName: serviceFields.routeName || null,
  };
}

export default function CustomerHome() {
  // =========================================================================
  // 1. ALL HOOKS GO FIRST (The Detectives)
  // =========================================================================
  const { resolvedTenant, loading: tenantLoading, error: tenantError } = useTenantResolver();
  const { user, loading: authLoading } = useAuth(); // MODIFIED: Added authLoading

  const [storeName, setStoreName] = useState("Customer App");
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  
  // Products & Orders State
  const [products, setProducts] = useState<Product[]>([]);
  const { cart, clearCart, cartItemsCount } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [banners, setBanners] = useState<{ id: string; imageUrl: string }[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorProducts, setErrorProducts] = useState("");
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorOrders, setErrorOrders] = useState("");

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [errorSubs, setErrorSubs] = useState("");

  const [subProduct, setSubProduct] = useState<Product | null>(null);
  
  // Vacation Mode State
  const [vacationFrom, setVacationFrom] = useState("");
  const [vacationTo, setVacationTo] = useState("");
  const [savingVacation, setSavingVacation] = useState(false);

  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [errorAddresses, setErrorAddresses] = useState("");

  // Wallet State
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState("");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTotalBilled, setWalletTotalBilled] = useState<number>(0);
  const [walletTotalPaid, setWalletTotalPaid] = useState<number>(0);
  const [walletTx, setWalletTx] = useState<WalletTransaction[]>([]);

  // UI State
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
  const [activeTab, setActiveTab] = useState<string>("products");
  const [subscribeView, setSubscribeView] = useState<"calendar" | "plans">("calendar"); // eslint-disable-next-line @typescript-eslint/no-unused-vars

  // --- NEW: ONBOARDING STATE ---
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // --- NEW: ONBOARDING EFFECT (Respects flags AND Grandfathers legacy users) ---
  useEffect(() => {
    async function checkUserStatus() {
      if (authLoading) return;
      if (!user) {
        setCheckingStatus(false);
        return;
      }
      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          // Failsafe: No profile at all
          setNeedsOnboarding(true);
        } else {
          const userData = userDoc.data();
          
          // * THE FIX: Actually check the flag!
          if (userData.isOnboarded === false) {
            // It's a new user who hasn't finished the wizard!
            setNeedsOnboarding(true);
          } else {
            // It's either a fully onboarded user (true) OR a legacy user (undefined)
            setNeedsOnboarding(false); 
            
            // Silently update legacy users in the background so they are officially "onboarded"
            if (userData.isOnboarded === undefined) {
              updateDoc(userRef, { isOnboarded: true }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error("Error checking user status:", e);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkUserStatus();
  }, [user, authLoading]);

  // --- Effects (Data Fetching) ---
  useEffect(() => {
    async function loadTenantSettings() {
      if (!user?.tenantId) return;
      try {
        const snap = await getDoc(doc(db, "tenants", user.tenantId));
        if (snap.exists()) {
          setTenantSettings(snap.data().settings || null);
          setStoreName(snap.data().name || "Customer App");
        }
      } catch (err) { console.error("Failed to load tenant settings", err); }
    }
    loadTenantSettings();
  }, [user]);

  useEffect(() => {
    async function loadWallet() {
      if (!user || !user.tenantId) { setWalletLoading(false); return; }
      setWalletLoading(true); setWalletError("");
      try {
        const allTx: WalletTransaction[] = [];
        const customerFilter = where("customerId", "==", user.uid);

        try {
          const txQ1 = query(collection(db, "tenants", user.tenantId, "walletTransactions"), customerFilter);
          const txSnap1 = await getDocs(txQ1);
          txSnap1.forEach((docSnap) => {
            const data = docSnap.data() as any;
            allTx.push({
              id: docSnap.id, type: getWalletTransactionDirection(data.type) === "debit" ? "debit" : "credit", amount: data.amount ?? 0,
              note: data.note || "", orderId: data.orderId || undefined, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
            });
          });
        } catch (err) {}

        try {
          const txQ2 = query(collection(db, "tenants", user.tenantId, "billingTransactions"), customerFilter);
          const txSnap2 = await getDocs(txQ2);
          txSnap2.forEach((docSnap) => {
            const data = docSnap.data() as any;
            allTx.push({
              id: docSnap.id, type: getBillingTransactionDirection(data.type) === "debit" ? "debit" : "credit", amount: data.amount ?? 0,
              note: data.note || "", orderId: data.orderId || undefined, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
            });
          });
        } catch (err) {}

        let balance = 0; let totalBilled = 0; let totalPaid = 0;
        allTx.forEach((tx) => {
          const amt = typeof tx.amount === "number" ? tx.amount : 0;
          if (tx.type === "debit") { totalBilled += amt; balance += amt; } else { totalPaid += amt; balance -= amt; }
        });

        try {
          const summary = await fetchCustomerBalance(user.tenantId, user.uid);
          balance = summary.outstandingDue;
          totalBilled = summary.totalBilled;
          totalPaid = summary.totalPaid;
        } catch (err) {
          console.warn("Using visible transactions for wallet balance fallback", err);
        }

        allTx.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setWalletBalance(balance); setWalletTotalBilled(totalBilled); setWalletTotalPaid(totalPaid); setWalletTx(allTx.slice(0, 10));
      } catch (err) { setWalletError("Failed to load wallet."); } finally { setWalletLoading(false); }
    }
    void loadWallet();
  }, [user]);

  useEffect(() => {
    async function loadProducts() {
      // 1. Use URL store ID as a fallback if user profile is still loading
      const activeTenantId = user?.tenantId || resolvedTenant?.id;

      if (!activeTenantId) { 
        setErrorProducts("No store assigned to this customer."); 
        setLoadingProducts(false); 
        return; 
      }

      // 2. Clear any stuck errors before trying to fetch!
      setErrorProducts("");
      setLoadingProducts(true);

      try {
        // 3. Removed the redundant where("tenantId") filter which often causes empty results
        const qProd = query(
          collection(db, "tenants", activeTenantId, "products"), 
          where("isActive", "==", true)
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
            categoryId: data.categoryId || "", 
            imageUrl: data.imageUrl || "",
            isSubscribable: data.isSubscribable ?? false,
          });
        });
        setProducts(list);

        try {
          const catSnap = await getDocs(collection(db, "tenants", activeTenantId, "categories"));
          const catList: { id: string; name: string; sortOrder: number }[] = [];
          catSnap.forEach((docSnap) => { const data = docSnap.data() as any; catList.push({ id: docSnap.id, name: data.name || "", sortOrder: data.sortOrder || 0 }); });
          setCategories(catList);

          const bannerSnap = await getDocs(query(collection(db, "tenants", activeTenantId, "banners"), where("isActive", "==", true)));
          const bannerList: { id: string; imageUrl: string }[] = [];
          bannerSnap.forEach((docSnap) => { bannerList.push({ id: docSnap.id, imageUrl: docSnap.data().imageUrl }); });
          setBanners(bannerList);
        } catch (err) {}
      } catch (err) { 
        setErrorProducts("Failed to load products."); 
      } finally { 
        setLoadingProducts(false); 
      }
    }
    
    // 4. Run this effect whenever user OR resolvedTenant changes
    void loadProducts();
  }, [user, resolvedTenant]);

  useEffect(() => {
    async function loadOrders() {
      if (activeTab !== "wallet" && activeTab !== "subscriptions") return;
      if (!user || !user.tenantId) { setLoadingOrders(false); return; }
      try {
        const qOrders = query(collection(db, "tenants", user.tenantId, "orders"), where("customerId", "==", user.uid));
        const snap = await getDocs(qOrders);
        const list: Order[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({ id: docSnap.id, status: data.status || "pending", items: data.items || [], createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined, deliveryAddress: data.deliveryAddress, shift: data.shift || "Morning" });
        });
        setOrders(list);
      } catch (err) { setErrorOrders("Failed to load orders."); } finally { setLoadingOrders(false); }
    }
    void loadOrders();
  }, [user, activeTab]);

  useEffect(() => {
    async function loadSubscriptions() {
      if (activeTab !== "subscriptions" && activeTab !== "dashboard" && activeTab !== "cart") return;
      if (!user || !user.tenantId) { setLoadingSubs(false); return; }
      try {
        const qSubs = query(collection(db, "tenants", user.tenantId, "subscriptions"), where("customerId", "==", user.uid));
        const snap = await getDocs(qSubs);
        const list: Subscription[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({
            id: docSnap.id, productName: data.productName || "", unit: data.unit || "", price: data.price ?? 0, qty: data.qty ?? 1,
            scheduleType: data.scheduleType || "daily", scheduleDays: data.scheduleDays ?? undefined, isActive: data.isActive ?? true,
            dayQuantities: data.dayQuantities ?? undefined, skipDates: data.skipDates ?? undefined, vacationFrom: data.vacationFrom ?? undefined, vacationTo: data.vacationTo ?? undefined, deliveryAddress: data.deliveryAddress ?? undefined,
            shift: data.shift ?? undefined, deliveryShift: data.deliveryShift ?? undefined, startDate: data.startDate ?? undefined,
          });
        });
        setSubscriptions(list);
      } catch (err) { setErrorSubs("Failed to load subscriptions."); } finally { setLoadingSubs(false); }
    }
    void loadSubscriptions();
  }, [user, activeTab]);

  useEffect(() => {
    async function loadAddresses() {
      if (!user || !user.tenantId) { setLoadingAddresses(false); return; }
      try {
        const [snap, zoneSnap, hubSnap] = await Promise.all([
          getDocs(query(collection(db, "tenants", user.tenantId, "addresses"), where("customerId", "==", user.uid))),
          getDocs(collection(db, "tenants", user.tenantId, "zones")),
          getDocs(collection(db, "tenants", user.tenantId, "hubs")),
        ]);
        const zones = zoneSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const hubs = hubSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const list: Address[] = [];
        snap.forEach((docSnap) => {
          list.push(mapAddressDoc(docSnap, zones, hubs));
        });
        setAddresses(list);
      } catch (err) { setErrorAddresses("Failed to load addresses."); } finally { setLoadingAddresses(false); }
    }
    void loadAddresses();
  }, [user]);


  // =========================================================================
  // 2. THE BOUNCER LOGIC (The Interceptors)
  // =========================================================================
  
  if (tenantLoading || authLoading || checkingStatus) { // MODIFIED: Added auth checks
    return <div style={{ padding: 40, textAlign: "center", marginTop: 50 }}>Loading Storefront...</div>;
  }

  if (tenantError || !resolvedTenant) {
    return <div style={{ padding: 40, textAlign: "center", color: "#dc2626", marginTop: 50 }}>Store not found. Please check the URL.</div>;
  }

  if (!user) {
  return (
    <CustomerAuth 
      tenantId={resolvedTenant.id} // <--- Ensure this is being passed!
      tenantName={resolvedTenant.name} 
      onSuccess={() => window.location.reload()} 
    />
  );
}

  // --- NEW: ONBOARDING INTERCEPTOR ---
  if (needsOnboarding) {
    return <CustomerOnboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  // =========================================================================
  // 3. NORMAL FUNCTIONS & EVENT HANDLERS
  // =========================================================================
  
  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg); setToastType(type);
  };

  async function reloadSubscriptionsForCustomer() {
    if (!user || !user.tenantId) return;
    const qSubs = query(collection(db, "tenants", user.tenantId, "subscriptions"), where("customerId", "==", user.uid));
    const snap = await getDocs(qSubs);
    const list: Subscription[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      list.push({
        id: docSnap.id, productName: data.productName || "", unit: data.unit || "", price: data.price ?? 0, qty: data.qty ?? 1,
        scheduleType: data.scheduleType || "daily", scheduleDays: data.scheduleDays ?? undefined, isActive: data.isActive ?? true,
        dayQuantities: data.dayQuantities ?? undefined, skipDates: data.skipDates ?? undefined, vacationFrom: data.vacationFrom ?? undefined, vacationTo: data.vacationTo ?? undefined, deliveryAddress: data.deliveryAddress ?? undefined,
      });
    });
    setSubscriptions(list);
  }

  async function reloadAddresses() {
    if (!user || !user.tenantId) return;
    const [snap, zoneSnap, hubSnap] = await Promise.all([
      getDocs(query(collection(db, "tenants", user.tenantId, "addresses"), where("customerId", "==", user.uid))),
      getDocs(collection(db, "tenants", user.tenantId, "zones")),
      getDocs(collection(db, "tenants", user.tenantId, "hubs")),
    ]);
    const zones = zoneSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const hubs = hubSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const list: Address[] = [];
    snap.forEach((docSnap) => {
      list.push(mapAddressDoc(docSnap, zones, hubs));
    });
    setAddresses(list);
  }

  // User Handlers
  async function handleUpdateProfile(updates: { name: string; phone: string }) {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { ...updates, updatedAt: serverTimestamp() });
      showToast("Profile updated successfully!");
    } catch (err) { showToast("Failed to update profile.", "error"); }
  }

  async function handleLogout() {
    try { await signOut(auth); } catch (error) { showToast("Failed to logout.", "error"); }
  }

  // Address Handlers
    async function handleSetDefaultAddress(addressId: string) {
    if (!user) return;
    try {
      await updateDoc(doc(db, "tenants", user.tenantId!, "addresses", addressId), { isDefault: true, updatedAt: serverTimestamp() });
      await reloadAddresses();
    } catch (err) { showToast("Failed to set default address.", "error"); }
  }

  // Vacation Handlers
  async function handleSetVacation(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.tenantId) return;
    if (!vacationFrom || !vacationTo) { showToast("Please select both dates.", "error"); return; }
    if (vacationFrom > vacationTo) { showToast("End date must be after start date.", "error"); return; }
    setSavingVacation(true);
    try {
      const promises = subscriptions.map(sub => updateDoc(doc(db, "tenants", user.tenantId!, "subscriptions", sub.id), { vacationFrom, vacationTo, updatedAt: serverTimestamp() }));
      await Promise.all(promises);
      await reloadSubscriptionsForCustomer();
      setVacationFrom(""); setVacationTo("");
      showToast("Area Vacation mode activated successfully!");
    } catch(err) { showToast("Failed to set vacation.", "error"); } finally { setSavingVacation(false); }
  }

  async function handleClearVacation() {
    if (!user || !user.tenantId) return;
    setSavingVacation(true);
    try {
      const promises = subscriptions.map(sub => updateDoc(doc(db, "tenants", user.tenantId!, "subscriptions", sub.id), { vacationFrom: null, vacationTo: null, updatedAt: serverTimestamp() }));
      await Promise.all(promises);
      await reloadSubscriptionsForCustomer();
      showToast("Welcome back! Deliveries resumed.");
    } catch(err) { showToast("Failed to clear vacation.", "error"); } finally { setSavingVacation(false); }
  }

  // Subscription Handlers
  function startSubscription(product: Product) {
    setSubProduct(product); 
  }

  
  function isPastCutoffTime(): boolean {
    if (!tenantSettings?.operations?.customerCutoffTime) return false; 
    const cutoffTime = tenantSettings.operations.customerCutoffTime; 
    const [cutoffHour, cutoffMin] = cutoffTime.split(":").map(Number);
    const now = new Date(); const currentHour = now.getHours(); const currentMin = now.getMinutes();
    return (currentHour > cutoffHour || (currentHour === cutoffHour && currentMin >= cutoffMin));
  }

  async function toggleSubscriptionActive(sub: Subscription) {
    if (!user) return;
    if (isPastCutoffTime()) { showToast("Cutoff time passed. Please contact the store manager for assistance.", "error"); return; }
    try {
      await updateDoc(doc(db, "tenants", user.tenantId!, "subscriptions", sub.id), { isActive: !sub.isActive, updatedAt: serverTimestamp() });
      await reloadSubscriptionsForCustomer();
    } catch (err) { showToast("Failed to update subscription.", "error"); }
  }

  async function handleToggleSkipDate(sub: Subscription, dateStr: string) {
    if (!user || !user.tenantId) return;
    if (isPastCutoffTime() && dateStr === new Date(Date.now() + 86400000).toLocaleDateString('en-CA')) { showToast("Cutoff time passed for tomorrow's delivery change.", "error"); return; }
    const existingSkips = sub.skipDates ?? [];
    const newSkips = existingSkips.includes(dateStr) ? existingSkips.filter(d => d !== dateStr) : [...existingSkips, dateStr];
    try {
      await updateDoc(doc(db, "tenants", user.tenantId, "subscriptions", sub.id), { skipDates: newSkips, updatedAt: serverTimestamp() });
      await reloadSubscriptionsForCustomer();
      showToast(existingSkips.includes(dateStr) ? `Resumed delivery for ${dateStr}` : `Skipped delivery for ${dateStr}`);
    } catch (err) { showToast("Failed to update date.", "error"); }
  }

    const handleCheckout = async (overrideAddressId: string | undefined, selectedSlot: DeliverySlot) => {
    if (cartItemsCount === 0 || !user || !user.tenantId) return;
    const selectedAddress = overrideAddressId ? addresses.find(a => a.id === overrideAddressId) : (addresses.find(a => a.isDefault) || addresses[0]);
    if (!selectedAddress) { showToast("Please add a delivery address in your Profile first!", "error"); setActiveTab("profile"); return; }
    if (!selectedSlot) { showToast("Please select a delivery slot.", "error"); return; }
    const routeStatus = getAddressRouteStatus(selectedAddress);
    if (routeStatus === "unserviceable") {
      showToast("This address is outside the current service area. Please choose another address.", "error");
      return;
    }
    setIsCheckingOut(true);
    try {
      const orderItems = Object.entries(cart).map(([productId, qty]) => {
        const p = products.find(x => x.id === productId);
        return { productId, name: p?.name || "Unknown Item", unit: p?.unit || "", price: p?.price || 0, qty };
      });
      const deliveryDate = selectedSlot.date;
      const deliveryShift = selectedSlot.shift;
      const deliveryAddress = buildDeliveryAddressSnapshot(selectedAddress);
      const routeSnapshot = buildOrderRouteSnapshot(selectedAddress);
      await addDoc(collection(db, "tenants", user.tenantId, "orders"), {
        tenantId: user.tenantId, customerId: user.uid, customerName: user.name || "Customer", items: orderItems, totalAmount: cartTotal, status: "pending", type: "one-time", deliveryDate, deliveryShift, shift: deliveryShift, date: deliveryDate, orderDate: deliveryDate, createdAt: serverTimestamp(), deliveryAddress, ...routeSnapshot, routeSource: "address"
      });
      clearCart(); showToast(routeStatus === "needs_review" ? "Order placed. Admin will assign the delivery route." : "Success Order placed successfully!"); setActiveTab("orders");
    } catch (error) { showToast("Failed to place order. Please try again.", "error"); } finally { setIsCheckingOut(false); }
  };

  // Derived Values
  const cartTotal = Object.entries(cart).reduce((sum, [productId, qty]) => { const p = products.find(p => p.id === productId); return sum + (p ? p.price * qty : 0); }, 0);
  const activeSubs = subscriptions.filter((s) => s.isActive);
  const pausedSubs = subscriptions.filter((s) => !s.isActive);
  const activeVacationSub = subscriptions.find(s => s.vacationFrom && s.vacationTo);

  // =========================================================================
  // 4. RENDER UI
  // =========================================================================
  return (
    <div style={{ background: "#e5e7eb", height: "100vh", overflow: "hidden", display: "flex", justifyContent: "center" }}>
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />}
      
      <div style={{ width: "100%", maxWidth: 480, background: "#f9fafb", display: "flex", flexDirection: "column", position: "relative", height: "100%", boxShadow: "0 0 40px rgba(0,0,0,0.1)" }}>

        {/* TOP HEADER BAR */}
        <div style={{ background: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{storeName}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 4 }}>
              {user?.name || "Customer"} <span style={{ fontSize: 10, color: "#2563eb" }}>v</span>
            </div>
          </div>
          
          {/* UPDATED WALLET PILL */}
          <div onClick={() => setActiveTab("wallet")} style={{ background: walletBalance > 0 ? "#fef2f2" : walletBalance < 0 ? "#dcfce7" : "#eff6ff", padding: "6px 12px", borderRadius: 16, fontSize: 13, fontWeight: 800, color: walletBalance > 0 ? "#dc2626" : walletBalance < 0 ? "#16a34a" : "#2563eb", border: walletBalance > 0 ? "1px solid #fecaca" : walletBalance < 0 ? "1px solid #bbf7d0" : "1px solid #bfdbfe", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            {walletLoading
              ? "Loading..."
              : walletBalance > 0 
              ? `-Rs.${walletBalance.toFixed(2)} Due` 
              : walletBalance < 0 
                ? `Rs.${Math.abs(walletBalance).toFixed(2)} Cr` 
                : `Rs.0.00`}
          </div>
          
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
          
          {(activeTab === "products" || activeTab === "dashboard") && (
            <div style={{ padding: "0 0 20px 0" }}>
              <ProductsTab 
                products={products} 
                categories={categories} 
                banners={banners} 
                loadingProducts={loadingProducts} 
                errorProducts={errorProducts} 
                startSubscription={startSubscription} 
              />
              
              {cartItemsCount > 0 && (
                <div style={{ position: "fixed", bottom: 80, left: 0, right: 0, margin: "0 auto", maxWidth: 448, padding: "0 16px", zIndex: 50 }}>
                  <div onClick={() => setActiveTab("cart")} style={{ background: "#2563eb", color: "#fff", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)", cursor: "pointer" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>{cartItemsCount} ITEMS</span><span style={{ fontSize: 16, fontWeight: 700 }}>Rs.{cartTotal}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}>View Cart <span>{"->"}</span></div>
                  </div>
                </div>
              )}

              {subProduct && (
                <SubscriptionModal 
                  product={subProduct}
                  user={user}
                  addresses={addresses}
                  onClose={() => setSubProduct(null)}
                  onSuccess={() => {
                    setSubProduct(null);
                    reloadSubscriptionsForCustomer();
                    showToast("Subscription created successfully!");
                  }}
                />
              )}
            </div>
          )}

          {activeTab === "cart" && (
            <CartTab 
              products={products} 
              addresses={addresses} 
              subscriptions={activeSubs}
              loadingSubscriptions={loadingSubs}
              cutoffTime={tenantSettings?.operations?.customerCutoffTime}
              handleCheckout={handleCheckout} 
              isCheckingOut={isCheckingOut} 
              setActiveTab={setActiveTab} 
            />
          )}

          {activeTab === "subscriptions" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 16px 0 16px" }}>
                <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 12, padding: 4, border: "1px solid #e5e7eb" }}>
                  <button onClick={() => setSubscribeView("calendar")} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: subscribeView === "calendar" ? "#fff" : "transparent", color: subscribeView === "calendar" ? "#111827" : "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: subscribeView === "calendar" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>Calendar</button>
                  <button onClick={() => setSubscribeView("plans")} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: subscribeView === "plans" ? "#fff" : "transparent", color: subscribeView === "plans" ? "#111827" : "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: subscribeView === "plans" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>Manage Plans</button>
                </div>
              </div>
              <div>
                {subscribeView === "calendar" ? (
                  <DashboardTab walletBalance={walletBalance} activeSubscriptions={activeSubs.length} totalOrders={orders.length} subscriptions={subscriptions} setActiveTab={setActiveTab} handleToggleSkipDate={handleToggleSkipDate} />
                ) : (
                  <SubscriptionsTab 
  loadingSubs={loadingSubs} 
  errorSubs={errorSubs} 
  activeSubs={activeSubs} 
  pausedSubs={pausedSubs} 
  toggleSubscriptionActive={toggleSubscriptionActive} 
  handleToggleSkipDate={handleToggleSkipDate} 
  formatSchedule={formatSchedule} 
  
  // New Vacation Props!
  vacationFrom={vacationFrom}
  setVacationFrom={setVacationFrom}
  vacationTo={vacationTo}
  setVacationTo={setVacationTo}
  savingVacation={savingVacation}
  handleSetVacation={handleSetVacation}
  handleClearVacation={handleClearVacation}
  activeVacationSub={activeVacationSub}
/>
                )}
              </div>
            </div>
          )}

          {activeTab === "wallet" && (
            <div>
              <WalletTab walletLoading={walletLoading} walletError={walletError} walletBalance={walletBalance} walletTotalBilled={walletTotalBilled} walletTotalPaid={walletTotalPaid} walletTx={walletTx} />
              <div style={{ marginTop: 16, borderTop: "4px solid #f3f4f6" }} />
              <OrdersTab loadingOrders={loadingOrders} errorOrders={errorOrders} orders={orders} formatAddress={formatAddress} />
            </div>
          )}

          {activeTab === "profile" && (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              <ProfileTab user={user} handleUpdateProfile={handleUpdateProfile} handleLogout={handleLogout} />
              <AddressesTab 
  user={user} 
  addresses={addresses} 
  loadingAddresses={loadingAddresses} 
  errorAddresses={errorAddresses} 
  handleSetDefaultAddress={handleSetDefaultAddress} 
  reloadAddresses={reloadAddresses} 
/>
            </div>
          )}
        </div>

        {/* STICKY BOTTOM NAVIGATION */}
        <div style={{ background: "#fff", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))", position: "fixed", bottom: 0, width: "100%", maxWidth: 480, borderTop: "1px solid #e5e7eb", zIndex: 10, boxSizing: "border-box" }}>
          <NavItem label="Shop" isActive={activeTab === "products" || activeTab === "dashboard" || activeTab === "cart"} onClick={() => setActiveTab("products")} />
          <NavItem label="Subscribe" isActive={activeTab === "subscriptions"} onClick={() => setActiveTab("subscriptions")} />
          <NavItem label="Wallet" isActive={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} />
          <NavItem label="Profile" isActive={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
        </div>

      </div>
    </div>
  );
}

// Module Helper Component for Bottom Nav
function NavItem({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: isActive ? "#eff6ff" : "transparent",
        color: isActive ? "#2563eb" : "#6b7280",
        borderRadius: 12,
        cursor: "pointer",
        width: "25%",
        minHeight: 44,
        fontSize: 12,
        fontWeight: 800,
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}
