export type PricingMode = "fixed" | "variable";
export type ServiceType = "dine_in" | "takeaway";
export type OrderStatus = "ongoing" | "completed" | "cancelled";
export type LineStatus = "active" | "cancelled";
export type PaymentMethod = "cash" | "qr" | "bank";

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  pricingMode: PricingMode;
  priceCents: number;
  checkoutOnly: boolean;
  available: boolean;
  archived: boolean;
  sortOrder: number;
}

export interface RestaurantTable {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface OrderLine {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  /** Explicit agreed line total. Supports ad-hoc restaurant discounts. */
  totalPriceCents?: number;
  servingNote: string;
  kitchenNote: string;
  status: LineStatus;
  cancelledAt?: string;
}

export interface Payment {
  method: PaymentMethod;
  paidCents: number;
  receivedCents?: number;
}

export interface RestaurantOrder {
  id: string;
  dailyNumber: number;
  serviceType: ServiceType;
  tableId: string | null;
  status: OrderStatus;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  payment?: Payment;
}

export interface RestaurantData {
  version: 1;
  categories: string[];
  menuItems: MenuItem[];
  tables: RestaurantTable[];
  orders: RestaurantOrder[];
}

export interface OrderDraft {
  lines: OrderLine[];
  serviceType: ServiceType;
  tableId: string | null;
}
