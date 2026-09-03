import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { Database } from '../src/database';
import { EventRepository } from '../src/database/repositories/EventRepository';
import { EventType } from '@shared/types/event';

// The 011 migration already ran during initTestDb() before any event
// existed, so it can't backfill test data. Instead we exercise the
// migration's INSERT ... SELECT statement directly.
const BACKFILL_SQL = `
  INSERT INTO visits (visitor_id, descriptor, photo_path, event_id, doorbell_id, name_snapshot, created_at)
  SELECT NULL, NULL, NULL, e.id, NULL, 'Desconhecido', e.created_at
  FROM events e
  WHERE e.type = 'person_detected'
    AND e.metadata LIKE '%"recognized":false%'
    AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.event_id = e.id);
`;

describe('migration 011 backfill_visits_from_unrecognized_events', () => {
  beforeEach(async () => { await initTestDb(); });
  afterAll(() => closeTestDb());

  it('backfills exactly one visits row per historical unrecognized detection', () => {
    const events = new EventRepository();

    // Matches: unrecognized person_detected
    const unrecognized = events.create({
      type: EventType.PERSON_DETECTED,
      metadata: { recognized: false, videoFile: 'x.webm' },
    });

    // Non-match: a recognized detection
    events.create({
      type: EventType.PERSON_DETECTED,
      metadata: { recognized: true, videoFile: 'y.webm' },
    });

    // Non-match: already has a visits row
    const alreadyLinked = events.create({
      type: EventType.PERSON_DETECTED,
      metadata: { recognized: false, videoFile: 'z.webm' },
    });

    const db = Database.getInstance().getDb();
    db.run(
      `INSERT INTO visits (event_id, name_snapshot) VALUES (?, ?)`,
      [alreadyLinked.id, 'já existia'],
    );

    db.run(BACKFILL_SQL);

    const res = db.exec('SELECT event_id, name_snapshot, visitor_id FROM visits ORDER BY id');
    const rows = res[0].values;

    // The pre-existing row + exactly one backfilled row = 2 total.
    expect(rows).toHaveLength(2);

    const backfilled = rows.find((r) => r[0] === unrecognized.id)!;
    expect(backfilled).toBeDefined();
    expect(backfilled[1]).toBe('Desconhecido');
    expect(backfilled[2]).toBeNull();

    // Not backfilled: recognized event, and the already-linked one stays single.
    const linkedCount = rows.filter((r) => r[0] === alreadyLinked.id).length;
    expect(linkedCount).toBe(1);
  });
});
