import { describe, it, expect } from 'vitest';
import { describeEvent } from '../src/pages/NotificationsPage';
import { EventType, EventStatus } from '@shared/types/event';

const base = { id: 1, status: EventStatus.PENDING, created_at: '' } as const;

describe('describeEvent', () => {
  it('descreve visitante não identificado', () => {
    const txt = describeEvent({ ...base, type: EventType.PERSON_DETECTED, metadata: { recognized: false } } as any);
    expect(txt).toBe('Visitante não identificado na porta');
  });

  it('prefixa o nome da campainha quando há doorbellId no mapa', () => {
    const txt = describeEvent(
      { ...base, type: EventType.PERSON_DETECTED, metadata: { recognized: false, doorbellId: 2 } } as any,
      { 2: 'Fundos' },
    );
    expect(txt).toBe('Fundos: Visitante não identificado na porta');
  });

  it('sem mapa/sem doorbellId, não prefixa', () => {
    const txt = describeEvent(
      { ...base, type: EventType.PERSON_DETECTED, metadata: { recognized: false, doorbellId: 2 } } as any,
    );
    expect(txt).toBe('Visitante não identificado na porta');
  });
});
