import { useEffect, useMemo, useRef, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';

interface Recording {
  filename: string;
  size: number;
  createdAt: string;
}

function DayCheckbox({ selected, total, disabled, label, onChange }: {
  selected: number;
  total: number;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = selected > 0 && selected < total;
  }, [selected, total]);

  return (
    <input
      ref={input}
      className="admin-checkbox"
      type="checkbox"
      aria-label={label}
      checked={selected === total}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Only fetches the actual video when the poster is clicked. The poster
// image itself is lazy (loads when scrolled into view), so opening a day
// with 300+ clips no longer fires hundreds of requests at once.
function RecordingPlayer({ filename }: { filename: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  if (playing) {
    return (
      <video
        controls
        autoPlay
        preload="auto"
        src={apiService.continuousRecordingUrl(filename)}
        style={{ width: '100%', borderRadius: 8, background: '#000' }}
      />
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      title="Carregar e reproduzir"
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 3',
        border: 'none',
        borderRadius: 8,
        padding: 0,
        overflow: 'hidden',
        background: '#000',
        cursor: 'pointer',
      }}
    >
      {!thumbFailed && (
        <img
          src={apiService.continuousRecordingThumbUrl(filename)}
          loading="lazy"
          alt=""
          onError={() => setThumbFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: 40,
          color: 'rgba(255,255,255,0.92)',
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        ▶
      </span>
    </button>
  );
}

interface Moment {
  id: number;
  at: string; // ISO
  name: string | null;
  photo: string | null;
  kind: 'person' | 'resident';
  clip?: string; // set by the server-side clip scanner
  offsetSec?: number; // second inside that clip where the person shows up
}

// Clip files are named/stamped when the segment is UPLOADED, i.e. at its
// end - so the clip covering moment T is the first one stamped at/after T.
function clipCovering(recordings: Recording[], atIso: string): Recording | null {
  const t = new Date(atIso).getTime();
  let best: Recording | null = null;
  for (const rec of recordings) {
    const end = new Date(rec.createdAt).getTime();
    if (end >= t && end - t < 6 * 60_000 && (!best || end < new Date(best.createdAt).getTime())) best = rec;
  }
  return best;
}

// Plays the clip around a moment, seeking to a few seconds before it when
// the browser knows the clip's duration (MediaRecorder WebM sometimes
// doesn't - then it just plays from the start).
function MomentPlayer({ rec, atIso, offsetSec }: { rec: Recording; atIso: string; offsetSec?: number }) {
  const secondsBeforeEnd = (new Date(rec.createdAt).getTime() - new Date(atIso).getTime()) / 1000;
  return (
    <video
      controls
      autoPlay
      preload="auto"
      src={apiService.continuousRecordingUrl(rec.filename)}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        if (typeof offsetSec === 'number') {
          // Exact second from the server-side detector.
          v.currentTime = Math.max(0, offsetSec - 2);
        } else if (Number.isFinite(v.duration) && v.duration > 0) {
          v.currentTime = Math.max(0, v.duration - secondsBeforeEnd - 3);
        }
      }}
      style={{ width: '100%', maxWidth: 640, borderRadius: 8, background: '#000' }}
    />
  );
}

export function AdminRecordingsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [openMoment, setOpenMoment] = useState<Moment | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const items = await apiService.getContinuousRecordings();
      setRecordings(items);
      const available = new Set(items.map((item) => item.filename));
      setSelected((prev) => new Set([...prev].filter((filename) => available.has(filename))));
    } catch {
      showToast('Não foi possível carregar as gravações', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadMoments();
  }, []);

  async function loadMoments() {
    try {
      const { items } = await apiService.getEvents(1, 500);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const list: Moment[] = [];
      for (const ev of items as any[]) {
        if (ev.type !== 'person_detected' && ev.type !== 'resident_identified') continue;
        // SQLite CURRENT_TIMESTAMP is UTC without a zone marker.
        const md = ev.metadata || {};
        // The clip scanner stores the real moment (it runs after upload);
        // otherwise SQLite CURRENT_TIMESTAMP is UTC without a zone marker.
        const at = md.at
          ? new Date(md.at)
          : new Date(String(ev.created_at).replace(' ', 'T') + (String(ev.created_at).endsWith('Z') ? '' : 'Z'));
        if (at.getTime() < weekAgo) continue;
        list.push({
          id: ev.id,
          at: at.toISOString(),
          name: md.name || md.residentName || null,
          photo: md.photo_path || null,
          kind: ev.type === 'resident_identified' ? 'resident' : 'person',
          clip: md.clip,
          offsetSec: typeof md.offsetSec === 'number' ? md.offsetSec : undefined,
        });
      }
      list.sort((a, b) => b.at.localeCompare(a.at));
      setMoments(list);
    } catch {
      // moments are a bonus - the clip list still works without them
    }
  }

  // Deep link from the push notification: ?tab=recordings&at=<iso>
  useEffect(() => {
    const at = new URLSearchParams(window.location.search).get('at');
    if (!at || recordings.length === 0 || openMoment) return;
    setOpenMoment({ id: -1, at, name: null, photo: null, kind: 'person' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings]);

  const openClip = openMoment
    ? (openMoment.clip && recordings.find((r) => r.filename === openMoment.clip)) || clipCovering(recordings, openMoment.at)
    : null;
  // Clips where the detector saw someone - badge + "só com pessoas" filter.
  const clipsWithPeople = useMemo(() => new Set(moments.map((m) => m.clip).filter(Boolean) as string[]), [moments]);
  const [onlyPeople, setOnlyPeople] = useState(false);

  const byDay = useMemo(() => {
    const groups: Record<string, Recording[]> = {};
    for (const rec of recordings) {
      // Group by LOCAL calendar day. createdAt is UTC ISO - slicing the
      // string gave the UTC day, which put late-evening clips on the next
      // day and, worse, made the label render one day early once
      // localised (new Date("2026-09-09") is UTC midnight -> "08/09" in
      // BRT). Build the key from the local date parts instead.
      const d = new Date(rec.createdAt);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      (groups[day] ||= []).push(rec);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [recordings]);

  const selectedSize = useMemo(
    () => recordings.reduce((sum, rec) => sum + (selected.has(rec.filename) ? rec.size : 0), 0),
    [recordings, selected]
  );

  function selectRecordings(filenames: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      filenames.forEach((filename) => checked ? next.add(filename) : next.delete(filename));
      return next;
    });
  }

  async function handleBatchDelete() {
    if (deletingBatch || deletingFile || selected.size === 0) return;
    const filenames = [...selected];
    const count = filenames.length;
    if (!window.confirm(`Apagar permanentemente ${count} clipe${count === 1 ? '' : 's'} (${formatBytes(selectedSize)})? Esta ação não pode ser desfeita.`)) return;

    setDeletingBatch(true);
    try {
      const { deleted, failed } = await apiService.deleteContinuousRecordings(filenames);
      const deletedSet = new Set(deleted);
      setRecordings((prev) => prev.filter((rec) => !deletedSet.has(rec.filename)));
      setSelected(new Set(failed));
      if (deleted.length) showToast(`${deleted.length} clipe${deleted.length === 1 ? '' : 's'} removido${deleted.length === 1 ? '' : 's'}`);
      if (failed.length) showToast(`Falha ao remover ${failed.length} clipe${failed.length === 1 ? '' : 's'}`, 'error');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover os clipes', 'error');
    } finally {
      setDeletingBatch(false);
    }
  }

  async function handleDelete(filename: string) {
    if (deletingBatch) return;
    if (!window.confirm('Apagar este clipe permanentemente?')) return;
    setDeletingFile(filename);
    try {
      await apiService.deleteContinuousRecording(filename);
      setRecordings((prev) => prev.filter((r) => r.filename !== filename));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
      showToast('Clipe removido');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover', 'error');
    } finally {
      setDeletingFile(null);
    }
  }

  return (
    <div>
      <h2 className="admin-section-title">Gravações 24h (últimos 7 dias)</h2>
      <p style={{ color: '#64748b', marginTop: '-8px', marginBottom: '16px', fontSize: '14px' }}>
        Clipes gravados continuamente. Os mais antigos que 7 dias são apagados
        automaticamente.
      </p>

      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>⭐ Momentos importantes</h3>
      {moments.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
          Nenhuma pessoa detectada na câmera nos últimos 7 dias.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
          {moments.map((m) => {
            const active = openMoment?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setOpenMoment(active ? null : m)}
                className="admin-card"
                style={{
                  flex: '0 0 140px',
                  padding: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: active ? '2px solid #22c55e' : undefined,
                }}
              >
                {m.photo ? (
                  <img
                    src={`${STORAGE_BASE_URL}/storage/photos/${m.photo}`}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 6, display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 6, background: '#000', display: 'grid', placeItems: 'center', fontSize: 28 }}>
                    {m.kind === 'resident' ? '🏠' : '👤'}
                  </div>
                )}
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-light)' }}>
                  {m.name || (m.kind === 'resident' ? 'Morador' : 'Pessoa')}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {new Date(m.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openMoment && (
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>
              Momento de {new Date(openMoment.at).toLocaleString('pt-BR')}
            </strong>
            <button className="admin-btn" onClick={() => setOpenMoment(null)}>✕ Fechar</button>
          </div>
          {openClip ? (
            <MomentPlayer
              key={`${openClip.filename}-${openMoment.at}`}
              rec={openClip}
              atIso={openMoment.at}
              offsetSec={openMoment.clip === openClip.filename ? openMoment.offsetSec : undefined}
            />
          ) : (
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Ainda não há clipe gravado cobrindo esse horário (pode levar ~2 min para o clipe chegar).
            </p>
          )}
        </div>
      )}

      {loading && <p>Carregando...</p>}
      {!loading && byDay.length === 0 && <p>Nenhuma gravação ainda.</p>}

      {!loading && recordings.length > 0 && (
        <div className="admin-recordings-toolbar" aria-live="polite">
          <button
            className="admin-btn"
            onClick={() => selectRecordings(recordings.map((rec) => rec.filename), selected.size !== recordings.length)}
            disabled={deletingBatch || !!deletingFile}
          >
            {selected.size === recordings.length ? 'Desmarcar todos' : `Selecionar todos (${recordings.length})`}
          </button>
          <button
            className="admin-btn"
            onClick={() => setOnlyPeople((v) => !v)}
            aria-pressed={onlyPeople}
            style={onlyPeople ? { borderColor: '#22c55e', color: '#22c55e' } : undefined}
          >
            👤 {onlyPeople ? 'Mostrando só com pessoas' : `Só com pessoas (${clipsWithPeople.size})`}
          </button>
          {selected.size > 0 && (
            <>
              <span className="admin-recordings-count">{selected.size} selecionado{selected.size === 1 ? '' : 's'} · {formatBytes(selectedSize)}</span>
              <button className="admin-btn" onClick={() => setSelected(new Set())} disabled={deletingBatch || !!deletingFile}>
                Limpar seleção
              </button>
              <button className="admin-btn admin-btn-danger" onClick={handleBatchDelete} disabled={deletingBatch || !!deletingFile}>
                {deletingBatch ? 'Apagando...' : `Apagar ${selected.size} selecionado${selected.size === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      )}

      {byDay.map(([day, allDayRecordings]) => {
        const dayRecordings = onlyPeople
          ? allDayRecordings.filter((rec) => clipsWithPeople.has(rec.filename))
          : allDayRecordings;
        if (dayRecordings.length === 0) return null;
        const withPeople = allDayRecordings.filter((rec) => clipsWithPeople.has(rec.filename)).length;
        return (
        <div key={day} className="admin-recordings-day">
          <div className="admin-recordings-day-header">
            <DayCheckbox
              selected={dayRecordings.filter((rec) => selected.has(rec.filename)).length}
              total={dayRecordings.length}
              disabled={deletingBatch || !!deletingFile}
              label={`Selecionar todas as gravações de ${new Date(`${day}T00:00:00`).toLocaleDateString('pt-BR')}`}
              onChange={(checked) => selectRecordings(dayRecordings.map((rec) => rec.filename), checked)}
            />
            <button
              onClick={() => setExpandedDay(expandedDay === day ? null : day)}
              className="admin-recordings-day-toggle"
              aria-expanded={expandedDay === day}
            >
              {new Date(`${day}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
              {' — '}
              {dayRecordings.length} clipe(s){withPeople > 0 ? ` · 👤 ${withPeople} com pessoas` : ''} {expandedDay === day ? '▲' : '▼'}
            </button>
          </div>

          {expandedDay === day && (
            <div className="admin-video-grid" style={{ marginTop: '8px' }}>
              {dayRecordings.map((rec) => (
                <div key={rec.filename} className={`admin-card admin-recording-card${selected.has(rec.filename) ? ' is-selected' : ''}`}>
                  <label className="admin-recordings-card-label">
                    <input
                      className="admin-checkbox"
                      type="checkbox"
                      checked={selected.has(rec.filename)}
                      disabled={deletingBatch || !!deletingFile}
                      onChange={(event) => selectRecordings([rec.filename], event.target.checked)}
                    />
                    <span>
                      {clipsWithPeople.has(rec.filename) && <span title="Pessoa detectada">👤 </span>}
                      {new Date(rec.createdAt).toLocaleTimeString('pt-BR')} · {formatBytes(rec.size)}
                    </span>
                  </label>
                  <RecordingPlayer filename={rec.filename} />
                  <button
                    className="admin-btn admin-btn-danger"
                    onClick={() => handleDelete(rec.filename)}
                    disabled={deletingBatch || !!deletingFile}
                    style={{ marginTop: '8px' }}
                  >
                    {deletingFile === rec.filename ? '...' : '🗑️ Apagar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

export default AdminRecordingsTab;
