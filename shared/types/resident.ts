export interface Resident {
  id: number;
  name: string;
  is_admin: boolean;
  descriptors: number[][];
  created_at: string;
  updated_at: string;
}

export interface CreateResidentDTO {
  name: string;
  is_admin?: boolean;
  descriptors: number[][];
}

export interface UpdateResidentDTO {
  name?: string;
  is_admin?: boolean;
  descriptors?: number[][];
}
