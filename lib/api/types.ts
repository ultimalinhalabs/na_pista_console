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
