import { KioskLockState } from '@shared/types/doorbell';

export function computeLockState(input: {
  lockEnabled: boolean;
  unlockUntil: string | null;
  now?: Date;
}): KioskLockState {
  const now = input.now ?? new Date();
  let locked = input.lockEnabled;
  if (locked && input.unlockUntil) {
    locked = now.getTime() >= new Date(input.unlockUntil).getTime();
  }
  return { locked, unlockUntil: input.unlockUntil, lockEnabled: input.lockEnabled };
}
