import { useEffect, useMemo, useState } from "react";
import { arrayUnion, collection, doc, getDocs, increment, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import {
  doesSubscriptionRunOnDate,
  getLocalDateString,
  normalizeShift,
  parseLocalDate,
  type DateLike,
} from "../../services/deliverySlots";
import {
  fetchOrdersForDeliveryDate,
  normalizeOrderStatus,
  type DeliveryOrder,
  type OrderShift,
} from "../../services/deliveryOrders";
import { createOneTimeFollowUpOrder } from "../../services/oneTimeFollowUps";
import {
  buildDeliveryInstanceId,
  buildDeliveryInstanceLookupKey,
  createDeliveryInstances,
  fetchDeliveryInstancesForDate,
  readDeliveryInstanceItemQty,
  type DeliveryInstanceItemSource,
  type DeliveryInstance,
  type DeliveryInstanceWriteInput,
} from "../../services/deliveryInstances";

interface Subscription {
  id: string;
  customerId: string;
  customerName?: string;
  productId?: string;
  productName: string;
  unit: string;
  price: number;
  qty: number;
  scheduleType: string;
  scheduleDays?: number[];
  dayQuantities?: Record<string, number>;
  skipDates?: string[];
  vacationFrom?: string;
  vacationTo?: string;
  deliveryAddress?: any;
  shift?: string;
  deliveryShift?: string;
  startDate?: DateLike;
  isActive?: boolean;
  addressId?: string;
  routeStatus?: string;
  routeId?: string;
  routeName?: string;
  zoneId?: string;
  hubId?: string;
}

interface Route {
  id: string;
  name: string;
  zoneId?: string;
}

interface CustomerRoute {
  customerId: string;
  routeId?: string;
  routeName: string;
  zoneId?: string;
  hubId?: string;
}

interface AddressRoute {
  addressId?: string;
  routeId?: string | null;
  routeName?: string | null;
  zoneId?: string | null;
  hubId?: string | null;
  routeStatus?: string | null;
}

interface DeliveryItem {
  source?: DeliveryInstanceItemSource;
  sourceId?: string;
  productId?: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
}

type DeliveryRowSource = "Subscription" | "One-time" | "Mixed";

interface DeliveryRow {
  id: string;
  deliveryInstanceKey: string;
  addressId?: string;
  deliveryAddress?: any;
  customerId: string;
  customerName: string;
  address: string;
  routeId?: string;
  routeName: string;
  zoneId?: string;
  hubId?: string;
  shift: OrderShift;
  source: DeliveryRowSource;
  status: string;
  items: DeliveryItem[];
  orderId?: string;
  deliveryInstanceId?: string;
  isExpectedOnly?: boolean;
  isFromInstance?: boolean;
}

const SHIFT_OPTIONS = ["All", "Morning", "Evening"] as const;
const STATUS_OPTIONS = ["All", "expected", "confirmed", "delivered", "cancelled"] as const;
const CANCELLATION_REASONS = [
  "Customer requested cancellation",
  "Product unavailable",
  "Address not reachable",
  "Delivery not possible",
  "Duplicate entry",
  "Other",
];

function formatAddress(address: any) {
  if (!address) return "No address listed";
  return [address.label, address.line1, address.area, address.city, address.pincode].filter(Boolean).join(", ") || "No address listed";
}

function cleanAddressPart(value: any) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function addressFingerprint(address: any) {
  if (!address) return "";
  return [
    cleanAddressPart(address.line1),
    cleanAddressPart(address.area),
    cleanAddressPart(address.city),
    cleanAddressPart(address.pincode),
  ].filter(Boolean).join("|");
}

function addressGroupingKey(address: any, fallbackAddressId?: string) {
  return addressFingerprint(address) || fallbackAddressId || address?.addressId || address?.id || "default";
}

function addressLookupKeys(customerId: string, address: any, fallbackAddressId?: string) {
  const keys: string[] = [];
  const addressId = fallbackAddressId || address?.addressId || address?.id || "";
  const fingerprint = addressFingerprint(address);

  if (addressId) keys.push(`${customerId}::id::${addressId}`);
  if (fingerprint) keys.push(`${customerId}::addr::${fingerprint}`);
  return keys;
}

function findCurrentAddressRoute(customerId: string, address: any, addressRoutes: Record<string, AddressRoute>, fallbackAddressId?: string) {
  for (const key of addressLookupKeys(customerId, address, fallbackAddressId)) {
    const route = addressRoutes[key];
    if (route) return route;
  }
  return undefined;
}

function resolveCustomerName(customerId: string, rawName: any, customerNames: Record<string, string>) {
  const name = String(rawName || "").trim();
  if (name && name !== "Customer" && name !== customerId) return name;
  return customerNames[customerId] || "Customer";
}

function addOrMergeItem(items: DeliveryItem[], item: DeliveryItem) {
  const existing = items.find((current) => current.productId === item.productId && current.name === item.name && current.unit === item.unit && current.price === item.price);
  if (existing) {
    existing.qty += item.qty;
  } else {
    items.push(item);
  }
}

function resolveOrderRoute(order: any, mappedRoute: Partial<CustomerRoute>, currentAddressRoute?: AddressRoute) {
  const addressRoute = order.deliveryAddress || {};
  return {
    routeId: currentAddressRoute?.routeId || addressRoute.routeId || order.routeId || mappedRoute.routeId,
    routeName: currentAddressRoute?.routeName || addressRoute.routeName || order.routeName || mappedRoute.routeName || "Unassigned",
    zoneId: currentAddressRoute?.zoneId || addressRoute.zoneId || order.zoneId || mappedRoute.zoneId,
    hubId: currentAddressRoute?.hubId || addressRoute.hubId || order.hubId || mappedRoute.hubId,
  };
}

function resolveSubscriptionRoute(sub: Subscription, mappedRoute: Partial<CustomerRoute>, currentAddressRoute?: AddressRoute) {
  const addressRoute = sub.deliveryAddress || {};
  return {
    routeId: currentAddressRoute?.routeId || addressRoute.routeId || mappedRoute.routeId || sub.routeId,
    routeName: currentAddressRoute?.routeName || addressRoute.routeName || mappedRoute.routeName || sub.routeName || "Unassigned",
    zoneId: currentAddressRoute?.zoneId || addressRoute.zoneId || mappedRoute.zoneId || sub.zoneId,
    hubId: currentAddressRoute?.hubId || addressRoute.hubId || mappedRoute.hubId || sub.hubId,
  };
}

function itemQuantity(items: DeliveryItem[]) {
  return items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatProductName(item: Pick<DeliveryItem, "name" | "unit">) {
  return item.unit ? `${item.name} (${item.unit})` : item.name;
}

function formatDeliveryItem(item: DeliveryItem) {
  return `${formatProductName(item)} x ${formatQty(Number(item.qty || 0))}`;
}

function escapeCsvCell(value: any) {
  const raw = String(value ?? "");
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function cleanBillingIdPart(value: any) {
  return String(value || "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "item";
}

function cleanDeliveryInstanceItemsForWrite(items: DeliveryInstance["items"]) {
  return items.map((item) => ({
    source: item.source,
    sourceId: item.sourceId || null,
    productId: item.productId || null,
    name: item.name,
    unit: item.unit,
    price: Number(item.price || 0),
    originalQty: Number(item.originalQty || 0),
    plannedQty: Number(item.plannedQty || 0),
    deliveredQty: item.deliveredQty ?? null,
    billingTransactionId: item.billingTransactionId || null,
    billedAmount: item.billedAmount ?? null,
    billedAt: item.billedAt || null,
    fulfillmentStatus: item.fulfillmentStatus || null,
    rescheduledQty: item.rescheduledQty ?? null,
    followUpOrderId: item.followUpOrderId || null,
  }));
}

function getCancellationCreditAmount(item: DeliveryInstance["items"][number]) {
  if (item.source !== "subscription" || !item.billingTransactionId) return 0;
  const currentConfirmedAmount = Number(item.price || 0) * Number(item.plannedQty || 0);
  return currentConfirmedAmount > 0 ? currentConfirmedAmount : Number(item.billedAmount || 0);
}

function displayStatusForRow(row: DeliveryRow) {
  const normalized = normalizeOrderStatus(row.status);
  if (normalized === "delivered" || normalized === "cancelled") return normalized;
  if (row.isFromInstance) return "confirmed";
  if (row.isExpectedOnly) return "expected";
  if (row.source === "One-time" || row.source === "Mixed") return "confirmed";
  return "expected";
}

function instanceSourceLabel(instance: DeliveryInstance): DeliveryRowSource {
  const sources = new Set(instance.items.map((item) => item.source));
  if (sources.size === 1 && sources.has("subscription")) return "Subscription";
  if (sources.size === 1 && sources.has("one-time")) return "One-time";
  return "Mixed";
}

function mergeRowSource(a: DeliveryRowSource, b: DeliveryRowSource): DeliveryRowSource {
  if (a === b) return a;
  return "Mixed";
}

function mergeRowsByDeliveryStop(rows: DeliveryRow[]) {
  const merged = new Map<string, DeliveryRow>();

  rows.forEach((row) => {
    const existing = merged.get(row.deliveryInstanceKey);
    if (!existing) {
      merged.set(row.deliveryInstanceKey, { ...row, items: [...row.items] });
      return;
    }

    row.items.forEach((item) => addOrMergeItem(existing.items, item));
    existing.id = `${existing.id}_${row.id}`;
    existing.orderId = existing.orderId || row.orderId;
    existing.deliveryInstanceId = existing.deliveryInstanceId || row.deliveryInstanceId;
    existing.source = mergeRowSource(existing.source, row.source);
    existing.isExpectedOnly = Boolean(existing.isExpectedOnly && row.isExpectedOnly);
    existing.isFromInstance = Boolean(existing.isFromInstance || row.isFromInstance);
  });

  return Array.from(merged.values());
}

function isSubscriptionOrder(order: DeliveryOrder) {
  return order.source === "subscription" || order.type === "subscription";
}

function subscriptionQtyForDate(sub: Subscription, targetDate: Date) {
  const dayQty = sub.dayQuantities?.[String(targetDate.getDay())];
  return typeof dayQty === "number" ? dayQty : sub.qty;
}

function statusLabel(status: string) {
  if (status === "expected") return "Expected";
  if (status === "confirmed") return "Confirmed";
  const normalized = normalizeOrderStatus(status);
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "pending") return "Pending";
  return status || "Pending";
}

function statusColor(status: string) {
  if (status === "expected") return { background: "#dbeafe", color: "#1d4ed8" };
  if (status === "confirmed") return { background: "#dcfce7", color: "#15803d" };
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return { background: "#dcfce7", color: "#15803d" };
  if (normalized === "cancelled") return { background: "#fee2e2", color: "#b91c1c" };
  return { background: "#fef3c7", color: "#92400e" };
}

export default function DailyManifest() {
  const { user } = useAuth();
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [preparingSheet, setPreparingSheet] = useState(false);
  const [cancellingRowId, setCancellingRowId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [cancelRow, setCancelRow] = useState<DeliveryRow | null>(null);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [qtyEditRow, setQtyEditRow] = useState<DeliveryRow | null>(null);
  const [qtyEditValues, setQtyEditValues] = useState<string[]>([]);
  const [qtyEditReason, setQtyEditReason] = useState("");
  const [qtyEditError, setQtyEditError] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [deliveryInstances, setDeliveryInstances] = useState<DeliveryInstance[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [customerRoutes, setCustomerRoutes] = useState<Record<string, CustomerRoute>>({});
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [addressRoutes, setAddressRoutes] = useState<Record<string, AddressRoute>>({});
  const [selectedDateStr, setSelectedDateStr] = useState(getLocalDateString(new Date()));
  const [selectedShift, setSelectedShift] = useState<(typeof SHIFT_OPTIONS)[number]>("All");
  const [selectedRoute, setSelectedRoute] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadBaseData() {
      if (!user?.tenantId) return;
      setLoadingBase(true);
      try {
        const tenantId = user.tenantId;
        const [subsSnap, routesSnap, assignmentsSnap, usersSnap, addressesSnap] = await Promise.all([
          getDocs(query(collection(db, "tenants", tenantId, "subscriptions"), where("isActive", "==", true))),
          getDocs(query(collection(db, "tenants", tenantId, "routes"))),
          getDocs(query(collection(db, "tenants", tenantId, "customerAssignments"))),
          getDocs(query(collection(db, "users"), where("tenantId", "==", tenantId))),
          getDocs(query(collection(db, "tenants", tenantId, "addresses"))),
        ]);

        const routeList = routesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Route));
        const routeByName = new Map(routeList.map((route) => [route.name, route]));
        const routeById = new Map(routeList.map((route) => [route.id, route]));
        const routeMap: Record<string, CustomerRoute> = {};

        assignmentsSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data.customerId) return;
          const routeFromId = data.routeId ? routeById.get(data.routeId) : undefined;
          const routeFromName = data.routeName ? routeByName.get(data.routeName) : undefined;
          const route = routeFromId || routeFromName;
          routeMap[data.customerId] = {
            customerId: data.customerId,
            routeId: data.routeId || route?.id || undefined,
            routeName: data.routeName || route?.name || "Unassigned",
            zoneId: data.zoneId || route?.zoneId || undefined,
            hubId: data.hubId || undefined,
          };
        });

        usersSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.role !== "customer" || routeMap[docSnap.id]) return;
          const routeFromId = data.routeId ? routeById.get(data.routeId) : undefined;
          const routeFromName = data.routeName ? routeByName.get(data.routeName) : undefined;
          const route = routeFromId || routeFromName;
          routeMap[docSnap.id] = {
            customerId: docSnap.id,
            routeId: data.routeId || route?.id || undefined,
            routeName: data.routeName || route?.name || "Unassigned",
            zoneId: route?.zoneId || undefined,
          };
        });

        const nameMap: Record<string, string> = {};
        usersSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.role !== "customer") return;
          const name = String(data.name || "").trim();
          if (name) nameMap[docSnap.id] = name;
        });

        const addressRouteMap: Record<string, AddressRoute> = {};
        addressesSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const customerId = String(data.customerId || "");
          if (!customerId) return;

          const routeInfo: AddressRoute = {
            addressId: docSnap.id,
            routeId: data.routeId || null,
            routeName: data.routeName || null,
            zoneId: data.zoneId || null,
            hubId: data.hubId || null,
            routeStatus: data.routeStatus || null,
          };
          addressRouteMap[`${customerId}::id::${docSnap.id}`] = routeInfo;

          const fingerprint = addressFingerprint(data);
          if (fingerprint) addressRouteMap[`${customerId}::addr::${fingerprint}`] = routeInfo;
        });

        setSubscriptions(subsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Subscription)));
        setRoutes(routeList);
        setCustomerRoutes(routeMap);
        setCustomerNames(nameMap);
        setAddressRoutes(addressRouteMap);
      } catch (error) {
        console.error("Failed to load manifest base data", error);
      } finally {
        setLoadingBase(false);
      }
    }

    void loadBaseData();
  }, [user]);

  useEffect(() => {
    async function loadOrdersForDate() {
      if (!user?.tenantId) return;
      setLoadingOrders(true);
      try {
        setOrders(await fetchOrdersForDeliveryDate(user.tenantId, selectedDateStr));
      } catch (error) {
        console.error("Failed to load delivery orders", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }

    void loadOrdersForDate();
  }, [user, selectedDateStr]);

  useEffect(() => {
    async function loadDeliveryInstancesForDate() {
      if (!user?.tenantId) {
        setLoadingInstances(false);
        return;
      }
      setLoadingInstances(true);
      try {
        setDeliveryInstances(await fetchDeliveryInstancesForDate(user.tenantId, selectedDateStr));
      } catch (error) {
        console.warn("Failed to load delivery instances; using generated manifest rows.", error);
        setDeliveryInstances([]);
      } finally {
        setLoadingInstances(false);
      }
    }

    void loadDeliveryInstancesForDate();
  }, [user, selectedDateStr]);

  const deliveryRows = useMemo(() => {
    const targetDate = parseLocalDate(selectedDateStr);
    if (!targetDate) return [];

    const instanceRows: DeliveryRow[] = deliveryInstances.map((instance) => {
      const mappedRoute = customerRoutes[instance.customerId] || {};
      const currentAddressRoute = findCurrentAddressRoute(instance.customerId, instance.deliveryAddress, addressRoutes, instance.addressId);
      const resolvedRoute = resolveOrderRoute(instance, mappedRoute, currentAddressRoute);
      const items = instance.items.map((item) => ({
        productId: item.productId,
        name: item.name || "Item",
        unit: item.unit || "unit",
        price: Number(item.price || 0),
        qty: readDeliveryInstanceItemQty(item, instance.status),
      }));

      return {
        id: instance.id,
        deliveryInstanceId: instance.id,
        deliveryInstanceKey: buildDeliveryInstanceLookupKey(instance),
        addressId: instance.addressId,
        deliveryAddress: instance.deliveryAddress,
        customerId: instance.customerId,
        customerName: resolveCustomerName(instance.customerId, instance.customerName, customerNames),
        address: formatAddress(instance.deliveryAddress),
        routeId: resolvedRoute.routeId || undefined,
        routeName: resolvedRoute.routeName,
        zoneId: resolvedRoute.zoneId || undefined,
        hubId: resolvedRoute.hubId || undefined,
        shift: instance.shift,
        source: instanceSourceLabel(instance),
        status: instance.status,
        items,
        isFromInstance: true,
      };
    });
    const instanceKeys = new Set(instanceRows.map((row) => row.deliveryInstanceKey));

    const actualSubscriptionKeys = new Set<string>();
    const rows: DeliveryRow[] = orders.map((order) => {
      const orderInstanceKey = buildDeliveryInstanceLookupKey({
        customerId: order.customerId,
        deliveryDate: selectedDateStr,
        shift: order.computedShift,
        addressId: order.addressId || order.deliveryAddress?.addressId,
        deliveryAddress: order.deliveryAddress,
      });
      if (isSubscriptionOrder(order)) {
        const orderAddressKey = addressGroupingKey(order.deliveryAddress, order.addressId || order.deliveryAddress?.addressId);
        actualSubscriptionKeys.add(`${order.customerId}_${order.computedShift}_${orderAddressKey}`);
      }

      const mappedRoute = customerRoutes[order.customerId] || {};
      const currentAddressRoute = findCurrentAddressRoute(order.customerId, order.deliveryAddress, addressRoutes, order.addressId);
      const resolvedRoute = resolveOrderRoute(order, mappedRoute, currentAddressRoute);
      const items = (order.items || []).map((item: any) => ({
        source: isSubscriptionOrder(order) ? "subscription" as const : "one-time" as const,
        sourceId: order.id,
        productId: item.productId,
        name: item.name || item.productName || "Item",
        unit: item.unit || "unit",
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
      }));

      return {
        id: order.id,
        orderId: order.id,
        deliveryInstanceKey: orderInstanceKey,
        addressId: order.addressId || order.deliveryAddress?.addressId,
        deliveryAddress: order.deliveryAddress,
        customerId: order.customerId,
        customerName: resolveCustomerName(order.customerId, order.customerName, customerNames),
        address: formatAddress(order.deliveryAddress),
        routeId: resolvedRoute.routeId || undefined,
        routeName: resolvedRoute.routeName,
        zoneId: resolvedRoute.zoneId || undefined,
        hubId: resolvedRoute.hubId || undefined,
        shift: order.computedShift,
        source: isSubscriptionOrder(order) ? "Subscription" : "One-time",
        status: order.status || "pending",
        items,
      };
    });

    const expectedByCustomerShift = new Map<string, DeliveryRow>();

    subscriptions.forEach((sub) => {
      if (!doesSubscriptionRunOnDate(sub, targetDate)) return;

      const shift = normalizeShift(sub.deliveryShift || sub.shift) || "Morning";
      const existingKey = `${sub.customerId}_${shift}`;
      const addressRoute = sub.deliveryAddress || {};
      const addressKey = addressGroupingKey(addressRoute, sub.addressId || addressRoute.addressId);
      const groupedKey = `${existingKey}_${addressKey}`;
      if (actualSubscriptionKeys.has(groupedKey)) return;

      const qty = subscriptionQtyForDate(sub, targetDate);
      if (qty <= 0) return;

      const mappedRoute = customerRoutes[sub.customerId] || {};
      const currentAddressRoute = findCurrentAddressRoute(sub.customerId, addressRoute, addressRoutes, sub.addressId);
      const resolvedRoute = resolveSubscriptionRoute(sub, mappedRoute, currentAddressRoute);
      const current = expectedByCustomerShift.get(groupedKey);
      const item: DeliveryItem = {
        source: "subscription",
        sourceId: sub.id,
        productId: sub.productId,
        name: sub.productName || "Subscription Item",
        unit: sub.unit || "unit",
        price: Number(sub.price || 0),
        qty: Number(qty || 1),
      };

      if (current) {
        addOrMergeItem(current.items, item);
      } else {
        const deliveryInstanceKey = buildDeliveryInstanceLookupKey({
          customerId: sub.customerId,
          deliveryDate: selectedDateStr,
          shift,
          addressId: sub.addressId || addressRoute.addressId,
          deliveryAddress: addressRoute,
        });
        expectedByCustomerShift.set(groupedKey, {
          id: `expected_${groupedKey}`,
          deliveryInstanceKey,
          addressId: sub.addressId || addressRoute.addressId,
          deliveryAddress: sub.deliveryAddress,
          customerId: sub.customerId,
          customerName: resolveCustomerName(sub.customerId, sub.customerName, customerNames),
          address: formatAddress(sub.deliveryAddress),
          routeId: resolvedRoute.routeId || undefined,
          routeName: resolvedRoute.routeName,
          zoneId: resolvedRoute.zoneId || undefined,
          hubId: resolvedRoute.hubId || undefined,
          shift,
          source: "Subscription",
          status: "pending",
          items: [item],
          isExpectedOnly: true,
        });
      }
    });

    const generatedRows = [...rows, ...Array.from(expectedByCustomerShift.values())].filter((row) => !instanceKeys.has(row.deliveryInstanceKey));

    return mergeRowsByDeliveryStop([...instanceRows, ...generatedRows]).sort((a, b) => {
      const routeCompare = a.routeName.localeCompare(b.routeName);
      if (routeCompare !== 0) return routeCompare;
      if (a.shift !== b.shift) return a.shift === "Morning" ? -1 : 1;
      return a.customerName.localeCompare(b.customerName);
    });
  }, [addressRoutes, customerNames, customerRoutes, deliveryInstances, orders, selectedDateStr, subscriptions]);

  const routeOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = routes.map((route) => ({ key: route.id, label: route.name }));
    routes.forEach((route) => seen.add(route.id));

    deliveryRows.forEach((row) => {
      const key = row.routeId || row.routeName;
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({ key, label: row.routeName || "Unassigned" });
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [deliveryRows, routes]);

  const rowsBeforeStatusFilter = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return deliveryRows.filter((row) => {
      const matchesShift = selectedShift === "All" || row.shift === selectedShift;
      const routeKey = row.routeId || row.routeName;
      const matchesRoute = selectedRoute === "All" || routeKey === selectedRoute || row.routeName === selectedRoute;
      const matchesSearch =
        !search ||
        row.customerName.toLowerCase().includes(search) ||
        row.address.toLowerCase().includes(search) ||
        row.items.some((item) => item.name.toLowerCase().includes(search));
      return matchesShift && matchesRoute && matchesSearch;
    });
  }, [deliveryRows, searchTerm, selectedRoute, selectedShift]);

  const filteredRows = useMemo(() => {
    return rowsBeforeStatusFilter.filter((row) => {
      if (selectedStatus === "All") return true;
      return displayStatusForRow(row) === selectedStatus;
    });
  }, [rowsBeforeStatusFilter, selectedStatus]);

  const rowsForPreparation = useMemo(() => {
    return deliveryRows.filter((row) => {
      const routeKey = row.routeId || row.routeName;
      const matchesShift = selectedShift === "All" || row.shift === selectedShift;
      const matchesRoute = selectedRoute === "All" || routeKey === selectedRoute || row.routeName === selectedRoute;
      const displayStatus = displayStatusForRow(row);
      return !row.isFromInstance && matchesShift && matchesRoute && displayStatus !== "delivered" && displayStatus !== "cancelled";
    });
  }, [deliveryRows, selectedRoute, selectedShift]);

  const productSummary = useMemo(() => {
    const totals = new Map<string, { name: string; unit: string; qty: number }>();
    filteredRows.forEach((row) => {
      row.items.forEach((item) => {
        const key = `${item.name}_${item.unit}`;
        const current = totals.get(key) || { name: formatProductName(item), unit: "", qty: 0 };
        current.qty += Number(item.qty || 0);
        totals.set(key, current);
      });
    });
    return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredRows]);

  const statusSummary = useMemo(() => {
    const summary = {
      expected: { label: "Expected", deliveries: 0, quantity: 0 },
      confirmed: { label: "Confirmed", deliveries: 0, quantity: 0 },
      delivered: { label: "Delivered", deliveries: 0, quantity: 0 },
      cancelled: { label: "Cancelled", deliveries: 0, quantity: 0 },
    };

    rowsBeforeStatusFilter.forEach((row) => {
      const status = displayStatusForRow(row);
      summary[status].deliveries += 1;
      summary[status].quantity += itemQuantity(row.items);
    });

    return summary;
  }, [rowsBeforeStatusFilter]);

  const totalQuantity = filteredRows.reduce((sum, row) => sum + itemQuantity(row.items), 0);
  const loading = loadingBase || loadingOrders || loadingInstances;
  const qtyEditInstance = qtyEditRow?.deliveryInstanceId
    ? deliveryInstances.find((current) => current.id === qtyEditRow.deliveryInstanceId)
    : undefined;
  const cancelInstance = cancelRow?.deliveryInstanceId
    ? deliveryInstances.find((current) => current.id === cancelRow.deliveryInstanceId)
    : undefined;

  const cancelPreview = useMemo(() => {
    if (!cancelInstance) return [];
    return cancelInstance.items.map((item) => ({
      item,
      qty: Number(item.plannedQty || 0),
      creditAmount: getCancellationCreditAmount(item),
    }));
  }, [cancelInstance]);

  const totalCancelCredit = cancelPreview.reduce((sum, item) => sum + item.creditAmount, 0);

  const qtyEditPreview = useMemo(() => {
    if (!qtyEditInstance) return [];
    return qtyEditInstance.items.map((item, index) => {
      const oldQty = Number(item.plannedQty || 0);
      const newQty = Number(qtyEditValues[index]);
      const safeNewQty = Number.isFinite(newQty) ? newQty : oldQty;
      const delta = safeNewQty - oldQty;
      const amount = item.source === "subscription" ? Math.abs(delta) * Number(item.price || 0) : 0;
      const followUpQty = item.source === "one-time" && delta < 0 ? Math.abs(delta) : 0;
      return { item, oldQty, newQty: safeNewQty, delta, amount, followUpQty };
    });
  }, [qtyEditInstance, qtyEditValues]);

  async function handlePrepareDeliverySheet() {
    if (!user?.tenantId) return;
    if (rowsForPreparation.length === 0) {
      alert("No new deliveries to prepare for the selected date, shift, and route.");
      return;
    }

    const groupedRows = new Map<string, DeliveryRow[]>();
    rowsForPreparation.forEach((row) => {
      const rows = groupedRows.get(row.deliveryInstanceKey) || [];
      rows.push(row);
      groupedRows.set(row.deliveryInstanceKey, rows);
    });

    const ok = window.confirm(`Prepare ${rowsForPreparation.length} delivery rows into ${groupedRows.size} delivery records for ${selectedDateStr}? This will create confirmed delivery records without billing yet.`);
    if (!ok) return;

    setPreparingSheet(true);
    try {
      const preparedAt = new Date().toISOString();
      const instances: DeliveryInstanceWriteInput[] = Array.from(groupedRows.values()).map((rows) => {
        const firstRow = rows[0];
        const deliveryInstanceId = buildDeliveryInstanceId({
          customerId: firstRow.customerId,
          deliveryDate: selectedDateStr,
          shift: firstRow.shift,
          addressId: firstRow.addressId,
          deliveryAddress: firstRow.deliveryAddress,
        });
        return {
          customerId: firstRow.customerId,
          customerName: firstRow.customerName,
          deliveryDate: selectedDateStr,
          shift: firstRow.shift,
          addressId: firstRow.addressId,
          deliveryAddress: firstRow.deliveryAddress || null,
          routeId: firstRow.routeId || null,
          routeName: firstRow.routeName || null,
          zoneId: firstRow.zoneId || null,
          hubId: firstRow.hubId || null,
          status: "confirmed",
          items: rows.flatMap((row) => row.items.map((item) => {
            const qty = Number(item.qty || 0);
            return {
              source: item.source || (row.source === "One-time" ? "one-time" : "subscription"),
              sourceId: item.sourceId || row.orderId,
              productId: item.productId,
              name: item.name,
              unit: item.unit,
              price: Number(item.price || 0),
              originalQty: qty,
              plannedQty: qty,
              deliveredQty: null,
              billingTransactionId: item.source === "subscription"
                ? `${deliveryInstanceId}_${cleanBillingIdPart(item.sourceId || item.productId || item.name)}_sheet_charge`
                : null,
              billedAmount: item.source === "subscription" ? Number(item.price || 0) * qty : null,
            };
          })),
          changeLog: [{
            type: "sheet_confirmed",
            reason: "Prepared from admin manifest",
            changedBy: user.uid,
            changedByName: user.name || user.email || "Admin",
            changedByRole: user.role || "admin",
            changedAt: preparedAt,
          }],
        };
      });

      await createDeliveryInstances(user.tenantId, instances);
      const billingBatch = writeBatch(db);
      let billingWriteCount = 0;
      instances.forEach((instance) => {
        instance.items
          .filter((item) => item.source === "subscription" && item.billingTransactionId && Number(item.billedAmount || 0) > 0)
          .forEach((item) => {
            const amount = Number(item.billedAmount || 0);
            const txRef = doc(db, "tenants", user.tenantId!, "billingTransactions", item.billingTransactionId!);
            billingBatch.set(txRef, {
              tenantId: user.tenantId,
              customerId: instance.customerId,
              deliveryInstanceId: buildDeliveryInstanceId(instance),
              sourceType: item.source,
              sourceId: item.sourceId || null,
              productId: item.productId || null,
              productName: item.name,
              unit: item.unit,
              qty: item.plannedQty,
              amount,
              type: "sheet_confirmed_charge",
              direction: "debit",
              note: "Delivery sheet confirmed charge",
              reason: "Prepared from admin manifest",
              createdBy: user.uid,
              createdByName: user.name || user.email || "Admin",
              createdByRole: user.role || "admin",
              createdAt: serverTimestamp(),
            });
            billingBatch.set(doc(db, "tenants", user.tenantId!, "customerAccounts", `${user.tenantId}_${instance.customerId}`), {
              outstandingDue: increment(amount),
              updatedAt: serverTimestamp(),
            }, { merge: true });
            billingWriteCount += 2;
          });
      });
      if (billingWriteCount > 0) await billingBatch.commit();
      setDeliveryInstances(await fetchDeliveryInstancesForDate(user.tenantId, selectedDateStr));
      alert("Delivery sheet prepared successfully.");
    } catch (error) {
      console.error("Failed to prepare delivery sheet", error);
      alert("Failed to prepare delivery sheet. Please try again.");
    } finally {
      setPreparingSheet(false);
    }
  }

  function openCancelPreparedDelivery(row: DeliveryRow) {
    if (!user?.tenantId || !row.deliveryInstanceId) return;

    const instance = deliveryInstances.find((current) => current.id === row.deliveryInstanceId);
    if (!instance) {
      alert("Prepared delivery record not found. Please refresh and try again.");
      return;
    }

    setCancelRow(row);
    setCancelReason(CANCELLATION_REASONS[0]);
    setCancelNotes("");
    setCancelError("");
  }

  function closeCancelPreparedDelivery() {
    if (cancellingRowId) return;
    setCancelRow(null);
    setCancelReason(CANCELLATION_REASONS[0]);
    setCancelNotes("");
    setCancelError("");
  }

  async function handleCancelPreparedDelivery() {
    if (!user?.tenantId || !cancelRow?.deliveryInstanceId || !cancelInstance) return;

    const notes = cancelNotes.trim();
    if (cancelReason === "Other" && !notes) {
      setCancelError("Please enter the cancellation reason.");
      return;
    }

    const reason = cancelReason === "Other" ? notes : notes ? `${cancelReason}: ${notes}` : cancelReason;
    if (!reason.trim()) {
      setCancelError("Please select or enter the cancellation reason.");
      return;
    }

    setCancellingRowId(cancelRow.id);
    try {
      const cancelledAt = new Date().toISOString();
      const batch = writeBatch(db);

      cancelInstance.items
        .filter((item) => item.source === "subscription" && item.billingTransactionId)
        .forEach((item) => {
          const amount = getCancellationCreditAmount(item);
          if (amount <= 0) return;

          const txId = `${item.billingTransactionId}_cancel_credit`;
          const txRef = doc(db, "tenants", user.tenantId!, "billingTransactions", txId);
          batch.set(txRef, {
            tenantId: user.tenantId,
            customerId: cancelInstance.customerId,
            deliveryInstanceId: cancelInstance.id,
            sourceType: item.source,
            sourceId: item.sourceId || null,
            productId: item.productId || null,
            productName: item.name,
            unit: item.unit,
            qtyBefore: item.plannedQty,
            qtyAfter: 0,
            amount,
            type: "delivery_cancel_credit",
            direction: "credit",
            note: "Delivery cancelled after sheet confirmation",
            reason,
            createdBy: user.uid,
            createdByName: user.name || user.email || "Admin",
            createdByRole: user.role || "admin",
            createdAt: serverTimestamp(),
          });
          batch.set(doc(db, "tenants", user.tenantId!, "customerAccounts", `${user.tenantId}_${cancelInstance.customerId}`), {
            outstandingDue: increment(-amount),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        });

      batch.update(doc(db, "tenants", user.tenantId, "deliveryInstances", cancelInstance.id), {
        status: "cancelled",
        cancellationReason: reason,
        changeLog: arrayUnion({
          type: "status_change",
          reason,
          changedBy: user.uid,
          changedByName: user.name || user.email || "Admin",
          changedByRole: user.role || "admin",
          changedAt: cancelledAt,
        }),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      setDeliveryInstances(await fetchDeliveryInstancesForDate(user.tenantId, selectedDateStr));
      setCancelRow(null);
      setCancelReason(CANCELLATION_REASONS[0]);
      setCancelNotes("");
      setCancelError("");
      alert("Delivery cancelled and adjustment recorded.");
    } catch (error) {
      console.error("Failed to cancel prepared delivery", error);
      alert("Failed to cancel delivery. Please try again.");
    } finally {
      setCancellingRowId(null);
    }
  }

  function openEditPreparedQuantities(row: DeliveryRow) {
    if (!user?.tenantId || !row.deliveryInstanceId) return;

    const instance = deliveryInstances.find((current) => current.id === row.deliveryInstanceId);
    if (!instance) {
      alert("Prepared delivery record not found. Please refresh and try again.");
      return;
    }

    setQtyEditRow(row);
    setQtyEditValues(instance.items.map((item) => formatQty(Number(item.plannedQty || 0))));
    setQtyEditReason("");
    setQtyEditError("");
  }

  function closeEditPreparedQuantities() {
    if (editingRowId) return;
    setQtyEditRow(null);
    setQtyEditValues([]);
    setQtyEditReason("");
    setQtyEditError("");
  }

  async function handleEditPreparedQuantities() {
    if (!user?.tenantId || !qtyEditRow?.deliveryInstanceId || !qtyEditInstance) return;

    const nextQuantities = qtyEditValues.map((value) => Number(value));
    if (nextQuantities.length !== qtyEditInstance.items.length || nextQuantities.some((qty) => !Number.isFinite(qty) || qty < 0)) {
      setQtyEditError("Please enter one valid quantity for each item.");
      return;
    }

    const hasChange = qtyEditInstance.items.some((item, index) => Number(item.plannedQty || 0) !== nextQuantities[index]);
    if (!hasChange) {
      setQtyEditError("Please change at least one quantity before saving.");
      return;
    }

    const reason = qtyEditReason.trim();
    if (!reason) {
      setQtyEditError("Please enter the reason for this quantity change.");
      return;
    }

    setEditingRowId(qtyEditRow.id);
    try {
      const changedAt = new Date().toISOString();
      const timestampSuffix = Date.now();
      const batch = writeBatch(db);
      const changeLogEntries: any[] = [];
      const oneTimeFollowUpGroups = new Map<string, { parentOrderId: string; items: any[] }>();

      const nextItems = cleanDeliveryInstanceItemsForWrite(qtyEditInstance.items.map((item, index) => {
        const oldQty = Number(item.plannedQty || 0);
        const newQty = nextQuantities[index];
        const deltaQty = newQty - oldQty;

        if (deltaQty !== 0) {
          changeLogEntries.push({
            type: "qty_change",
            productId: item.productId || null,
            productName: item.name,
            fromQty: oldQty,
            toQty: newQty,
            reason: reason.trim(),
            changedBy: user.uid,
            changedByName: user.name || user.email || "Admin",
            changedByRole: user.role || "admin",
            changedAt,
          });
        }

        if (item.source === "subscription" && item.billingTransactionId && deltaQty !== 0) {
          const amount = Math.abs(deltaQty) * Number(item.price || 0);
          if (amount > 0) {
            const isIncrease = deltaQty > 0;
            const txId = `${item.billingTransactionId}_qty_adjust_${timestampSuffix}_${index}`;
            const txRef = doc(db, "tenants", user.tenantId!, "billingTransactions", txId);
            batch.set(txRef, {
              tenantId: user.tenantId,
              customerId: qtyEditInstance.customerId,
              deliveryInstanceId: qtyEditInstance.id,
              sourceType: item.source,
              sourceId: item.sourceId || null,
              productId: item.productId || null,
              productName: item.name,
              unit: item.unit,
              qtyBefore: oldQty,
              qtyAfter: newQty,
              amount,
              type: isIncrease ? "delivery_qty_increase" : "delivery_qty_reduction_credit",
              direction: isIncrease ? "debit" : "credit",
              note: isIncrease ? "Delivery quantity increased after sheet confirmation" : "Delivery quantity reduced after sheet confirmation",
              reason: reason.trim(),
              createdBy: user.uid,
              createdByName: user.name || user.email || "Admin",
              createdByRole: user.role || "admin",
              createdAt: serverTimestamp(),
            });
            batch.set(doc(db, "tenants", user.tenantId!, "customerAccounts", `${user.tenantId}_${qtyEditInstance.customerId}`), {
              outstandingDue: increment(isIncrease ? amount : -amount),
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }
        }

        if (item.source === "one-time" && item.sourceId && deltaQty < 0) {
          const balanceQty = Math.abs(deltaQty);
          const current = oneTimeFollowUpGroups.get(item.sourceId) || { parentOrderId: item.sourceId, items: [] };
          current.items.push({
            productId: item.productId || null,
            name: item.name,
            unit: item.unit,
            price: Number(item.price || 0),
            qty: balanceQty,
          });
          oneTimeFollowUpGroups.set(item.sourceId, current);
        }

        return {
          ...item,
          plannedQty: newQty,
          deliveredQty: item.deliveredQty === null || item.deliveredQty === undefined ? item.deliveredQty : newQty,
          fulfillmentStatus: item.source === "one-time" && deltaQty < 0 ? "rescheduled" : item.fulfillmentStatus,
          rescheduledQty: item.source === "one-time" && deltaQty < 0 ? Math.abs(deltaQty) : item.rescheduledQty,
        };
      }));

      batch.update(doc(db, "tenants", user.tenantId, "deliveryInstances", qtyEditInstance.id), {
        items: nextItems,
        changeLog: arrayUnion(...changeLogEntries),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      let followUpCount = 0;
      let followUpFailed = false;
      for (const group of oneTimeFollowUpGroups.values()) {
        try {
          const followUp = await createOneTimeFollowUpOrder({
            tenantId: user.tenantId,
            customerId: qtyEditInstance.customerId,
            customerName: qtyEditRow.customerName,
            deliveryAddress: qtyEditInstance.deliveryAddress,
            routeId: qtyEditInstance.routeId,
            routeName: qtyEditInstance.routeName,
            zoneId: qtyEditInstance.zoneId,
            hubId: qtyEditInstance.hubId,
            parentOrderId: group.parentOrderId,
            parentDeliveryInstanceId: qtyEditInstance.id,
            rescheduledFromDate: qtyEditInstance.deliveryDate,
            rescheduledFromShift: qtyEditInstance.shift,
            reason,
            items: group.items,
            createdBy: user.uid,
            createdByName: user.name || user.email || "Admin",
            createdByRole: user.role || "admin",
          });
          if (followUp?.id) followUpCount += 1;
        } catch (error) {
          console.error("Failed to create one-time follow-up order", error);
          followUpFailed = true;
        }
      }

      setDeliveryInstances(await fetchDeliveryInstancesForDate(user.tenantId, selectedDateStr));
      setQtyEditRow(null);
      setQtyEditValues([]);
      setQtyEditReason("");
      setQtyEditError("");
      alert(followUpFailed
        ? "Quantity updated, but one or more one-time follow-up orders could not be created."
        : followUpCount > 0
          ? `Quantity updated and ${followUpCount} one-time follow-up order${followUpCount === 1 ? "" : "s"} created.`
          : "Quantity updated and adjustment recorded."
      );
    } catch (error) {
      console.error("Failed to edit prepared quantities", error);
      alert("Failed to update quantity. Please try again.");
    } finally {
      setEditingRowId(null);
    }
  }

  function handleExportCsv() {
    const headers = ["Delivery Date", "Shift", "Route", "Customer", "Address", "Type", "Status", "Product", "Unit", "Qty", "Order ID"];
    const csvRows = filteredRows.flatMap((row) =>
      row.items.map((item) => [
        selectedDateStr,
        row.shift,
        row.routeName,
        row.customerName,
        row.address,
        `${row.source}${row.isExpectedOnly ? " expected" : ""}`,
        statusLabel(displayStatusForRow(row)),
        item.name,
        item.unit,
        formatQty(Number(item.qty || 0)),
        row.orderId || "",
      ])
    );

    const csv = [headers, ...csvRows].map((line) => line.map(escapeCsvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `manifest-${selectedDateStr}-${selectedShift.toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontWeight: 600 }}>Loading delivery overview...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: "#111827" }}>Delivery Overview</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>Manifest, route list, and delivery status for the selected slot.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handlePrepareDeliverySheet}
              disabled={preparingSheet || rowsForPreparation.length === 0}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "1px solid #bfdbfe",
                background: preparingSheet || rowsForPreparation.length === 0 ? "#e5e7eb" : "#2563eb",
                color: preparingSheet || rowsForPreparation.length === 0 ? "#64748b" : "#fff",
                fontWeight: 700,
                cursor: preparingSheet || rowsForPreparation.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {preparingSheet ? "Preparing..." : `Prepare Sheet (${rowsForPreparation.length})`}
            </button>
            <button onClick={handleExportCsv} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Export CSV
            </button>
            <button onClick={() => window.print()} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Print
            </button>
          </div>
        </div>

        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, borderBottom: "1px solid #e5e7eb" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Delivery Date
            <input type="date" value={selectedDateStr} onChange={(event) => setSelectedDateStr(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Shift
            <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value as any)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" }}>
              {SHIFT_OPTIONS.map((shift) => <option key={shift} value={shift}>{shift === "All" ? "All Shifts" : shift}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Route
            <select value={selectedRoute} onChange={(event) => setSelectedRoute(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" }}>
              <option value="All">All Routes</option>
              {routeOptions.map((route) => <option key={route.key} value={route.key}>{route.label}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Status
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as any)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" }}>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status === "All" ? "All Status" : statusLabel(status)}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Search
            <input type="search" placeholder="Name / address / product" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
          </label>
        </div>

        <div style={{ padding: "22px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#111827" }}>
            Overview: {parseLocalDate(selectedDateStr)?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) || selectedDateStr}
            {selectedShift !== "All" ? ` (${selectedShift})` : " (All)"}
          </h2>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            {filteredRows.length} deliveries - {formatQty(totalQuantity)} total quantity
          </p>
        </div>

        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#f1f5f9", fontWeight: 800 }}>Product Summary</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#374151", color: "#fff" }}><th style={{ padding: 10, textAlign: "left", width: 45 }}>#</th><th style={{ padding: 10, textAlign: "left" }}>Name</th><th style={{ padding: 10, textAlign: "left" }}>Quantity</th></tr></thead>
              <tbody>
                {productSummary.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: 18, textAlign: "center", color: "#94a3b8" }}>No products for this filter.</td></tr>
                ) : productSummary.map((item, index) => (
                  <tr key={`${item.name}_${item.unit}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10 }}>{index + 1}</td>
                    <td style={{ padding: 10, fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: 10 }}>{formatQty(item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#f1f5f9", fontWeight: 800 }}>Status Summary</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#374151", color: "#fff" }}><th style={{ padding: 10, textAlign: "left" }}>Status</th><th style={{ padding: 10, textAlign: "left" }}>Deliveries</th><th style={{ padding: 10, textAlign: "left" }}>Quantity</th></tr></thead>
              <tbody>
                {Object.entries(statusSummary).map(([key, item]) => (
                  <tr key={key} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10, fontWeight: key === "pending" ? 700 : 500 }}>{item.label}</td>
                    <td style={{ padding: 10 }}>{item.deliveries}</td>
                    <td style={{ padding: 10 }}>{formatQty(item.quantity)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: 10, fontWeight: 800 }}>Total</td>
                  <td style={{ padding: 10, fontWeight: 800 }}>{rowsBeforeStatusFilter.length}</td>
                  <td style={{ padding: 10, fontWeight: 800 }}>{formatQty(rowsBeforeStatusFilter.reduce((sum, row) => sum + itemQuantity(row.items), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ margin: "0 20px 20px", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", background: "#f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800 }}>
            <span>Deliveries</span>
            <span>{filteredRows.length} rows</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#374151", color: "#fff" }}>
                  <th style={{ padding: 12, textAlign: "left" }}>Name</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Address</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Route</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Shift</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Type</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Products</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Total</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Status</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>No deliveries found for this filter.</td></tr>
                ) : filteredRows.map((row) => {
                  const displayStatus = displayStatusForRow(row);
                  const canEditPrepared = Boolean(row.deliveryInstanceId && (displayStatus === "confirmed" || displayStatus === "delivered"));
                  const canCancelPrepared = Boolean(row.deliveryInstanceId && displayStatus === "confirmed");
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid #e5e7eb", background: row.source === "Subscription" ? "#f0fdf4" : "#fffbeb" }}>
                      <td style={{ padding: 12, fontWeight: 700 }}>{row.customerName}</td>
                      <td style={{ padding: 12, color: "#334155", maxWidth: 280 }}>{row.address}</td>
                      <td style={{ padding: 12 }}>{row.routeName}</td>
                      <td style={{ padding: 12 }}>{row.shift}</td>
                      <td style={{ padding: 12 }}>{row.source}{row.isExpectedOnly ? " expected" : ""}</td>
                      <td style={{ padding: 12, fontWeight: 700 }}>{row.items.map((item) => formatDeliveryItem(item)).join(", ")}</td>
                      <td style={{ padding: 12 }}>{formatQty(itemQuantity(row.items))}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ ...statusColor(displayStatus), padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{statusLabel(displayStatus)}</span>
                      </td>
                      <td style={{ padding: 12 }}>
                        {canEditPrepared || canCancelPrepared ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {canEditPrepared && (
                              <button
                                onClick={() => openEditPreparedQuantities(row)}
                                disabled={editingRowId === row.id}
                                style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800, cursor: editingRowId === row.id ? "not-allowed" : "pointer" }}
                              >
                                {editingRowId === row.id ? "Saving..." : "Edit Qty"}
                              </button>
                            )}
                            {canCancelPrepared && (
                              <button
                                onClick={() => openCancelPreparedDelivery(row)}
                                disabled={cancellingRowId === row.id}
                                style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 12, fontWeight: 800, cursor: cancellingRowId === row.id ? "not-allowed" : "pointer" }}
                              >
                                {cancellingRowId === row.id ? "Cancelling..." : "Cancel"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {cancelRow && cancelInstance && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-delivery-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.48)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div style={{ width: "min(820px, 100%)", maxHeight: "92vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 24px 60px rgba(15,23,42,0.28)", border: "1px solid #e5e7eb" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <h2 id="cancel-delivery-title" style={{ margin: 0, fontSize: 20, color: "#111827" }}>Cancel Delivery</h2>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>{cancelInstance.id}</p>
              </div>
              <button
                type="button"
                onClick={closeCancelPreparedDelivery}
                disabled={Boolean(cancellingRowId)}
                style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 900, cursor: cancellingRowId ? "not-allowed" : "pointer" }}
              >
                X
              </button>
            </div>

            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              <div style={{ padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
                This will remove the delivery from the active route list and record the cancellation reason in the delivery history.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Customer</div>
                  <div style={{ marginTop: 4, fontWeight: 800, color: "#111827" }}>{cancelRow.customerName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Delivery</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{selectedDateStr} - {cancelRow.shift}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Route</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{cancelRow.routeName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Credit Preview</div>
                  <div style={{ marginTop: 4, fontWeight: 900, color: totalCancelCredit > 0 ? "#dc2626" : "#64748b" }}>
                    {totalCancelCredit > 0 ? `-Rs.${formatQty(totalCancelCredit)}` : "No balance change"}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase", marginBottom: 5 }}>Address</div>
                <div style={{ color: "#334155", lineHeight: 1.5 }}>{cancelRow.address}</div>
              </div>

              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", background: "#f8fafc", fontWeight: 800, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Products Being Cancelled</span>
                  <span>{cancelPreview.length} items</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680, fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#374151", color: "#fff" }}>
                        <th style={{ padding: 10, textAlign: "left" }}>Product</th>
                        <th style={{ padding: 10, textAlign: "left" }}>Source</th>
                        <th style={{ padding: 10, textAlign: "right" }}>Qty</th>
                        <th style={{ padding: 10, textAlign: "right" }}>Balance Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelPreview.map(({ item, qty, creditAmount }, index) => (
                        <tr key={`${item.source}_${item.sourceId || item.name}_${index}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: 10, fontWeight: 800 }}>{formatProductName(item)}</td>
                          <td style={{ padding: 10, color: "#475569" }}>{item.source === "subscription" ? "Subscription" : item.source === "one-time" ? "One-time" : "Manual"}</td>
                          <td style={{ padding: 10, textAlign: "right" }}>{formatQty(qty)}</td>
                          <td style={{ padding: 10, textAlign: "right", fontWeight: 800, color: creditAmount > 0 ? "#dc2626" : "#64748b" }}>
                            {creditAmount > 0 ? `-Rs.${formatQty(creditAmount)}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "start" }}>
                <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 800, color: "#111827" }}>
                  Reason
                  <select
                    value={cancelReason}
                    onChange={(event) => {
                      setCancelReason(event.target.value);
                      setCancelError("");
                    }}
                    style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", fontWeight: 700 }}
                  >
                    {CANCELLATION_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 800, color: "#111827" }}>
                  Notes {cancelReason === "Other" ? "" : "(optional)"}
                  <textarea
                    value={cancelNotes}
                    onChange={(event) => {
                      setCancelNotes(event.target.value);
                      setCancelError("");
                    }}
                    rows={3}
                    placeholder="Add extra details for admin/customer reference..."
                    style={{ width: "100%", resize: "vertical", padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, font: "inherit", fontWeight: 500 }}
                  />
                </label>
              </div>

              {cancelError && (
                <div style={{ padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                  {cancelError}
                </div>
              )}
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeCancelPreparedDelivery}
                disabled={Boolean(cancellingRowId)}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 800, cursor: cancellingRowId ? "not-allowed" : "pointer" }}
              >
                Keep Delivery
              </button>
              <button
                type="button"
                onClick={() => void handleCancelPreparedDelivery()}
                disabled={Boolean(cancellingRowId)}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #dc2626", background: cancellingRowId ? "#fca5a5" : "#dc2626", color: "#fff", fontWeight: 900, cursor: cancellingRowId ? "not-allowed" : "pointer" }}
              >
                {cancellingRowId ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {qtyEditRow && qtyEditInstance && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-qty-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.48)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div style={{ width: "min(860px, 100%)", maxHeight: "92vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 24px 60px rgba(15,23,42,0.28)", border: "1px solid #e5e7eb" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <h2 id="edit-qty-title" style={{ margin: 0, fontSize: 20, color: "#111827" }}>Edit Delivery Quantity</h2>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>{qtyEditInstance.id}</p>
              </div>
              <button
                type="button"
                onClick={closeEditPreparedQuantities}
                disabled={Boolean(editingRowId)}
                style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 900, cursor: editingRowId ? "not-allowed" : "pointer" }}
              >
                X
              </button>
            </div>

            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Customer</div>
                  <div style={{ marginTop: 4, fontWeight: 800, color: "#111827" }}>{qtyEditRow.customerName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Delivery</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{selectedDateStr} - {qtyEditRow.shift}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Route</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{qtyEditRow.routeName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Status</div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ ...statusColor(displayStatusForRow(qtyEditRow)), padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{statusLabel(displayStatusForRow(qtyEditRow))}</span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase", marginBottom: 5 }}>Address</div>
                <div style={{ color: "#334155", lineHeight: 1.5 }}>{qtyEditRow.address}</div>
              </div>

              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", background: "#f8fafc", fontWeight: 800, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Products</span>
                  <span>{qtyEditPreview.length} items</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#374151", color: "#fff" }}>
                        <th style={{ padding: 10, textAlign: "left" }}>Product</th>
                        <th style={{ padding: 10, textAlign: "left" }}>Source</th>
                        <th style={{ padding: 10, textAlign: "right" }}>Current</th>
                        <th style={{ padding: 10, textAlign: "right" }}>New Qty</th>
                        <th style={{ padding: 10, textAlign: "right" }}>Change</th>
                        <th style={{ padding: 10, textAlign: "right" }}>Billing Effect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qtyEditPreview.map(({ item, oldQty, delta, amount, followUpQty }, index) => {
                        const isIncrease = delta > 0;
                        const isReduction = delta < 0;
                        return (
                          <tr key={`${item.source}_${item.sourceId || item.name}_${index}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <td style={{ padding: 10, fontWeight: 800 }}>{formatProductName(item)}</td>
                            <td style={{ padding: 10, color: "#475569" }}>{item.source === "subscription" ? "Subscription" : item.source === "one-time" ? "One-time" : "Manual"}</td>
                            <td style={{ padding: 10, textAlign: "right" }}>{formatQty(oldQty)}</td>
                            <td style={{ padding: 10, textAlign: "right" }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={qtyEditValues[index] ?? ""}
                                onChange={(event) => {
                                  const next = [...qtyEditValues];
                                  next[index] = event.target.value;
                                  setQtyEditValues(next);
                                  setQtyEditError("");
                                }}
                                style={{ width: 96, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, textAlign: "right", fontWeight: 700 }}
                              />
                            </td>
                            <td style={{ padding: 10, textAlign: "right", fontWeight: 800, color: isIncrease ? "#15803d" : isReduction ? "#dc2626" : "#64748b" }}>
                              {delta === 0 ? "-" : `${isIncrease ? "+" : ""}${formatQty(delta)}`}
                            </td>
                            <td style={{ padding: 10, textAlign: "right", fontWeight: 800, color: isIncrease ? "#15803d" : isReduction ? "#dc2626" : "#64748b" }}>
                              {item.source === "subscription" && amount > 0
                                ? `${isIncrease ? "+Rs." : "-Rs."}${formatQty(amount)}`
                                : followUpQty > 0
                                  ? `Follow-up x ${formatQty(followUpQty)}`
                                  : "-"
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 800, color: "#111827" }}>
                Reason for change
                <textarea
                  value={qtyEditReason}
                  onChange={(event) => {
                    setQtyEditReason(event.target.value);
                    setQtyEditError("");
                  }}
                  rows={3}
                  placeholder="Example: customer requested extra packet, product unavailable, correction after delivery..."
                  style={{ width: "100%", resize: "vertical", padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, font: "inherit", fontWeight: 500 }}
                />
              </label>

              {qtyEditError && (
                <div style={{ padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                  {qtyEditError}
                </div>
              )}
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeEditPreparedQuantities}
                disabled={Boolean(editingRowId)}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 800, cursor: editingRowId ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleEditPreparedQuantities()}
                disabled={Boolean(editingRowId)}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #1d4ed8", background: editingRowId ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 900, cursor: editingRowId ? "not-allowed" : "pointer" }}
              >
                {editingRowId ? "Saving..." : "Save Quantity Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          button, input, select { display: none !important; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  );
}
