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

// Authentication & Tenant Bouncers
import { useTenantResolver } from "../../hooks/useTenantResolver";
import CustomerAuth from "./CustomerAuth";
import CustomerOnboarding from "./CustomerOnboarding";
import { useAuth } from "../../context/AuthContext"; 

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
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  mapUrl?: string;
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
    case "mon_fri": return "Mon–Fri";
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
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutShift, setCheckoutShift] = useState<"Morning" | "Evening">("Morning");
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
  const [subQty, setSubQty] = useState("1");
  const [subSchedule, setSubSchedule] = useState<string>("daily");
  const [subCustomDays, setSubCustomDays] = useState<number[]>([]);
  const [subDayQuantities, setSubDayQuantities] = useState<Record<number, string>>({});
  const [subAddressId, setSubAddressId] = useState<string>("");
  const [subStartDate, setSubStartDate] = useState<string>("");
  const [savingSub, setSavingSub] = useState(false);
  const [subFormError, setSubFormError] = useState("");

  // Vacation Mode State
  const [vacationFrom, setVacationFrom] = useState("");
  const [vacationTo, setVacationTo] = useState("");
  const [savingVacation, setSavingVacation] = useState(false);

  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [errorAddresses, setErrorAddresses] = useState("");

  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrLine1, setNewAddrLine1] = useState("");
  const [newAddrArea, setNewAddrArea] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrPincode, setNewAddrPincode] = useState("");
  const [newAddrPhone, setNewAddrPhone] = useState("");
  const [newAddrMapUrl, setNewAddrMapUrl] = useState("");
  const [newAddrIsDefault, setNewAddrIsDefault] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

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
  const [subscribeView, setSubscribeView] = useState<"calendar" | "plans">("calendar");

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
          
          // 🌟 THE FIX: Actually check the flag!
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
        const filters = [where("tenantId", "==", user.tenantId), where("customerId", "==", user.uid)] as const;

        try {
          const txQ1 = query(collection(db, "tenants", user.tenantId, "walletTransactions"), ...filters);
          const txSnap1 = await getDocs(txQ1);
          txSnap1.forEach((docSnap) => {
            const data = docSnap.data() as any;
            allTx.push({
              id: docSnap.id, type: (data.type || "").toLowerCase() === "debit" ? "debit" : "credit", amount: data.amount ?? 0,
              note: data.note || "", orderId: data.orderId || undefined, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
            });
          });
        } catch (err) {}

        try {
          const txQ2 = query(collection(db, "tenants", user.tenantId, "billingTransactions"), ...filters);
          const txSnap2 = await getDocs(txQ2);
          txSnap2.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const rawType = (data.type || "").toLowerCase();
            allTx.push({
              id: docSnap.id, type: (rawType === "order_charge" || rawType === "debit") ? "debit" : "credit", amount: data.amount ?? 0,
              note: data.note || "", orderId: data.orderId || undefined, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
            });
          });
        } catch (err) {}

        let balance = 0; let totalBilled = 0; let totalPaid = 0;
        allTx.forEach((tx) => {
          const amt = typeof tx.amount === "number" ? tx.amount : 0;
          if (tx.type === "debit") { totalBilled += amt; balance += amt; } else { totalPaid += amt; balance -= amt; }
        });

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
  }, [user]);

  useEffect(() => {
    async function loadSubscriptions() {
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
          });
        });
        setSubscriptions(list);
      } catch (err) { setErrorSubs("Failed to load subscriptions."); } finally { setLoadingSubs(false); }
    }
    void loadSubscriptions();
  }, [user]);

  useEffect(() => {
    async function loadAddresses() {
      if (!user || !user.tenantId) { setLoadingAddresses(false); return; }
      try {
        const qAddr = query(collection(db, "tenants", user.tenantId, "addresses"), where("customerId", "==", user.uid));
        const snap = await getDocs(qAddr);
        const list: Address[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({ id: docSnap.id, label: data.label || "", line1: data.line1 || "", area: data.area || "", city: data.city || "", pincode: data.pincode || "", phone: data.phone || "", mapUrl: data.mapUrl || "", isDefault: data.isDefault ?? false });
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
    const qAddr = query(collection(db, "tenants", user.tenantId, "addresses"), where("customerId", "==", user.uid));
    const snap = await getDocs(qAddr);
    const list: Address[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      list.push({ id: docSnap.id, label: data.label || "", line1: data.line1 || "", area: data.area || "", city: data.city || "", pincode: data.pincode || "", phone: data.phone || "", mapUrl: data.mapUrl || "", isDefault: data.isDefault ?? false });
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
  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!newAddrLabel.trim() || !newAddrLine1.trim()) { setErrorAddresses("Please fill at least label and address line."); return; }
    setSavingAddress(true); setErrorAddresses("");
    try {
      await addDoc(collection(db, "tenants", user.tenantId!, "addresses"), {
        customerId: user.uid, tenantId: user.tenantId ?? null, label: newAddrLabel.trim(), line1: newAddrLine1.trim(), area: newAddrArea.trim(), city: newAddrCity.trim(), pincode: newAddrPincode.trim(), phone: newAddrPhone.trim(), mapUrl: newAddrMapUrl.trim(), isDefault: newAddrIsDefault, createdAt: serverTimestamp(),
      });
      setNewAddrLabel(""); setNewAddrLine1(""); setNewAddrArea(""); setNewAddrCity(""); setNewAddrPincode(""); setNewAddrPhone(""); setNewAddrMapUrl(""); setNewAddrIsDefault(false);
      await reloadAddresses();
    } catch (err) { setErrorAddresses("Failed to add address."); } finally { setSavingAddress(false); }
  }

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
      showToast("🌴 Vacation mode activated successfully!");
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
    setSubProduct(product); setSubQty("1"); setSubSchedule("daily"); setSubCustomDays([]); setSubDayQuantities({}); setSubAddressId(""); setSubStartDate(""); setSubFormError("");
    setTimeout(() => { document.getElementById("sub-form")?.scrollIntoView({ behavior: "smooth" }); }, 100);
  }

  function toggleCustomDay(dayIndex: number) {
    setSubCustomDays((prev) => prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]);
  }

  function setDayQuantityInput(dayIndex: number, value: string) {
    setSubDayQuantities((prev) => ({ ...prev, [dayIndex]: value }));
  }

  async function handleCreateSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.tenantId || !subProduct) return;
    if (!subQty.trim()) { setSubFormError("Please enter quantity."); return; }
    const qtyNumber = Number(subQty);
    if (Number.isNaN(qtyNumber) || qtyNumber <= 0) { setSubFormError("Quantity must be a positive number."); return; }
    if (subSchedule === "custom" && subCustomDays.length === 0) { setSubFormError("Please select at least one day for custom schedule."); return; }
    if (!subAddressId) { setSubFormError("Please select a delivery address."); return; }

    const selectedAddress = addresses.find((a) => a.id === subAddressId);
    if (!selectedAddress) { setSubFormError("Selected address not found."); return; }

    const dayQuantities: Record<string, number> = {};
    Object.entries(subDayQuantities).forEach(([dayIndexStr, val]) => {
      const v = (val ?? "").trim();
      if (!v) return;
      const num = Number(v);
      if (!Number.isNaN(num) && num > 0) { dayQuantities[String(dayIndexStr)] = num; }
    });

    setSavingSub(true); setSubFormError("");
    try {
      const startDateValue = subStartDate ? new Date(subStartDate) : new Date();
      const baseData: any = {
        tenantId: user.tenantId, customerId: user.uid, productId: subProduct.id, productName: subProduct.name, unit: subProduct.unit,
        price: subProduct.price, qty: qtyNumber, scheduleType: subSchedule, isActive: true, createdAt: serverTimestamp(), startDate: startDateValue, deliveryAddress: { label: selectedAddress.label, line1: selectedAddress.line1, area: selectedAddress.area || "", city: selectedAddress.city || "", pincode: selectedAddress.pincode || "", phone: selectedAddress.phone || "", mapUrl: selectedAddress.mapUrl || "" },
      };
      if (subSchedule === "custom") { baseData.scheduleDays = subCustomDays; }
      if (Object.keys(dayQuantities).length > 0) { baseData.dayQuantities = dayQuantities; }

      await addDoc(collection(db, "tenants", user.tenantId, "subscriptions"), baseData);
      setSubProduct(null); setSubQty("1"); setSubSchedule("daily"); setSubCustomDays([]); setSubDayQuantities({}); setSubAddressId(""); setSubStartDate("");
      await reloadSubscriptionsForCustomer();
      showToast("Subscription created successfully!");
    } catch (err) { setSubFormError("Failed to create subscription."); } finally { setSavingSub(false); }
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

  // Cart & Checkout Handlers
  const updateCartQty = (product: any, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[product.id] || 0;
      const newQty = Math.max(0, currentQty + delta);
      const newCart = { ...prev };
      if (newQty === 0) delete newCart[product.id];
      else newCart[product.id] = newQty;
      return newCart;
    });
  };

  const handleCheckout = async (overrideAddressId?: string) => {
    if (cartItemsCount === 0 || !user || !user.tenantId) return;
    const selectedAddress = overrideAddressId ? addresses.find(a => a.id === overrideAddressId) : (addresses.find(a => a.isDefault) || addresses[0]);
    if (!selectedAddress) { showToast("Please add a delivery address in your Profile first!", "error"); setActiveTab("profile"); return; }
    setIsCheckingOut(true);
    try {
      const orderItems = Object.entries(cart).map(([productId, qty]) => {
        const p = products.find(x => x.id === productId);
        return { productId, name: p?.name || "Unknown Item", price: p?.price || 0, qty };
      });
      await addDoc(collection(db, "tenants", user.tenantId, "orders"), {
        tenantId: user.tenantId, customerId: user.uid, customerName: user.name || "Customer", items: orderItems, totalAmount: cartTotal, status: "pending", type: "one-time", shift: checkoutShift, date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), deliveryAddress: { label: selectedAddress.label, line1: selectedAddress.line1, area: selectedAddress.area || "", city: selectedAddress.city || "", pincode: selectedAddress.pincode || "", phone: selectedAddress.phone || "", mapUrl: selectedAddress.mapUrl || "" }
      });
      setCart({}); showToast("🎉 Order placed successfully!"); setActiveTab("orders");
    } catch (error) { showToast("Failed to place order. Please try again.", "error"); } finally { setIsCheckingOut(false); }
  };

  // Derived Values
  const cartItemsCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
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
              {user?.name || "Customer"} <span style={{ fontSize: 10, color: "#2563eb" }}>▼</span>
            </div>
          </div>
          
          {/* UPDATED WALLET PILL */}
          <div onClick={() => setActiveTab("wallet")} style={{ background: walletBalance > 0 ? "#fef2f2" : walletBalance < 0 ? "#dcfce7" : "#eff6ff", padding: "6px 12px", borderRadius: 16, fontSize: 13, fontWeight: 800, color: walletBalance > 0 ? "#dc2626" : walletBalance < 0 ? "#16a34a" : "#2563eb", border: walletBalance > 0 ? "1px solid #fecaca" : walletBalance < 0 ? "1px solid #bbf7d0" : "1px solid #bfdbfe", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            {walletBalance > 0 
              ? `-₹${walletBalance.toFixed(2)} Due` 
              : walletBalance < 0 
                ? `₹${Math.abs(walletBalance).toFixed(2)} Cr` 
                : `₹0.00`}
          </div>
          
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
          
          {(activeTab === "products" || activeTab === "dashboard") && (
            <div style={{ padding: "0 0 20px 0" }}>
              <ProductsTab products={products} categories={categories} banners={banners} loadingProducts={loadingProducts} errorProducts={errorProducts} cart={cart} updateCartQty={updateCartQty} startSubscription={startSubscription} />
              
              {cartItemsCount > 0 && (
                <div style={{ position: "fixed", bottom: 80, left: 0, right: 0, margin: "0 auto", maxWidth: 448, padding: "0 16px", zIndex: 50 }}>
                  <div onClick={() => setActiveTab("cart")} style={{ background: "#2563eb", color: "#fff", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)", cursor: "pointer" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>{cartItemsCount} ITEMS</span><span style={{ fontSize: 16, fontWeight: 700 }}>₹{cartTotal}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}>View Cart <span>➔</span></div>
                  </div>
                </div>
              )}

              {subProduct && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                   <section id="sub-form" style={{ width: "100%", maxWidth: 480, padding: 24, borderRadius: "24px 24px 0 0", background: "#fff", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -10px 40px rgba(0,0,0,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 20 }}>Subscribe</h2><button onClick={() => setSubProduct(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>✕</button></div>
                    <div style={{ background: "#eff6ff", padding: 12, borderRadius: 12, marginBottom: 16 }}><p style={{ margin: 0, color: "#1e3a8a", fontWeight: 600 }}>{subProduct.name} <span style={{ fontWeight: 400 }}>({subProduct.unit})</span></p><p style={{ margin: "4px 0 0 0", color: "#2563eb", fontWeight: 700, fontSize: 16 }}>₹{subProduct.price}</p></div>

                    <form onSubmit={handleCreateSubscription} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Start Date</label><input type="date" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} value={subStartDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setSubStartDate(e.target.value)} /></div>
                        <div style={{ flex: 1 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Schedule</label><select style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }} value={subSchedule} onChange={(e) => { setSubSchedule(e.target.value); setSubDayQuantities({}); setSubCustomDays([]); }}><option value="daily">Daily</option><option value="alternate_days">Alternate days</option><option value="mon_fri">Mon to Friday</option><option value="weekends">Weekends</option><option value="custom">Custom days</option></select></div>
                      </div>

                      {(subSchedule === "daily" || subSchedule === "alternate_days") && (
                        <div><label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Quantity per day</label><input style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} value={subQty} onChange={(e) => setSubQty(e.target.value)} /></div>
                      )}

                      {subSchedule === "custom" && (
                        <div style={{ background: "#f9fafb", padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 12 }}>Select days & quantity:</label>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                            {DAY_LABELS.map((label, index) => (
                              <div key={index} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ border: subCustomDays.includes(index) ? "none" : "1px solid #d1d5db", borderRadius: 8, padding: "8px 0", textAlign: "center", cursor: "pointer", backgroundColor: subCustomDays.includes(index) ? "#111827" : "#fff", color: subCustomDays.includes(index) ? "#fff" : "#4b5563", fontSize: 13, fontWeight: 600 }}>
                                  <input type="checkbox" checked={subCustomDays.includes(index)} onChange={() => toggleCustomDay(index)} style={{ display: "none" }} />{label}
                                </label>
                                {subCustomDays.includes(index) && ( <input style={{ width: "100%", padding: "6px 4px", fontSize: 12, textAlign: "center", borderRadius: 6, border: "1px solid #9ca3af" }} placeholder="Qty" value={subDayQuantities[index] ?? ""} onChange={(e) => setDayQuantityInput(index, e.target.value)} /> )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(subSchedule === "mon_fri" || subSchedule === "weekends") && (
                        <div style={{ background: "#f9fafb", padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 12 }}>Custom Quantity (Optional)</label>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                            {(subSchedule === "mon_fri" ? [1, 2, 3, 4, 5] : [0, 6]).map((index) => (
                              <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>{DAY_LABELS[index]}</div>
                                <input style={{ width: "100%", padding: 6, fontSize: 12, textAlign: "center", borderRadius: 6, border: "1px solid #d1d5db" }} placeholder={subQty || "1"} value={subDayQuantities[index] ?? ""} onChange={(e) => setDayQuantityInput(index, e.target.value)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 6 }}>Delivery address</label>
                        {addresses.length === 0 ? (
                          <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Please add an address in your Profile first.</div>
                        ) : (
                          <select style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }} value={subAddressId} onChange={(e) => setSubAddressId(e.target.value)}>
                            <option value="">— Select an address —</option>
                            {addresses.map((a) => <option key={a.id} value={a.id}>{a.label} – {a.line1}</option>)}
                          </select>
                        )}
                      </div>

                      {subFormError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{subFormError}</div>}
                      <button type="submit" disabled={savingSub} style={{ padding: "14px", borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 15, marginTop: 8, cursor: savingSub ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}>{savingSub ? "Processing..." : "Confirm Subscription"}</button>
                    </form>
                  </section>
                </div>
              )}
            </div>
          )}

          {activeTab === "cart" && (
            <CartTab cart={cart} products={products} updateCartQty={updateCartQty} addresses={addresses} checkoutShift={checkoutShift} setCheckoutShift={setCheckoutShift} handleCheckout={handleCheckout} isCheckingOut={isCheckingOut} setActiveTab={setActiveTab} cartTotal={cartTotal} />
          )}

          {activeTab === "subscriptions" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 16px 0 16px" }}>
                <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 12, padding: 4, border: "1px solid #e5e7eb" }}>
                  <button onClick={() => setSubscribeView("calendar")} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: subscribeView === "calendar" ? "#fff" : "transparent", color: subscribeView === "calendar" ? "#111827" : "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: subscribeView === "calendar" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>📅 Calendar</button>
                  <button onClick={() => setSubscribeView("plans")} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: subscribeView === "plans" ? "#fff" : "transparent", color: subscribeView === "plans" ? "#111827" : "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: subscribeView === "plans" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>⚙️ Manage Plans</button>
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
              <AddressesTab loadingAddresses={loadingAddresses} errorAddresses={errorAddresses} addresses={addresses} newAddrLabel={newAddrLabel} newAddrLine1={newAddrLine1} newAddrArea={newAddrArea} newAddrCity={newAddrCity} newAddrPincode={newAddrPincode} newAddrPhone={newAddrPhone} newAddrMapUrl={newAddrMapUrl} newAddrIsDefault={newAddrIsDefault} setNewAddrLabel={setNewAddrLabel} setNewAddrLine1={setNewAddrLine1} setNewAddrArea={setNewAddrArea} setNewAddrCity={setNewAddrCity} setNewAddrPincode={setNewAddrPincode} setNewAddrPhone={setNewAddrPhone} setNewAddrMapUrl={setNewAddrMapUrl} setNewAddrIsDefault={setNewAddrIsDefault} handleAddAddress={handleAddAddress} handleSetDefaultAddress={handleSetDefaultAddress} savingAddress={savingAddress} />
            </div>
          )}
        </div>

        {/* STICKY BOTTOM NAVIGATION */}
        <div style={{ background: "#fff", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "12px 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", position: "fixed", bottom: 0, width: "100%", maxWidth: 480, borderTop: "1px solid #e5e7eb", zIndex: 10 }}>
          <NavItem icon="🏪" label="Shop" isActive={activeTab === "products" || activeTab === "dashboard" || activeTab === "cart"} onClick={() => setActiveTab("products")} />
          <NavItem icon="📅" label="Subscribe" isActive={activeTab === "subscriptions"} onClick={() => setActiveTab("subscriptions")} />
          <NavItem icon="💰" label="Wallet" isActive={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} />
          <NavItem icon="👤" label="Profile" isActive={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
        </div>

      </div>
    </div>
  );
}

// 🧩 Helper Component for Bottom Nav
function NavItem({ icon, label, isActive, onClick }: { icon: string, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", width: "25%", transition: "all 0.2s" }}>
      <div style={{ fontSize: 24, transform: isActive ? "scale(1.1)" : "scale(1)", opacity: isActive ? 1 : 0.5 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#2563eb" : "#6b7280" }}>{label}</div>
    </div>
  );
}