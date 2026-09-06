// A delivery confirmation code the resident registered ahead of time -
// the number a courier (iFood, Mercado Livre, ...) asks for at the door.
export interface DeliveryCode {
  id: string;
  company: string; // DELIVERY_COMPANIES value, or free text
  code: string;
  note?: string;
  createdAt: string;
}
