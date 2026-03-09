// This is a large file that contains the main customer home page with multiple tabs (dashboard, wallet, addresses, products, subscriptions, orders).

import TopBar from "../../components/common/TopBar";
import Toast from "../../components/common/Toast";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import WalletTab from "./WalletTab";
import AddressesTab from "./AddressesTab";
import ProductsTab from "./ProductsTab";
import SubscriptionsTab from "./SubscriptionsTab";
import OrdersTab from "./OrdersTab";
import DashboardTab from "./DashboardTab";
import AppLayout from "../../components/common/AppLayout";
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

interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  categoryId?: string;
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
    case "daily":
      return "Daily";
    case "alternate_days":
      return "Alternate days";
    case "mon_fri":
      return "Mon–Fri";
    case "weekends":
      return "Weekends";
    case "custom":
      if (!sub.scheduleDays || sub.scheduleDays.length === 0) {
        return "Custom days";
      }
      return sub.scheduleDays
        .slice()
        .sort()
        .map((d) => DAY_LABELS[d] ?? "")
        .join(", ");
    default:
      return sub.scheduleType;
  }
}

function formatQtyPattern(sub: Subscription): string | null {
  const dq = sub.dayQuantities;
  if (!dq || Object.keys(dq).length === 0) return null;
  const parts = Object.entries(dq)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([day, qty]) => `${DAY_LABELS[Number(day)]} ${qty}`);
  return parts.join(", ");
}

function formatAddress(addr: DeliveryAddress | undefined): string {
  if (!addr) return "No address set";
  const parts = [
    addr.label,
    addr.line1,
    addr.area,
    addr.city,
    addr.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function CustomerHome() {
  const { user } = useAuth();

  // ===== Store Settings State =====
  const [tenantSettings, setTenantSettings] = useState<any>(null);

  useEffect(() => {
    async function loadTenantSettings() {
      if (!user?.tenantId) return;
      try {
        const snap = await getDoc(doc(db, "tenants", user.tenantId));
        if (snap.exists()) {
          setTenantSettings(snap.data().settings || null);
        }
      } catch (err) {
        console.error("Failed to load tenant settings", err);
      }
    }
    loadTenantSettings();
  }, [user]);

  // Products & Orders
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorProducts, setErrorProducts] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorOrders, setErrorOrders] = useState("");
  const [placingOrderId, setPlacingOrderId] = useState<string | null>(null);

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [errorSubs, setErrorSubs] = useState("");

  // Subscription creation form
  const [subProduct, setSubProduct] = useState<Product | null>(null);
  const [subQty, setSubQty] = useState("1");
  const [subSchedule, setSubSchedule] = useState<string>("daily");
  const [subCustomDays, setSubCustomDays] = useState<number[]>([]);
  const [subDayQuantities, setSubDayQuantities] = useState<
    Record<number, string>
  >({});
  const [subAddressId, setSubAddressId] = useState<string>("");
  const [subStartDate, setSubStartDate] = useState<string>("");
  const [savingSub, setSavingSub] = useState(false);
  const [subFormError, setSubFormError] = useState("");

  // Addresses
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

  // Per-subscription vacation date range input state
  const [vacationFromMap, setVacationFromMap] = useState<Record<string, string>>(
    {}
  );
  const [vacationToMap, setVacationToMap] = useState<Record<string, string>>({});

  // Wallet / billing
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState("");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTotalBilled, setWalletTotalBilled] = useState<number>(0);
  const [walletTotalPaid, setWalletTotalPaid] = useState<number>(0);
  const [walletTx, setWalletTx] = useState<WalletTransaction[]>([]);

  const [toastMessage, setToastMessage] = useState("");
const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
  setToastMessage(msg);
  setToastType(type);
};

  const [activeTab, setActiveTab] = useState<
  "dashboard" | "wallet" | "addresses" | "products" | "subscriptions" | "orders"
>("dashboard");

const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "products", label: "Products" },
    { key: "subscriptions", label: "Subscriptions" },
    { key: "orders", label: "Orders" },
    { key: "wallet", label: "Wallet" },
    { key: "addresses", label: "Addresses" },
  ];
  
    // ===== Load wallet from transactions only (walletTransactions + billingTransactions) =====
  useEffect(() => {
    async function loadWallet() {
      if (!user || !user.tenantId) {
        setWalletLoading(false);
        return;
      }

      setWalletLoading(true);
      setWalletError("");

      try {
        const allTx: WalletTransaction[] = [];
        const filters = [
          where("tenantId", "==", user.tenantId),
          where("customerId", "==", user.uid),
        ] as const;

        // 1) walletTransactions (if present)
        try {
          const txQ1 = query(
            collection(db, "tenants", user.tenantId, "walletTransactions"),
            ...filters
          );
          const txSnap1 = await getDocs(txQ1);
          txSnap1.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const rawType = (data.type || "").toString().toLowerCase();
            const typeNorm: "debit" | "credit" =
              rawType === "debit" ? "debit" : "credit";

            allTx.push({
              id: docSnap.id,
              type: typeNorm,
              amount: data.amount ?? 0,
              note: data.note || "",
              orderId: data.orderId || undefined,
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate()
                : undefined,
            });
          });
        } catch (err) {
          console.warn("walletTransactions query failed", err);
        }

        // 2) billingTransactions (order_charge / payment)
        try {
          const txQ2 = query(
            collection(db, "tenants", user.tenantId, "billingTransactions"),
            ...filters
          );
          const txSnap2 = await getDocs(txQ2);
          txSnap2.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const rawType = (data.type || "").toString().toLowerCase();

            let typeNorm: "debit" | "credit";
            if (rawType === "order_charge" || rawType === "debit") {
              typeNorm = "debit";
            } else {
              // payment / credit
              typeNorm = "credit";
            }

            allTx.push({
              id: docSnap.id,
              type: typeNorm,
              amount: data.amount ?? 0,
              note: data.note || "",
              orderId: data.orderId || undefined,
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate()
                : undefined,
            });
          });
        } catch (err) {
          console.warn("billingTransactions query failed", err);
        }

        // 3) Compute totals from allTx
        let balance = 0;
        let totalBilled = 0;
        let totalPaid = 0;

        allTx.forEach((tx) => {
          const amt = typeof tx.amount === "number" ? tx.amount : 0;
          if (tx.type === "debit") {
            totalBilled += amt;
            balance += amt;
          } else {
            totalPaid += amt;
            balance -= amt;
          }
        });

        // 4) Sort and keep last 10
        allTx.sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        );

        setWalletBalance(balance);
        setWalletTotalBilled(totalBilled);
        setWalletTotalPaid(totalPaid);
        setWalletTx(allTx.slice(0, 10));
      } catch (err) {
        console.error("Error loading wallet for customer", err);
        setWalletError("Failed to load wallet details.");
      } finally {
        setWalletLoading(false);
      }
    }

    void loadWallet();
  }, [user]);


  // ===== Load products =====
  useEffect(() => {
    async function loadProducts() {
      if (!user || !user.tenantId) {
        setErrorProducts("No store assigned to this customer.");
        setLoadingProducts(false);
        return;
      }

      try {
        const qProd = query(
          collection(db, "tenants", user.tenantId, "products"),
          where("tenantId", "==", user.tenantId),
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
          });
        });
         console.log("Products loaded:", list);
        setProducts(list);
        
        setProducts(list);

        // Load categories
        try {
          const catSnap = await getDocs(collection(db, "tenants", user.tenantId!, "categories"));
          const catList: { id: string; name: string }[] = [];
          catSnap.forEach((docSnap) => {
            const data = docSnap.data() as any;
            catList.push({ id: docSnap.id, name: data.name || "" });
          });

          console.log("Categories loaded:", catList);
          setCategories(catList);

          setCategories(catList);
        } catch (err) {
          console.warn("Error loading categories", err);
        }
      } catch (err) {
        console.error("Error loading products for customer", err);
        setErrorProducts("Failed to load products.");
      } finally {
        setLoadingProducts(false);
      }
    }

    void loadProducts();
  }, [user]);

  // ===== Load recent orders =====
  useEffect(() => {
    async function loadOrders() {
  if (!user || !user.tenantId) {
    setLoadingOrders(false);
    return;
  }

      try {
        const qOrders = query(
          collection(db, "tenants", user.tenantId, "orders"),
          where("customerId", "==", user.uid)
        );
        const snap = await getDocs(qOrders);
        const list: Order[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            status: data.status || "pending",
            items: data.items || [],
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : undefined,
            deliveryAddress: data.deliveryAddress as DeliveryAddress | undefined,
          });
        });
        setOrders(list);
      } catch (err) {
        console.error("Error loading orders for customer", err);
        setErrorOrders("Failed to load recent orders.");
      } finally {
        setLoadingOrders(false);
      }
    }

    void loadOrders();
  }, [user]);

  // ===== Load subscriptions =====
  useEffect(() => {
    async function loadSubscriptions() {
  if (!user || !user.tenantId) {
    setLoadingSubs(false);
    return;
  }

      try {
        const qSubs = query(
          collection(db, "tenants", user.tenantId, "subscriptions"),
          where("customerId", "==", user.uid)
        );
        const snap = await getDocs(qSubs);
        const list: Subscription[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            productName: data.productName || "",
            unit: data.unit || "",
            price: data.price ?? 0,
            qty: data.qty ?? 1,
            scheduleType: data.scheduleType || "daily",
            scheduleDays:
              (data.scheduleDays as number[] | undefined) ?? undefined,
            isActive: data.isActive ?? true,
            dayQuantities:
              (data.dayQuantities as Record<string, number> | undefined) ??
              undefined,
            skipDates:
              (data.skipDates as string[] | undefined) ?? undefined,
            vacationFrom:
              (data.vacationFrom as string | undefined) ?? undefined,
            vacationTo: (data.vacationTo as string | undefined) ?? undefined,
            deliveryAddress:
              (data.deliveryAddress as DeliveryAddress | undefined) ??
              undefined,
          });
        });
        setSubscriptions(list);
      } catch (err) {
        console.error("Error loading subscriptions for customer", err);
        setErrorSubs("Failed to load subscriptions.");
      } finally {
        setLoadingSubs(false);
      }
    }

    void loadSubscriptions();
  }, [user]);

  async function reloadSubscriptionsForCustomer() {
  if (!user || !user.tenantId) return;
    try {
      const qSubs = query(
        collection(db, "tenants", user.tenantId, "subscriptions"),
        where("customerId", "==", user.uid)
      );
      const snap = await getDocs(qSubs);
      const list: Subscription[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          productName: data.productName || "",
          unit: data.unit || "",
          price: data.price ?? 0,
          qty: data.qty ?? 1,
          scheduleType: data.scheduleType || "daily",
          scheduleDays:
            (data.scheduleDays as number[] | undefined) ?? undefined,
          isActive: data.isActive ?? true,
          dayQuantities:
            (data.dayQuantities as Record<string, number> | undefined) ??
            undefined,
          skipDates:
            (data.skipDates as string[] | undefined) ?? undefined,
          vacationFrom:
            (data.vacationFrom as string | undefined) ?? undefined,
          vacationTo: (data.vacationTo as string | undefined) ?? undefined,
          deliveryAddress:
            (data.deliveryAddress as DeliveryAddress | undefined) ??
            undefined,
        });
      });
      setSubscriptions(list);
    } catch (err) {
      console.error("Error reloading subscriptions", err);
    }
  }

  // ===== Load addresses =====
  useEffect(() => {
    async function loadAddresses() {
  if (!user || !user.tenantId) {
    setLoadingAddresses(false);
    return;
  }
      try {
        const qAddr = query(
          collection(db, "tenants", user.tenantId, "addresses"),
          where("customerId", "==", user.uid)
        );
        const snap = await getDocs(qAddr);
        const list: Address[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            label: data.label || "",
            line1: data.line1 || "",
            area: data.area || "",
            city: data.city || "",
            pincode: data.pincode || "",
            phone: data.phone || "",
            mapUrl: data.mapUrl || "",
            isDefault: data.isDefault ?? false,
          });
        });
        setAddresses(list);
      } catch (err) {
        console.error("Error loading addresses", err);
        setErrorAddresses("Failed to load addresses.");
      } finally {
        setLoadingAddresses(false);
      }
    }

    void loadAddresses();
  }, [user]);

  async function reloadAddresses() {
  if (!user || !user.tenantId) return;
    try {
      const qAddr = query(
        collection(db, "tenants", user.tenantId, "addresses"),
        where("customerId", "==", user.uid)
      );
      const snap = await getDocs(qAddr);
      const list: Address[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          label: data.label || "",
          line1: data.line1 || "",
          area: data.area || "",
          city: data.city || "",
          pincode: data.pincode || "",
          phone: data.phone || "",
          mapUrl: data.mapUrl || "",
          isDefault: data.isDefault ?? false,
        });
      });
      setAddresses(list);
    } catch (err) {
      console.error("Error reloading addresses", err);
    }
  }

  function getDefaultAddress(): Address | undefined {
    const def = addresses.find((a) => a.isDefault);
    if (def) return def;
    return addresses[0];
  }

  // ===== Handlers =====

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!newAddrLabel.trim() || !newAddrLine1.trim()) {
      setErrorAddresses("Please fill at least label and address line.");
      return;
    }

    setSavingAddress(true);
    setErrorAddresses("");

    try {
      await addDoc(collection(db, "tenants", user.tenantId!, "addresses"), {
        customerId: user.uid,
        tenantId: user.tenantId ?? null,
        label: newAddrLabel.trim(),
        line1: newAddrLine1.trim(),
        area: newAddrArea.trim(),
        city: newAddrCity.trim(),
        pincode: newAddrPincode.trim(),
        phone: newAddrPhone.trim(),
        mapUrl: newAddrMapUrl.trim(),
        isDefault: newAddrIsDefault,
        createdAt: serverTimestamp(),
      });

      setNewAddrLabel("");
      setNewAddrLine1("");
      setNewAddrArea("");
      setNewAddrCity("");
      setNewAddrPincode("");
      setNewAddrPhone("");
      setNewAddrMapUrl("");
      setNewAddrIsDefault(false);

      await reloadAddresses();
    } catch (err) {
      console.error("Error adding address", err);
      setErrorAddresses("Failed to add address.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleSetDefaultAddress(addressId: string) {
    if (!user) return;
    try {
      const ref = doc(db, "tenants", user.tenantId!, "addresses", addressId);
      await updateDoc(ref, {
        isDefault: true,
        updatedAt: serverTimestamp(),
      });
      await reloadAddresses();
    } catch (err) {
      console.error("Error setting default address", err);
      showToast("Failed to set default address.", "error");
    }
  }

  async function handleOrderOnce(product: Product) {
    if (!user || !user.tenantId) return;
    setPlacingOrderId(product.id);
    setErrorOrders("");

    const addr = getDefaultAddress();
    const deliveryAddress = addr
      ? {
          label: addr.label,
          line1: addr.line1,
          area: addr.area || "",
          city: addr.city || "",
          pincode: addr.pincode || "",
          phone: addr.phone || "",
          mapUrl: addr.mapUrl || "",
        }
      : undefined;

    try {
      let routeName = "";

const assignRef = doc(
  db,
  "tenants", user.tenantId,
  "customerAssignments",
  `${user.tenantId}_${user.uid}`
);

const assignSnap = await getDoc(assignRef);

if (assignSnap.exists()) {
  const data = assignSnap.data() as any;
  routeName = data.routeName || "";
}
      await addDoc(collection(db, "tenants", user.tenantId, "orders"), {
  tenantId: user.tenantId,
  customerId: user.uid,
  routeName: routeName,
  status: "pending",
  createdAt: serverTimestamp(),
  source: "one_time",
  items: [
    {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      price: product.price,
      qty: 1,
    },
  ],
  deliveryAddress: deliveryAddress ?? null,
});
      // Reload recent orders
      const qOrders = query(
        collection(db, "tenants", user.tenantId, "orders"),
        where("customerId", "==", user.uid)
      );
      const snap = await getDocs(qOrders);
      const list: Order[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          status: data.status || "pending",
          items: data.items || [],
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : undefined,
          deliveryAddress: data.deliveryAddress as DeliveryAddress | undefined,
        });
      });
      setOrders(list);
      showToast("Order placed successfully!");
    } catch (err) {
      console.error("Error placing order", err);
      setErrorOrders("Failed to place order.");
    } finally {
      setPlacingOrderId(null);
    }
  }

  function startSubscription(product: Product) {
    setSubProduct(product);
    setSubQty("1");
    setSubSchedule("daily");
    setSubCustomDays([]);
    setSubDayQuantities({});
    setSubAddressId("");
    setSubStartDate("");
    setSubFormError("");
    // scroll to form
    setTimeout(() => {
      document.getElementById("sub-form")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  function toggleCustomDay(dayIndex: number) {
    setSubCustomDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  }

  function setDayQuantityInput(dayIndex: number, value: string) {
    setSubDayQuantities((prev) => ({
      ...prev,
      [dayIndex]: value,
    }));
  }

  async function handleCreateSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.tenantId || !subProduct) return;

    if (!subQty.trim()) {
      setSubFormError("Please enter quantity.");
      return;
    }

    const qtyNumber = Number(subQty);
    if (Number.isNaN(qtyNumber) || qtyNumber <= 0) {
      setSubFormError("Quantity must be a positive number.");
      return;
    }

    if (subSchedule === "custom" && subCustomDays.length === 0) {
      setSubFormError("Please select at least one day for custom schedule.");
      return;
    }

    if (!subAddressId) {
      setSubFormError("Please select a delivery address.");
      return;
    }

    const selectedAddress = addresses.find((a) => a.id === subAddressId);
    if (!selectedAddress) {
      setSubFormError("Selected address not found.");
      return;
    }

    const deliveryAddress: DeliveryAddress = {
      label: selectedAddress.label,
      line1: selectedAddress.line1,
      area: selectedAddress.area || "",
      city: selectedAddress.city || "",
      pincode: selectedAddress.pincode || "",
      phone: selectedAddress.phone || "",
      mapUrl: selectedAddress.mapUrl || "",
    };

    // Build dayQuantities overrides
    const dayQuantities: Record<string, number> = {};
    Object.entries(subDayQuantities).forEach(([dayIndexStr, val]) => {
      const v = (val ?? "").trim();
      if (!v) return;
      const num = Number(v);
      if (!Number.isNaN(num) && num > 0) {
        dayQuantities[String(dayIndexStr)] = num;
      }
    });

    setSavingSub(true);
    setSubFormError("");
    try {
      const startDateValue = subStartDate
        ? new Date(subStartDate)
        : new Date();

      const baseData: any = {
        tenantId: user.tenantId,
        customerId: user.uid,
        productId: subProduct.id,
        productName: subProduct.name,
        unit: subProduct.unit,
        price: subProduct.price,
        qty: qtyNumber,
        scheduleType: subSchedule,
        isActive: true,
        createdAt: serverTimestamp(),
        startDate: startDateValue,
        deliveryAddress,
      };

      if (subSchedule === "custom") {
        baseData.scheduleDays = subCustomDays;
      }

      if (Object.keys(dayQuantities).length > 0) {
        baseData.dayQuantities = dayQuantities;
      }

      await addDoc(collection(db, "tenants", user.tenantId, "subscriptions"), baseData);

      // Clear form
      setSubProduct(null);
      setSubQty("1");
      setSubSchedule("daily");
      setSubCustomDays([]);
      setSubDayQuantities({});
      setSubAddressId("");
      setSubStartDate("");

      // Reload subscriptions
      await reloadSubscriptionsForCustomer();
      showToast("Subscription created successfully!");
    } catch (err) {
      console.error("Error creating subscription", err);
      setSubFormError("Failed to create subscription.");
    } finally {
      setSavingSub(false);
    }
  }

  async function toggleSubscriptionActive(sub: Subscription) {
    if (!user) return;
    if (isPastCutoffTime()) {
      showToast("Cutoff time passed. Please contact the store manager for assistance to pause or resume your subscription.", "error");
      return;
    }
    try {
      const ref = doc(db, "tenants", user.tenantId!, "subscriptions", sub.id);
      await updateDoc(ref, {
        isActive: !sub.isActive,
        updatedAt: serverTimestamp(),
      });
      await reloadSubscriptionsForCustomer();
    } catch (err) {
      console.error("Error updating subscription status", err);
      showToast("Failed to update subscription.", "error");
    }
  }

  // ===== Cutoff Time Check =====
  function isPastCutoffTime(): boolean {
    if (!tenantSettings?.operations?.customerCutoffTime) return false; // If shop owner didn't set a time, allow it
    
    const cutoffTime = tenantSettings.operations.customerCutoffTime; // e.g., "22:00"
    const [cutoffHour, cutoffMin] = cutoffTime.split(":").map(Number);

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    if (currentHour > cutoffHour || (currentHour === cutoffHour && currentMin >= cutoffMin)) {
      return true;
    }
    return false;
  }
  
  async function handleSkipTomorrow(sub: Subscription) {
    if (!user) return;
    if (isPastCutoffTime()) {
      showToast("Cutoff time passed. Please contact the store manager for assistance to modify tomorrow's delivery.", "error");
      return;
    }
    const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dateStr = tomorrow.toLocaleDateString('en-CA');

    const existing = sub.skipDates ?? [];
    if (existing.includes(dateStr)) {
      showToast("Tomorrow is already skipped.", "info");
      return;
    }

    try {
      const ref = doc(db, "tenants", user.tenantId!, "subscriptions", sub.id);
      await updateDoc(ref, {
        skipDates: [...existing, dateStr],
        updatedAt: serverTimestamp(),
      });
      await reloadSubscriptionsForCustomer();
      showToast("Tomorrow skipped successfully!");
    } catch (err) {
      console.error("Error skipping tomorrow", err);
      showToast("Failed to skip tomorrow.", "error");
    }
  }

  async function handleSetVacationRange(
    sub: Subscription,
    from: string,
    to: string
  ) {
    if (!user) return;
    if (!from || !to) {
      showToast("Please select both start and end dates.", "error");
      return;
    }
    if (to < from) {
      showToast("End date must be after start date.", "error");
      return;
    }

    try {
      const ref = doc(db, "tenants", user.tenantId!, "subscriptions", sub.id);
      await updateDoc(ref, {
        vacationFrom: from,
        vacationTo: to,
        updatedAt: serverTimestamp(),
      });
      await reloadSubscriptionsForCustomer();
      showToast("Vacation dates saved!");
    } catch (err) {
      console.error("Error setting vacation range", err);
      showToast("Failed to save vacation dates.", "error");
    }
  }

  const activeSubs = subscriptions.filter((s) => s.isActive);
  const pausedSubs = subscriptions.filter((s) => !s.isActive);

  return (
  <AppLayout
  
    tabs={tabs}
    activeTab={activeTab}
    setActiveTab={setActiveTab}
  >
    {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage("")}
        />
      )}
      <TopBar title="Customer App" />
      <div style={{ padding: 16 }}>

{activeTab === "dashboard" && (
  <DashboardTab
    walletBalance={walletBalance}
    activeSubscriptions={activeSubs.length}
    totalOrders={orders.length}
  />
)}
        {/* Wallet / Billing summary */}
        {activeTab === "wallet" && (
  <WalletTab
    walletLoading={walletLoading}
    walletError={walletError}
    walletBalance={walletBalance}
    walletTotalBilled={walletTotalBilled}
    walletTotalPaid={walletTotalPaid}
    walletTx={walletTx}
  />
)}
        {/* Addresses section */}
        {activeTab === "addresses" && (
  <AddressesTab
    loadingAddresses={loadingAddresses}
    errorAddresses={errorAddresses}
    addresses={addresses}

    newAddrLabel={newAddrLabel}
    newAddrLine1={newAddrLine1}
    newAddrArea={newAddrArea}
    newAddrCity={newAddrCity}
    newAddrPincode={newAddrPincode}
    newAddrPhone={newAddrPhone}
    newAddrMapUrl={newAddrMapUrl}
    newAddrIsDefault={newAddrIsDefault}

    setNewAddrLabel={setNewAddrLabel}
    setNewAddrLine1={setNewAddrLine1}
    setNewAddrArea={setNewAddrArea}
    setNewAddrCity={setNewAddrCity}
    setNewAddrPincode={setNewAddrPincode}
    setNewAddrPhone={setNewAddrPhone}
    setNewAddrMapUrl={setNewAddrMapUrl}
    setNewAddrIsDefault={setNewAddrIsDefault}

    handleAddAddress={handleAddAddress}
    handleSetDefaultAddress={handleSetDefaultAddress}

    savingAddress={savingAddress}
  />
)}
        
        {/* Products section */}
        {activeTab === "products" && (
  <ProductsTab
    products={products}
    categories={categories}
    loadingProducts={loadingProducts}
    errorProducts={errorProducts}
    placingOrderId={placingOrderId}
    handleOrderOnce={handleOrderOnce}
    startSubscription={startSubscription}
  />
)}
       
        {/* Subscription form */}
        
        {subProduct && activeTab === "products" && (
          <section
            id="sub-form"
            style={{
              marginTop: 24,
              padding: 20,
              borderRadius: 12,
              border: "1px solid #e0e0e0",
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Create Subscription</h2>
              <button
                onClick={() => setSubProduct(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#666" }}
              >
                ✕
              </button>
            </div>

            <p style={{ marginTop: 8 }}>
              Product: <strong>{subProduct.name}</strong> ({subProduct.unit}) – ₹{subProduct.price}
            </p>

            <form
              onSubmit={handleCreateSubscription}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start", marginTop: 12 }}
            >
              {/* Start Date */}
              <div>
                <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Start Date</label>
                <input
                  type="date"
                  style={{ width: "100%", padding: 8 }}
                  value={subStartDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setSubStartDate(e.target.value)}
                />
              </div>

              {/* Schedule */}
              <div>
                <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Schedule</label>
                <select
                  style={{ width: "100%", padding: 8 }}
                  value={subSchedule}
                  onChange={(e) => {
                    setSubSchedule(e.target.value);
                    setSubDayQuantities({});
                    setSubCustomDays([]);
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="alternate_days">Alternate days</option>
                  <option value="mon_fri">Mon to Friday</option>
                  <option value="weekends">Weekends</option>
                  <option value="custom">Custom days</option>
                </select>
              </div>

              {/* Base Qty — only for daily and alternate_days */}
              {(subSchedule === "daily" || subSchedule === "alternate_days") && (
                <div>
                  <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Quantity per day</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={subQty}
                    onChange={(e) => setSubQty(e.target.value)}
                  />
                </div>
              )}

              {/* Custom days selector */}
              {subSchedule === "custom" && (
                <div style={{ gridColumn: "1 / span 2", marginTop: 8 }}>
                  <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Select days & quantity:</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                    {DAY_LABELS.map((label, index) => (
                      <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <label
                          style={{
                            border: "1px solid #ccc",
                            borderRadius: 16,
                            padding: "4px 10px",
                            cursor: "pointer",
                            backgroundColor: subCustomDays.includes(index) ? "#111827" : "#fff",
                            color: subCustomDays.includes(index) ? "#fff" : "#111",
                            fontSize: 13,
                            userSelect: "none",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={subCustomDays.includes(index)}
                            onChange={() => toggleCustomDay(index)}
                            style={{ display: "none" }}
                          />
                          {label}
                        </label>
                        {subCustomDays.includes(index) && (
                          <input
                            style={{ width: 60, padding: 4, fontSize: 12, textAlign: "center" }}
                            placeholder="Qty"
                            value={subDayQuantities[index] ?? ""}
                            onChange={(e) => setDayQuantityInput(index, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mon-Fri qty per day */}
              {subSchedule === "mon_fri" && (
                <div style={{ gridColumn: "1 / span 2", marginTop: 8 }}>
                  <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Quantity per day (Mon–Fri):</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                    {[1, 2, 3, 4, 5].map((index) => (
                      <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{DAY_LABELS[index]}</div>
                        <input
                          style={{ width: 60, padding: 4, fontSize: 12, textAlign: "center" }}
                          placeholder={subQty || "1"}
                          value={subDayQuantities[index] ?? ""}
                          onChange={(e) => setDayQuantityInput(index, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: "#555" }}>Leave blank to use base quantity</div>
                </div>
              )}

              {/* Weekends qty per day */}
              {subSchedule === "weekends" && (
                <div style={{ gridColumn: "1 / span 2", marginTop: 8 }}>
                  <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Quantity per day (Weekends):</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                    {[0, 6].map((index) => (
                      <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{DAY_LABELS[index]}</div>
                        <input
                          style={{ width: 60, padding: 4, fontSize: 12, textAlign: "center" }}
                          placeholder={subQty || "1"}
                          value={subDayQuantities[index] ?? ""}
                          onChange={(e) => setDayQuantityInput(index, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: "#555" }}>Leave blank to use base quantity</div>
                </div>
              )}

              {/* Delivery Address */}
              <div style={{ gridColumn: "1 / span 2", marginTop: 8 }}>
                <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Delivery address</label>
                {addresses.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#e11d48" }}>
                    Please add an address in the Addresses tab before creating a subscription.
                  </p>
                ) : (
                  <select
                    style={{ width: "100%", padding: 8, marginTop: 4 }}
                    value={subAddressId}
                    onChange={(e) => setSubAddressId(e.target.value)}
                  >
                    <option value="">— Select address —</option>
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} – {a.line1}{a.area ? `, ${a.area}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {subFormError && (
                <div style={{ gridColumn: "1 / span 2", color: "red", fontSize: 13 }}>
                  {subFormError}
                </div>
              )}

              <div style={{ gridColumn: "1 / span 2", marginTop: 8, display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={savingSub}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: "#111827",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {savingSub ? "Saving..." : "Start Subscription"}
                </button>
                <button
                  type="button"
                  onClick={() => setSubProduct(null)}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Subscriptions section */}
        {activeTab === "subscriptions" && (
  <SubscriptionsTab
    loadingSubs={loadingSubs}
    errorSubs={errorSubs}
    activeSubs={activeSubs}
    pausedSubs={pausedSubs}
    vacationFromMap={vacationFromMap}
    vacationToMap={vacationToMap}
    setVacationFromMap={setVacationFromMap}
    setVacationToMap={setVacationToMap}
    toggleSubscriptionActive={toggleSubscriptionActive}
    handleSkipTomorrow={handleSkipTomorrow}
    handleSetVacationRange={handleSetVacationRange}
    formatSchedule={formatSchedule}
    formatQtyPattern={formatQtyPattern}
    formatAddress={formatAddress}
  />
)}
       
        {/* Recent orders section */}
        {activeTab === "orders" && (
  <OrdersTab
    loadingOrders={loadingOrders}
    errorOrders={errorOrders}
    orders={orders}
    formatAddress={formatAddress}
  />
)}
      </div>
    </AppLayout>
);
}
