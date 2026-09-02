export interface Visit {
  id: number;
  visitor_id: number | null;
  descriptor: number[] | null;
  photo_path: string | null;
  event_id: number | null;
  doorbell_id: number | null;
  name_snapshot: string | null;
  created_at: string;
}

export interface CreateVisitDTO {
  visitor_id?: number | null;
  descriptor?: number[] | null;
  photo_path?: string | null;
  event_id?: number | null;
  doorbell_id?: number | null;
  name_snapshot?: string | null;
}
