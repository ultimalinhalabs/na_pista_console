export interface Category {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export type ProductUnit = "UNIT" | "KG" | "G" | "L" | "ML";

export interface Product {
  id: string;
  organizationId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  unit: ProductUnit;
  /** ADR-031: nullable — a Product without a price cannot be added to an Order yet. */
  price: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBalance {
  id: string;
  organizationId: string;
  productId: string;
  quantity: string;
  productName: string;
  productUnit: ProductUnit;
  productStatus: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = "RECEIPT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export interface StockMovement {
  id: string;
  organizationId: string;
  inventoryId: string;
  productId: string;
  type: StockMovementType;
  quantity: string;
  reason: string | null;
  actorType: "user" | "service";
  actorId: string;
  createdAt: string;
}

/** F23 (ADR-032): DRAFT -> CONFIRMED -> COMPLETED; CANCELED from DRAFT or CONFIRMED. */
export type OrderStatus = "DRAFT" | "CONFIRMED" | "COMPLETED" | "CANCELED";

export interface OrderItem {
  id: string;
  organizationId: string;
  orderId: string;
  productId: string;
  /** ADR-031: a snapshot taken when the item was added — never the Product's current name. */
  productName: string;
  quantity: string;
  /** ADR-031: a snapshot taken when the item was added — never the Product's current price. */
  unitPrice: string;
  subtotal: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  organizationId: string;
  customerId: string | null;
  status: OrderStatus;
  /** ADR-030: a creation-time snapshot of the Organization's operating currency (AOA in this phase). */
  currency: string;
  subtotal: string;
  total: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

/** The list endpoint returns Orders without their items (F22/F21 list-view convention). */
export type OrderSummary = Omit<Order, "items">;

/** F24A/ADR-033: Service is deliberately NOT a Product clone — no categoryId/unit, has durationMinutes. */
export interface Service {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  /** ADR-034: a plain integer — never a decimal string, unlike money/quantity fields. */
  durationMinutes: number;
  /** ADR-034: nullable — a Service without a price is a valid catalog state ("not yet priced"). */
  price: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

/** F25A/ADR-036: Professional is deliberately NOT a Product/Service clone and NOT a Platform User — no userId. */
export interface Professional {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

/** ADR-037: a Service a Professional is associated with, joined with display fields (name/duration/price/status) — never a raw FK on either side. */
export interface AssociatedService {
  id: string;
  name: string;
  durationMinutes: number;
  price: string | null;
  status: "ACTIVE" | "ARCHIVED";
  associatedAt: string;
}

/** ADR-040: `null` means "not configured yet" — never a silent default (server/browser/UTC). IANA identifier only, e.g. "Africa/Luanda". */
export interface OrganizationSettings {
  organizationId: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

/** ADR-039: one row per interval — wall-clock local time ("HH:mm"), no timezone attached. dayOfWeek: 0=Sunday..6=Saturday. */
export interface ScheduleRule {
  id: string;
  organizationId: string;
  professionalId: string;
  dayOfWeek: number;
  startLocalTime: string;
  endLocalTime: string;
  createdAt: string;
  updatedAt: string;
}

/** ADR-039: both times set = an available interval (fully replaces the weekly rule for that date); both `null` = a closed-marker (fully unavailable that date). */
export interface ScheduleException {
  id: string;
  organizationId: string;
  professionalId: string;
  date: string;
  startLocalTime: string | null;
  endLocalTime: string | null;
  createdAt: string;
}

export interface AvailabilityInterval {
  start: string;
  end: string;
}

export interface AvailabilityDay {
  date: string;
  workingIntervals: AvailabilityInterval[];
  /** Present only when a serviceId was supplied — advisory only, NOT a booking guarantee (no Appointment conflicts exist yet, ADR-041). */
  serviceStartTimes?: string[];
}

export interface Availability {
  timezone: string;
  days: AvailabilityDay[];
}

/** ADR-043 + ADR-048 (F28B): SCHEDULED (created directly) -> COMPLETED | CANCELED | NO_SHOW, all terminal. Only CANCELED releases the time slot. */
export type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";

/**
 * ADR-042: one Customer, one Professional, one Service, one absolute
 * `[startAt, endAt)` interval (ISO-8601 UTC instants — display them in the
 * ORGANIZATION timezone, never the browser's). `serviceName`/
 * `servicePrice`/`currency` are booking-time snapshots; `durationMinutes`
 * is derived (`endAt - startAt`), frozen at booking.
 */
export interface Appointment {
  id: string;
  organizationId: string;
  customerId: string;
  professionalId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  serviceName: string;
  servicePrice: string | null;
  currency: string;
  notes: string | null;
  cancellationReason: string | null;
  canceledAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** ADR-040/044: bookable = F26 working start times − occupying appointments. ADVISORY — a slot can still be lost to a concurrent booking (409 APPOINTMENT_CONFLICT). */
export interface BookableSlot {
  localStartTime: string;
  startAt: string;
  endAt: string;
}

export interface BookableSlots {
  timezone: string;
  date: string;
  serviceId: string;
  durationMinutes: number;
  slots: BookableSlot[];
}
