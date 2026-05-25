export type DeliveryShift = "Morning" | "Evening";

export type DateLike =
  | Date
  | string
  | number
  | { seconds: number }
  | { toDate: () => Date }
  | null
  | undefined;

export interface DeliverySlotSubscription {
  id: string;
  productName?: string;
  isActive?: boolean;
  scheduleType?: string;
  scheduleDays?: number[];
  startDate?: DateLike;
  skipDates?: string[];
  vacationFrom?: string;
  vacationTo?: string;
  shift?: string;
  deliveryShift?: string;
}

export interface DeliverySlot {
  date: string;
  shift: DeliveryShift;
  label: string;
  weekdayLabel: string;
  subscriptionIds: string[];
  subscriptionNames: string[];
}

export interface BuildDeliverySlotsOptions {
  now?: Date;
  windowDays?: number;
  cutoffTime?: string;
  includeToday?: boolean;
  blockNearestDateAfterCutoff?: boolean;
}

const DEFAULT_WINDOW_DAYS = 30;

export function getLocalDateString(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

export function parseLocalDate(value: DateLike): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string") {
    const dateOnly = value.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return parseLocalDate(value.toDate());
  }

  if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return parseLocalDate(new Date(value.seconds * 1000));
  }

  return null;
}

export function normalizeShift(value?: string): DeliveryShift | null {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "morning") return "Morning";
  if (normalized === "evening") return "Evening";
  return null;
}

export function isCutoffPassed(now: Date, cutoffTime?: string): boolean {
  if (!cutoffTime) return false;

  const match = /^(\d{1,2}):(\d{2})$/.exec(cutoffTime.trim());
  if (!match) return false;

  const cutoffHour = Number(match[1]);
  const cutoffMinute = Number(match[2]);
  if (cutoffHour < 0 || cutoffHour > 23 || cutoffMinute < 0 || cutoffMinute > 59) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const cutoffMinutes = cutoffHour * 60 + cutoffMinute;
  return currentMinutes >= cutoffMinutes;
}

export function doesSubscriptionRunOnDate(subscription: DeliverySlotSubscription, targetDate: Date): boolean {
  if (subscription.isActive === false) return false;

  const dateStr = getLocalDateString(targetDate);
  if (subscription.skipDates?.includes(dateStr)) return false;
  if (subscription.vacationFrom && subscription.vacationTo && dateStr >= subscription.vacationFrom && dateStr <= subscription.vacationTo) {
    return false;
  }

  const startDate = parseLocalDate(subscription.startDate);
  if (startDate && targetDate < startDate) return false;

  const weekday = targetDate.getDay();
  const scheduleType = subscription.scheduleType || "daily";

  switch (scheduleType) {
    case "daily":
      return true;
    case "mon_fri":
      return weekday >= 1 && weekday <= 5;
    case "weekends":
      return weekday === 0 || weekday === 6;
    case "custom":
      return Array.isArray(subscription.scheduleDays) && subscription.scheduleDays.includes(weekday);
    case "alternate_days": {
      if (!startDate) return true;
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % 2 === 0;
    }
    default:
      return true;
  }
}

export function buildDeliverySlots(
  subscriptions: DeliverySlotSubscription[],
  options: BuildDeliverySlotsOptions = {}
): DeliverySlot[] {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const includeToday = options.includeToday ?? false;
  const blockNearestDateAfterCutoff = options.blockNearestDateAfterCutoff ?? true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firstOffset = includeToday ? 0 : 1;
  const lastOffset = includeToday ? Math.max(windowDays - 1, 0) : windowDays;
  const slotMap = new Map<string, DeliverySlot>();

  for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + offset);
    const dateStr = getLocalDateString(targetDate);

    subscriptions.forEach((subscription) => {
      if (!doesSubscriptionRunOnDate(subscription, targetDate)) return;

      const shift = normalizeShift(subscription.deliveryShift || subscription.shift) || "Morning";
      const key = `${dateStr}_${shift}`;
      const existing = slotMap.get(key);

      if (existing) {
        existing.subscriptionIds.push(subscription.id);
        if (subscription.productName) existing.subscriptionNames.push(subscription.productName);
        return;
      }

      slotMap.set(key, {
        date: dateStr,
        shift,
        label: formatDeliverySlotLabel(dateStr, shift),
        weekdayLabel: formatWeekdayLabel(dateStr),
        subscriptionIds: [subscription.id],
        subscriptionNames: subscription.productName ? [subscription.productName] : [],
      });
    });
  }

  let slots = Array.from(slotMap.values()).sort(compareDeliverySlots);

  if (blockNearestDateAfterCutoff && isCutoffPassed(now, options.cutoffTime) && slots.length > 0) {
    const nearestDate = slots[0].date;
    slots = slots.filter((slot) => slot.date !== nearestDate);
  }

  return slots;
}

export function getFirstAvailableDeliverySlot(
  subscriptions: DeliverySlotSubscription[],
  options: BuildDeliverySlotsOptions = {}
): DeliverySlot | null {
  return buildDeliverySlots(subscriptions, options)[0] ?? null;
}

function compareDeliverySlots(a: DeliverySlot, b: DeliverySlot): number {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  return shiftRank(a.shift) - shiftRank(b.shift);
}

function shiftRank(shift: DeliveryShift): number {
  return shift === "Morning" ? 1 : 2;
}

function formatDeliverySlotLabel(dateStr: string, shift: DeliveryShift): string {
  return `${formatReadableDate(dateStr)} - ${shift}`;
}

function formatWeekdayLabel(dateStr: string): string {
  return formatReadableDate(dateStr, { weekday: "short" });
}

function formatReadableDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }
): string {
  const date = parseLocalDate(dateStr);
  if (!date) return dateStr;
  return date.toLocaleDateString("en-IN", options);
}
