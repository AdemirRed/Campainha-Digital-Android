export interface Doorbell {
  id: number;
  name: string;
  device_key: string;
  lock_enabled: boolean;
  unlock_until: string | null; // ISO ou null
  created_at: string;
  updated_at: string;
}

export interface KioskLockState {
  locked: boolean;
  unlockUntil: string | null;
  lockEnabled: boolean;
}
