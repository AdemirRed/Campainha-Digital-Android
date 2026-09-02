import { describe, it, expect, vi } from 'vitest';
import { setCallActive, isCallActive, onCallActiveChange } from '../src/utils/kioskBusy';

describe('kioskBusy', () => {
  it('guarda o estado e notifica listeners', () => {
    const cb = vi.fn();
    const off = onCallActiveChange(cb);
    expect(isCallActive()).toBe(false);
    setCallActive(true);
    expect(isCallActive()).toBe(true);
    expect(cb).toHaveBeenCalledWith(true);
    off();
    setCallActive(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
