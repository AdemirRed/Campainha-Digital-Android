import { describe, it, expect } from 'vitest';
import { computeLockState } from '../src/domain/kioskLock';

const now = new Date('2026-09-02T12:00:00.000Z');

describe('computeLockState', () => {
  it('lock desligado → nunca travado', () => {
    expect(computeLockState({ lockEnabled: false, unlockUntil: null, now }).locked).toBe(false);
  });
  it('lock ligado, sem unlock → travado', () => {
    expect(computeLockState({ lockEnabled: true, unlockUntil: null, now }).locked).toBe(true);
  });
  it('lock ligado, unlock no futuro → destravado', () => {
    expect(computeLockState({ lockEnabled: true, unlockUntil: '2026-09-02T12:10:00.000Z', now }).locked).toBe(false);
  });
  it('lock ligado, unlock no passado → travado', () => {
    expect(computeLockState({ lockEnabled: true, unlockUntil: '2026-09-02T11:59:00.000Z', now }).locked).toBe(true);
  });
  it('devolve unlockUntil e lockEnabled', () => {
    const s = computeLockState({ lockEnabled: true, unlockUntil: '2026-09-02T12:10:00.000Z', now });
    expect(s).toEqual({ locked: false, unlockUntil: '2026-09-02T12:10:00.000Z', lockEnabled: true });
  });
});
