export enum DeliveryCompany {
  MERCADO_LIVRE = 'mercadolivre',
  SHOPEE = 'shopee',
  CORREIOS = 'correios',
  AMAZON = 'amazon',
  OTHER = 'other'
}

export interface Delivery {
  id: number;
  event_id: number;
  company: DeliveryCompany;
  tracking_code?: string;
  notes?: string;
  photo_path?: string | null;
  created_at: string;
}

export interface CreateDeliveryDTO {
  event_id: number;
  company: DeliveryCompany;
  tracking_code?: string;
  notes?: string;
  photoBase64?: string;
}
