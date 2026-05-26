// Admin dashboard for tenant management

import SettingsTab from "./SettingsTab";
import { useEffect, useState } from "react";
import TopBar from "../../components/common/TopBar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { createNotification } from "../../services/Notifications";
import { generateInvoiceForCustomerMonth } from "../../services/invoices";
import CustomersTab from "./CustomersTab";
import DeliveryTab from "./DeliveryTab";
import BillingTab from "./BillingTab";
import ProductsTab from "./ProductsTab";
import OrdersTab from "./OrdersTab";
import DashboardTab from "./DashboardTab";
import Toast from "../../components/common/Toast";
import LogisticsTab from "./LogisticsTab";
import SubscriptionPlansTab from "./SubscriptionPlansTab";
import TeamTab from "./TeamTab";
import DailyManifest from "./DailyManifest";
import { fetchCustomerBalances, getOrderChargeTotal } from "../../services/balances";
import { normalizeOrderStatus } from "../../services/deliveryOrders";

// FIX 1: Added Timestamp to the Firebase imports
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
  limit, 
  orderBy,
  Timestamp 
} from "firebase/firestore";

import { storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// FIX 2: Added the MONTHS array right here at the top
const MONTHS = [
  { value: "1", label: "January" }, { value: "2", label: "February" },
  { value: "3", label: "March" }, { value: "4", label: "April" },
  { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" },
  { value: "9", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["dashboard", "manifest", "customers", "team", "logistics", "delivery", "products", "plans", "billing", "orders", "settings"],
  account_manager: ["dashboard", "customers", "billing", "orders"],
  delivery_manager: ["dashboard", "manifest", "logistics", "delivery", "orders"],
  data_manager: ["dashboard", "products", "plans"],
  view_only: ["dashboard"],
};

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
  imageUrl?: string;
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
  createdAt?: any;
  items: OrderItem[];
  customerId: string;
  source?: string; 
  type?: string;
  routeName?: string;
  totalAmount?: number;
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

type AdminTabKey = "dashboard" | "customers" | "team" | "agents" | "delivery" | "products" | "plans" | "billing" | "orders" | "settings" | "logistics" | "manifest";
type OrderStatusFilter = "All" | "pending" | "delivered" | "cancelled";
type OrderRouteFilter = "all" | "missing";
type BillingBalanceFilter = "all" | "due" | "credit";
type CustomerBalanceFilter = "all" | "low";
type CustomerAddressFilter = "all" | "issues";
type AdminTabOptions = {
  orderStatusFilter?: OrderStatusFilter;
  orderRouteFilter?: OrderRouteFilter;
  billingBalanceFilter?: BillingBalanceFilter;
  customerBalanceFilter?: CustomerBalanceFilter;
  customerAddressFilter?: CustomerAddressFilter;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const userId = user?.uid;
  const tenantId = user?.tenantId;

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
  };

  const [activeTab, setActiveTab] = useState<AdminTabKey>("dashboard");
  const [ordersInitialStatusFilter, setOrdersInitialStatusFilter] = useState<OrderStatusFilter | undefined>();
  const [ordersInitialRouteFilter, setOrdersInitialRouteFilter] = useState<OrderRouteFilter | undefined>();
  const [billingInitialBalanceFilter, setBillingInitialBalanceFilter] = useState<BillingBalanceFilter | undefined>();
  const [customersInitialBalanceFilter, setCustomersInitialBalanceFilter] = useState<CustomerBalanceFilter | undefined>();
  const [customersInitialAddressFilter, setCustomersInitialAddressFilter] = useState<CustomerAddressFilter | undefined>();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin"); // Default fallback
  const [products, setProducts] = useState<Product[]>([]);
  const [newIsSubscribable, setNewIsSubscribable] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError] = useState("");

  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError] = useState("");

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [newImage, setNewImage] = useState<File | null>(null);

  const [paymentCustomerId, setPaymentCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [invCustomerId, setInvCustomerId] = useState("");
  const [invYear, setInvYear] = useState("2026");
  const [invMonth, setInvMonth] = useState("1");
  const [invDeliveryCharge, setInvDeliveryCharge] = useState("");
  const [invSaving, setInvSaving] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invError, setInvError] = useState("");

  const [tenantCustomers, setTenantCustomers] = useState<TenantUser[]>([]);

  const [customerProfileMap, setCustomerProfileMap] = useState<Record<string, { name?: string; phone?: string }>>({});

  const cardStyle: React.CSSProperties = {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
  };

  const openAdminTab = (tab: string, options?: AdminTabOptions) => {
    const nextTab = tab as AdminTabKey;
    if (nextTab === "orders") {
      setOrdersInitialStatusFilter(options?.orderStatusFilter || "All");
      setOrdersInitialRouteFilter(options?.orderRouteFilter || "all");
    }
    if (nextTab === "billing") {
      setBillingInitialBalanceFilter(options?.billingBalanceFilter || "all");
    }
    if (nextTab === "customers") {
      setCustomersInitialBalanceFilter(options?.customerBalanceFilter || "all");
      setCustomersInitialAddressFilter(options?.customerAddressFilter || "all");
    }
    setActiveTab(nextTab);
  };

  const handleWhatsAppReminder = (customerId: string, balance: number) => {
    const profile = customerProfileMap[customerId];
    if (!profile?.phone) {
      showToast("No phone number found.", "error");
      return;
    }
    const cleanPhone = profile.phone.replace(/\D/g, "");
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const message = `Hello ${profile.name || "Customer"}, this is a reminder from ${tenant?.name || "our store"}. Your current balance is *Rs.${balance.toFixed(2)}*. Thank you!`;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  async function loadInvoices() {
    if (!tenant) return;
    setLoadingInvoices(true);
    try {
      const snap = await getDocs(collection(db, "tenants", tenant.id, "invoices"));
      const list: any[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined
        });
      });
      // Sort newest first
      list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      setInvoices(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvoices(false);
    }
  }

  // Auto-load them when the Billing tab is opened
  useEffect(() => {
    if (activeTab === "billing") {
      loadInvoices();
    }
  }, [activeTab, tenant]);

  async function handlePrintInvoice(inv: any) {
    if (!tenant) return;
    
    // 1. Setup Dates & Customer Info
    const customerName = formatCustomerLabel(inv.customerId);
    const monthName = MONTHS.find((m: any) => m.value === String(inv.periodMonth))?.label || "";
    const year = inv.periodYear;
    
    const startDate = new Date(year, inv.periodMonth - 1, 1);
    const endDate = new Date(year, inv.periodMonth, 1);
    const daysInMonth = new Date(year, inv.periodMonth, 0).getDate();

    // 2. Fetch the actual daily orders for this specific month
    let dailyLogs: Record<number, { morning: string[], evening: string[], total: number }> = {};
    
    try {
      const qOrders = query(
        collection(db, "tenants", tenant.id, "orders"),
        where("customerId", "==", inv.customerId),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        where("createdAt", "<", Timestamp.fromDate(endDate))
      );
      
      const snap = await getDocs(qOrders);
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.createdAt) return;
        
        const orderDate = data.createdAt.toDate();
        const dayOfMonth = orderDate.getDate();
        
        if (!dailyLogs[dayOfMonth]) {
          dailyLogs[dayOfMonth] = { morning: [], evening: [], total: 0 };
        }
        
        const shift = data.shift || "Morning"; // Default to Morning if not set
        const itemsList = (data.items || []).map((it: any) => `${it.name} x${it.qty}`).join(", ");
        const orderTotal = (data.items || []).reduce((sum: number, it: any) => sum + (it.price * it.qty), 0);
        
        if (shift === "Morning") dailyLogs[dayOfMonth].morning.push(itemsList);
        else dailyLogs[dayOfMonth].evening.push(itemsList);
        
        dailyLogs[dayOfMonth].total += orderTotal;
      });
    } catch (err) {
      console.error("Failed to load daily orders for print", err);
    }

    // 3. Build the Day-by-Day Table HTML
    let tableRows = "";
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, inv.periodMonth - 1, d);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const log = dailyLogs[d] || { morning: [], evening: [], total: 0 };
      
      const mornStr = log.morning.length > 0 ? log.morning.join("<br/>") : "-";
      const eveStr = log.evening.length > 0 ? log.evening.join("<br/>") : "-";
      const amtStr = log.total > 0 ? `Rs.${log.total.toFixed(2)}` : "-";

      tableRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">${d}</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">${dayName}</td>
          <td style="padding: 8px; border: 1px solid #000;">${mornStr}</td>
          <td style="padding: 8px; border: 1px solid #000;">${eveStr}</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: bold;">${amtStr}</td>
        </tr>
      `;
    }

    // 4. Gather Financial Summary
    const prevBalance = (inv.totalDebits - inv.closingBalance + inv.totalCredits) - (inv.subscriptionCharges + inv.oneTimeCharges + inv.deliveryCharge);
    // Note: The math above estimates previous carryover based on the ledger. 
    
    // 5. Generate Final HTML
    const printContents = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #000;">
        
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">${tenant?.name || "Our Store"}</h1>
          <h3 style="margin: 5px 0 0; font-weight: normal;">Delivery Statement: ${monthName} ${year}</h3>
        </div>

        <div style="margin-bottom: 15px; font-size: 16px;">
          <strong>Customer:</strong> ${customerName}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; border: 1px solid #000; width: 5%;">Date</th>
              <th style="padding: 10px; border: 1px solid #000; width: 10%;">Day</th>
              <th style="padding: 10px; border: 1px solid #000; width: 35%;">Morning</th>
              <th style="padding: 10px; border: 1px solid #000; width: 35%;">Evening</th>
              <th style="padding: 10px; border: 1px solid #000; width: 15%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr style="background-color: #f3f4f6;">
              <td colspan="4" style="padding: 10px; border: 1px solid #000; text-align: right; font-weight: bold;">Sub Total for ${monthName}</td>
              <td style="padding: 10px; border: 1px solid #000; text-align: right; font-weight: bold;">Rs.${(inv.subscriptionCharges + inv.oneTimeCharges).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="width: 350px; margin-left: auto; border: 1px solid #000; padding: 15px; font-size: 14px;">
          <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Summary</h4>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Subscription Orders</span>
            <span>Rs.${(inv.subscriptionCharges || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Other Orders</span>
            <span>Rs.${(inv.oneTimeCharges || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Delivery & Other Charges</span>
            <span>Rs.${(inv.deliveryCharge || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: green;">
            <span>(Minus) Total Payments</span>
            <span>- Rs.${(inv.totalCredits || 0).toFixed(2)}</span>
          </div>
          
          <div style="border-top: 1px solid #ccc; margin: 10px 0;"></div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #dc2626;">
            <span>Previous Month Balance</span>
            <span>Rs.${prevBalance.toFixed(2)}</span>
          </div>
          
          <div style="border-top: 2px solid #000; margin: 10px 0;"></div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 16px;">
            <span>Total Due in ${monthName}</span>
            <span>Rs.${(inv.closingBalance || 0).toFixed(2)}</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #666;">
          Thank you for your business! Please arrange payment at your earliest convenience.
        </div>
      </div>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContents);
      printWindow.document.close();
      // Give the window a moment to render the fetched data before popping the print dialog
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    }
  }

  function handleWhatsAppInvoice(inv: any) {
    const customer = tenantCustomers.find((c) => c.id === inv.customerId);
    if (!customer || !customer.phone) {
      alert("No phone number saved for this customer!");
      return;
    }
    const message = `Hello ${customer.name},\n\nYour invoice for ${inv.periodMonth}/${inv.periodYear} from *${tenant?.name || "our store"}* is ready.\n\n*Total Due: Rs.${inv.closingBalance}*\n\nPlease arrange the payment at your earliest convenience. Thank you!`;
    const waUrl = `https://wa.me/91${customer.phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  }

  function handlePayInvoice(inv: any) {
    setPaymentCustomerId(inv.customerId);
    setPaymentAmount(String(inv.closingBalance));
    setPaymentNote(`Paid invoice for ${inv.periodMonth}/${inv.periodYear}`);
    window.scrollTo({ top: 0, behavior: "smooth" }); // Auto-scrolls to the top!
  }

  useEffect(() => {
    async function loadTenantAndRole() {
      if (!userId) {
        setTenant(null);
        setLoadingTenant(false);
        return;
      }

      setLoadingTenant(true);
      try {
        // 1. Fetch the user's profile to see their role
        const userSnap = await getDoc(doc(db, "users", userId));
        if (userSnap.exists()) {
          setCurrentUserRole(userSnap.data().role || "admin");
        }

        // 2. Load Tenant Data
        if (tenantId) {
          const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
          setTenant(tenantSnap.exists() ? ({ id: tenantSnap.id, ...tenantSnap.data() } as Tenant) : null);
        } else {
          setTenant(null);
        }
      } finally { 
        setLoadingTenant(false); 
      }
    }
    loadTenantAndRole();
  }, [userId, tenantId]);

  // SECURITY MATRIX: Put this HIGH UP, before any 'if (loading) return' statements!
  const allowedTabs = ROLE_PERMISSIONS[currentUserRole] || ROLE_PERMISSIONS["admin"];

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, allowedTabs]);

  // FIX 1: Make sure we actually pull the sortOrder from the database!
  async function loadCategories(tId: string) {
    const snap = await getDocs(collection(db, "tenants", tId, "categories"));
    setCategories(snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, name: data.name, sortOrder: data.sortOrder || 0 };
    }));
  }

  // FIX 2: Ensure banners are loaded
  async function loadBanners(tId: string) {
    const snap = await getDocs(collection(db, "tenants", tId, "banners"));
    setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // LAZY LOADING ENGINE: Only fetch data when the user actually clicks the tab!
  
  // 1. Products & Settings Data (Loads on Dashboard or Products tab)
  useEffect(() => {
    if (tenant && (activeTab === "products" || activeTab === "dashboard")) {
      if (products.length === 0) loadProducts(tenant.id);
      if (categories.length === 0) loadCategories(tenant.id);
      if (banners.length === 0) loadBanners(tenant.id);
    }
  }, [tenant, activeTab]);

  // 2. Orders Data
  useEffect(() => {
    if (tenant && activeTab === "orders") {
      loadOrders(tenant.id);
    }
  }, [tenant, activeTab]);

  // 3. Customer & Billing Data
  useEffect(() => {
    if (tenant && (activeTab === "billing" || activeTab === "customers")) {
      if (accounts.length === 0) loadAccounts(tenant.id);
      if (tenantCustomers.length === 0) loadUsersAndAssignments(tenant.id);
    }
  }, [tenant, activeTab]);

  async function handleUploadBanner(file: File) {
    if (!tenant) return;
    setUploadingBanner(true);
    try {
      // Upload the image to Firebase Storage
      const fileRef = ref(storage, `tenants/${tenant.id}/banners/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(fileRef);
      
      // Save the image link to the database
      await addDoc(collection(db, "tenants", tenant.id, "banners"), {
        tenantId: tenant.id,
        imageUrl,
        isActive: true,
        createdAt: serverTimestamp()
      });
      loadBanners(tenant.id);
      showToast("Banner uploaded successfully!");
    } catch (err) {
      console.error("Banner Upload Error:", err);
      showToast("Failed to upload banner. Check console.", "error");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleDeleteBanner(id: string) {
    if (!tenant) return;
    if (window.confirm("Are you sure you want to delete this banner?")) {
      await updateDoc(doc(db, "tenants", tenant.id, "banners", id), { isActive: false });
      loadBanners(tenant.id);
      showToast("Banner removed");
    }
  }

  // --- CATEGORY SEQUENCE LOGIC ---
  
  async function handleReorderCategories(updates: {id: string, sortOrder: number}[]) {
    if (!tenant) return;
    try {
      // Save all the new sequence numbers to the database at once
      const promises = updates.map(u => 
        updateDoc(doc(db, "tenants", tenant.id, "categories", u.id), { sortOrder: u.sortOrder })
      );
      await Promise.all(promises);
      loadCategories(tenant.id); // Refresh the list correctly
    } catch (err) {
      console.error("Sequence error:", err);
      showToast("Failed to save sequence", "error");
    }
  }

  async function loadProducts(tId: string) {
    setLoadingProducts(true);
    const snap = await getDocs(query(collection(db, "tenants", tId, "products")));
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    setLoadingProducts(false);
  }

  async function loadOrders(tId: string) {
    setLoadingOrders(true);
    const snap = await getDocs(query(collection(db, "tenants", tId, "orders"), orderBy("createdAt", "desc"), limit(300)));
    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    setLoadingOrders(false);
  }

  async function loadAccounts(tId: string) {
    setLoadingAccounts(true);
    try {
      const balanceMap = await fetchCustomerBalances(tId);
      const computedAccounts = Object.values(balanceMap)
        .map((summary) => ({
          id: `${tId}_${summary.customerId}`,
          customerId: summary.customerId,
          outstandingDue: summary.outstandingDue,
        }))
        .sort((a, b) => b.outstandingDue - a.outstandingDue);
      setAccounts(computedAccounts);
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function loadUsersAndAssignments(tId: string) {
    const usersSnap = await getDocs(query(collection(db, "users"), where("tenantId", "==", tId)));
    const custs: TenantUser[] = [];
    const pMap: Record<string, { name?: string; phone?: string }> = {};

    usersSnap.forEach(d => {
      const data = d.data() as any;
      const u = { id: d.id, ...data };
      if (data.role === "customer") {
        custs.push(u);
        pMap[d.id] = { name: data.name, phone: data.phone };
      }
    });

    setTenantCustomers(custs); setCustomerProfileMap(pMap);
  }

  async function handleCreateCategory(name: string, sortOrder: number) { // Added sortOrder
    if (!tenant) return;
    try {
      await addDoc(collection(db, "tenants", tenant.id, "categories"), { name, sortOrder, tenantId: tenant.id, createdAt: serverTimestamp() }); // Saving sortOrder
      loadCategories(tenant.id);
      showToast("Category added!");
    } catch (err) { console.error(err); }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSavingProduct(true);
    try {
      let imageUrl = "";
      if (newImage) {
        const fileRef = ref(storage, `tenants/${tenant.id}/products/${Date.now()}_${newImage.name}`);
        await uploadBytes(fileRef, newImage);
        imageUrl = await getDownloadURL(fileRef);
      }
      await addDoc(collection(db, "tenants", tenant.id, "products"), {
        tenantId: tenant.id, name: newName, unit: newUnit, price: Number(newPrice), isActive: true, categoryId: newCategory, imageUrl, 
        isSubscribable: newIsSubscribable, // SAVING THE FLAG HERE
        createdAt: serverTimestamp()
      });
      setNewName(""); setNewUnit(""); setNewPrice(""); setNewImage(null); setNewIsSubscribable(false); // Reset it
      loadProducts(tenant.id);
      showToast("Product created!");
    } finally { setSavingProduct(false); }
  }

  async function handleUpdateProduct(id: string, updates: any, file?: File | null) {
    if (!tenant) return;
    let final = { ...updates };
    if (file) {
      const fileRef = ref(storage, `tenants/${tenant.id}/products/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      final.imageUrl = await getDownloadURL(fileRef);
    }
    await updateDoc(doc(db, "tenants", tenant.id, "products", id), { ...final, updatedAt: serverTimestamp() });
    loadProducts(tenant.id);
  }

  async function handleToggleProductActive(id: string, current: boolean) {
    if (!tenant) return;
    await updateDoc(doc(db, "tenants", tenant.id, "products", id), { isActive: !current });
    loadProducts(tenant.id);
  }

      async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSavingPayment(true);
    try {
      const amount = Number(paymentAmount);
      await addDoc(collection(db, "tenants", tenant.id, "billingTransactions"), { tenantId: tenant.id, customerId: paymentCustomerId, type: "payment", amount, note: paymentNote || "Payment received", createdAt: serverTimestamp() });
      await setDoc(doc(db, "tenants", tenant.id, "customerAccounts", `${tenant.id}_${paymentCustomerId}`), { outstandingDue: increment(-amount) }, { merge: true });
      await createNotification({ tenantId: tenant.id, userId: paymentCustomerId, type: "payment", title: "Payment received", message: `Rs.${amount} recorded.` });
      setPaymentAmount(""); setPaymentCustomerId(""); loadAccounts(tenant.id);
      showToast("Payment recorded!");
    } finally { setSavingPayment(false); }
  }

  async function handleGenerateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setInvSaving(true);
    try {
      await generateInvoiceForCustomerMonth({ tenantId: tenant.id, customerId: invCustomerId, year: Number(invYear), month: Number(invMonth), deliveryCharge: Number(invDeliveryCharge)});    
      showToast("Invoice generated!"); loadInvoices();
    } catch (e:any) { console.error("INVOICE ERROR:", e); setInvError("Failed."); } finally { setInvSaving(false); }
  }

  async function loadOrderBillingState(tId: string, orderId: string) {
    const txSnap = await getDocs(query(collection(db, "tenants", tId, "billingTransactions"), where("orderId", "==", orderId)));
    let charges = 0;
    let reversals = 0;
    txSnap.forEach((txDoc) => {
      const data = txDoc.data() as any;
      const type = String(data.type || "").toLowerCase();
      const amount = Number(data.amount || 0);
      if (type === "order_charge") charges += amount;
      if (type === "order_reversal") reversals += amount;
    });
    return { charges, reversals, net: charges - reversals };
  }

  async function handleUpdateOrderStatus(id: string, status: string, cancellationReason?: string) {
    if (!tenant) return;
    const normalizedStatus = status === "not_delivered" || status === "cancelled" ? "not_delivered" : status;
    const targetStatus = normalizeOrderStatus(normalizedStatus);
    let orderRecord: any = orders.find((order) => order.id === id);
    if (!orderRecord) {
      const orderSnap = await getDoc(doc(db, "tenants", tenant.id, "orders", id));
      if (orderSnap.exists()) orderRecord = { id: orderSnap.id, ...orderSnap.data() };
    }

    const updates: any = { status: normalizedStatus };
    if (normalizedStatus === "not_delivered") {
      updates.cancellationReason = cancellationReason || "Cancelled by admin";
      updates.cancelledBy = userId || "admin";
      updates.cancelledAt = serverTimestamp();
    } else {
      updates.cancellationReason = null;
    }

    await updateDoc(doc(db, "tenants", tenant.id, "orders", id), updates);
    if (orderRecord?.customerId) {
      const previousStatus = normalizeOrderStatus(orderRecord.status);
      const billingState = await loadOrderBillingState(tenant.id, id);
      const amount = getOrderChargeTotal(orderRecord);

      if (targetStatus === "delivered" && amount > 0 && billingState.net <= 0) {
        await addDoc(collection(db, "tenants", tenant.id, "billingTransactions"), {
          tenantId: tenant.id,
          customerId: orderRecord.customerId,
          orderId: id,
          type: "order_charge",
          amount,
          note: "Order delivered",
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "tenants", tenant.id, "customerAccounts", `${tenant.id}_${orderRecord.customerId}`), { outstandingDue: increment(amount), updatedAt: serverTimestamp() }, { merge: true });
      }

      if (previousStatus === "delivered" && targetStatus !== "delivered" && billingState.net > 0) {
        await addDoc(collection(db, "tenants", tenant.id, "billingTransactions"), {
          tenantId: tenant.id,
          customerId: orderRecord.customerId,
          orderId: id,
          type: "order_reversal",
          amount: billingState.net,
          note: cancellationReason || "Order status changed by admin",
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "tenants", tenant.id, "customerAccounts", `${tenant.id}_${orderRecord.customerId}`), { outstandingDue: increment(-billingState.net), updatedAt: serverTimestamp() }, { merge: true });
      }
    }
    loadOrders(tenant.id);
    loadAccounts(tenant.id);
  }

  function formatCustomerLabel(id: string) {
    const p = customerProfileMap[id];
    return p?.name ? `${p.name} (${id.slice(-4)})` : id;
  }


  if (loadingTenant) return <div className="desktop-container"><p>Loading...</p></div>;

    return (
    <div style={{ background: "#f9fafb", minHeight: "100vh" }}>
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />}
      <TopBar title="Admin Panel" />
      <div className="desktop-container">
        {tenant && <div style={cardStyle}><h2>{tenant.name}</h2><p>Code: {tenant.code}</p></div>}
        
        <div style={{ display: "flex", gap: 8, margin: "20px 0", flexWrap: "wrap", justifyContent: "center" }}>
          {allowedTabs.map(k => (
  <button key={k} onClick={() => openAdminTab(k)} style={{ padding: "8px 14px", borderRadius: 20, background: activeTab === k ? "#111827" : "#fff", color: activeTab === k ? "#fff" : "#333", cursor: "pointer", border: "1px solid #ddd", fontSize: 13 }}>
    {k.toUpperCase()}
  </button>
))}
        </div>

        {activeTab === "dashboard" && <DashboardTab onOpenTab={openAdminTab} />}
        {activeTab === "manifest" && <DailyManifest />}
        {activeTab === "customers" && <CustomersTab initialBalanceFilter={customersInitialBalanceFilter} initialAddressFilter={customersInitialAddressFilter} />}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "delivery" && <DeliveryTab />}
        {activeTab === "products" && <ProductsTab {...{cardStyle, products, categories, banners, loadingProducts, productsError, newName, newUnit, newPrice, newCategory, savingProduct, setNewName, setNewUnit, setNewPrice, setNewCategory, setNewImage, handleCreateProduct, handleUpdateProduct, handleToggleProductActive, handleCreateCategory, handleUpdateCategory: async () => {}, handleReorderCategories, handleUploadBanner, handleDeleteBanner, uploadingBanner, newIsSubscribable, setNewIsSubscribable}} />}
        {activeTab === "billing" && <BillingTab {...{cardStyle, accounts, loadingAccounts, accountsError, paymentCustomerId, paymentAmount, paymentNote, savingPayment, invCustomerId, invYear, invMonth, invDeliveryCharge, invSaving, invError, setPaymentCustomerId, setPaymentAmount, setPaymentNote, setInvCustomerId, setInvYear, setInvMonth, setInvDeliveryCharge, handleRecordPayment, handleGenerateInvoice, formatCustomerLabel, handleWhatsAppReminder}} customers={tenantCustomers} invoices={invoices} loadingInvoices={loadingInvoices} handlePrintInvoice={handlePrintInvoice} handleWhatsAppInvoice={handleWhatsAppInvoice} handlePayInvoice={handlePayInvoice} initialBalanceFilter={billingInitialBalanceFilter}/>}
        {activeTab === "orders" && <OrdersTab {...{cardStyle, orders, loadingOrders, ordersError, formatCustomerLabel, handleUpdateOrderStatus}} initialStatusFilter={ordersInitialStatusFilter} initialRouteFilter={ordersInitialRouteFilter} />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "logistics" && <LogisticsTab />}
        {activeTab === "plans" && <SubscriptionPlansTab />}
        
      </div>
    </div>
  );
}
