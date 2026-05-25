export type AddressRouteStatus = "assigned" | "needs_review" | "unserviceable";

export interface AddressRouteFields {
  addressId?: string;
  routeStatus?: AddressRouteStatus;
  hubId?: string | null;
  hubName?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  routeId?: string | null;
  routeName?: string | null;
}

export interface ServiceZone {
  id?: string;
  name?: string;
  hubId?: string;
  hubName?: string;
  pincodes?: string | string[];
}

export interface ServiceHub {
  id?: string;
  name?: string;
}

function hasRealRouteName(routeName: any) {
  const value = String(routeName || "").trim().toLowerCase();
  return Boolean(value && value !== "unassigned");
}

export function normalizePincode(value: any) {
  return String(value || "").replace(/\D/g, "");
}

export function getZonePincodes(zone: ServiceZone) {
  const raw = Array.isArray(zone.pincodes) ? zone.pincodes : String(zone.pincodes || "").split(/[\s,;|]+/);
  return raw.map(normalizePincode).filter(Boolean);
}

export function findZoneForPincode(pincode: any, zones: ServiceZone[] = []) {
  const normalized = normalizePincode(pincode);
  if (!normalized) return null;
  return zones.find((zone) => getZonePincodes(zone).includes(normalized)) || null;
}

function findHubForZone(zone: ServiceZone | null, hubs: ServiceHub[] = []) {
  if (!zone?.hubId) return null;
  return hubs.find((hub) => hub.id === zone.hubId) || null;
}

export function getAddressRouteStatus(address: any, zones?: ServiceZone[]): AddressRouteStatus {
  if (address?.routeId || hasRealRouteName(address?.routeName)) return "assigned";

  if (zones) {
    return findZoneForPincode(address?.pincode, zones) ? "needs_review" : "unserviceable";
  }

  if (address?.routeStatus === "unserviceable") return "unserviceable";
  return "needs_review";
}

export function buildAddressServiceFields(address: any, zones: ServiceZone[] = [], hubs: ServiceHub[] = []): AddressRouteFields {
  const matchedZone = findZoneForPincode(address?.pincode, zones);
  const matchedHub = findHubForZone(matchedZone, hubs);

  if (address?.routeId || hasRealRouteName(address?.routeName)) {
    return {
      routeStatus: "assigned",
      hubId: address.hubId || matchedZone?.hubId || null,
      hubName: address.hubName || matchedHub?.name || null,
      zoneId: address.zoneId || matchedZone?.id || null,
      zoneName: address.zoneName || matchedZone?.name || null,
      routeId: address.routeId || null,
      routeName: hasRealRouteName(address.routeName) ? address.routeName : null,
    };
  }

  if (!matchedZone) {
    return {
      routeStatus: "unserviceable",
      hubId: null,
      hubName: null,
      zoneId: null,
      zoneName: null,
      routeId: null,
      routeName: null,
    };
  }

  return {
    routeStatus: "needs_review",
    hubId: matchedZone.hubId || null,
    hubName: matchedHub?.name || matchedZone.hubName || null,
    zoneId: matchedZone.id || null,
    zoneName: matchedZone.name || null,
    routeId: null,
    routeName: null,
  };
}

export function buildDeliveryAddressSnapshot(address: any) {
  const routeStatus = getAddressRouteStatus(address);

  return {
    label: address.label || "",
    line1: address.line1 || "",
    area: address.area || "",
    city: address.city || "",
    pincode: address.pincode || "",
    phone: address.phone || "",
    mapUrl: address.mapUrl || "",
    addressId: address.id || address.addressId || "",
    routeStatus,
    hubId: address.hubId || null,
    hubName: address.hubName || null,
    zoneId: address.zoneId || null,
    zoneName: address.zoneName || null,
    routeId: address.routeId || null,
    routeName: hasRealRouteName(address.routeName) ? address.routeName : null,
  };
}

export function buildOrderRouteSnapshot(address: any): AddressRouteFields {
  const snapshot = buildDeliveryAddressSnapshot(address);

  return {
    addressId: snapshot.addressId,
    routeStatus: snapshot.routeStatus,
    hubId: snapshot.hubId,
    hubName: snapshot.hubName,
    zoneId: snapshot.zoneId,
    zoneName: snapshot.zoneName,
    routeId: snapshot.routeId,
    routeName: snapshot.routeName,
  };
}

export function getRouteLabel(value: any) {
  if (value?.routeStatus === "unserviceable") return "Non serviceable area";
  if (hasRealRouteName(value?.routeName)) return value.routeName;
  return "Unassigned";
}
