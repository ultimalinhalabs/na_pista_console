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

export interface Product {
  id: string;
  organizationId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}
