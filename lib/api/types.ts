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
