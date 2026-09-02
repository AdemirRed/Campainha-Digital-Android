import { useEffect, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';
import type { Visit } from '@shared/types/visit';

type Mode = 'people' | 'timeline';

interface VisitorRow {
  id: number;
  name: string;
  photo_path: string | null;
  visit_count: number;
  last_seen_at: string;
}

function photoUrl(p: string | null): string | undefined {
  return p ? `${STORAGE_BASE_URL}/storage/photos/${p}` : undefined;
}

export function AdminVisitorsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [mode, setMode] = useState<Mode>('people');
  return (
    <div>
      <h2 className="admin-section-title">Visitantes</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="admin-btn" style={{ opacity: mode === 'people' ? 1 : 0.55 }} onClick={() => setMode('people')}>Pessoas</button>
        <button className="admin-btn" style={{ opacity: mode === 'timeline' ? 1 : 0.55 }} onClick={() => setMode('timeline')}>Linha do tempo</button>
      </div>
      {mode === 'people' ? <PeopleView showToast={showToast} /> : <TimelineView showToast={showToast} />}
    </div>
  );
}

function PeopleView({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  async function load() {
    setLoading(true);
    try {
      const list = await apiService.getVisitors();
      setRows(list);
      setDraft(Object.fromEntries(list.map((v: VisitorRow) => [v.id, v.name])));
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar', 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function rename(id: number) {
    const name = (draft[id] ?? '').trim();
    if (!name) return;
    try { await apiService.renameVisitor(id, name); showToast('Nome salvo'); load(); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }

  async function toggle(id: number) {
    if (expanded === id) { setExpanded(null); setVisits([]); return; }
    setExpanded(id);
    try { setVisits(await apiService.getVisitorVisits(id)); }
    catch { setVisits([]); }
  }

  const isUnknown = (name: string) => !name || name.toLowerCase().startsWith('desconhecido');

  if (loading) return <p>Carregando...</p>;
  if (rows.length === 0) return <div className="admin-empty">Nenhum visitante ainda.</div>;

  return (
    <div className="admin-video-grid">
      {rows.map((v) => (
        <div key={v.id} className="admin-card">
          {photoUrl(v.photo_path)
            ? <img src={photoUrl(v.photo_path)} alt={v.name} style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
            : <div style={{ height: 120, background: 'var(--bg-darker)', borderRadius: 8, marginBottom: 8, display: 'grid', placeItems: 'center' }}>sem foto</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              value={draft[v.id] ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, [v.id]: e.target.value }))}
              placeholder={isUnknown(v.name) ? `Desconhecido #${v.id}` : ''}
              style={{ flex: '1 1 120px', padding: 6, fontSize: 15 }}
            />
            <button className="admin-btn" onClick={() => rename(v.id)}>Salvar</button>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            {v.visit_count} visita(s) · última {new Date(v.last_seen_at).toLocaleString('pt-BR')}
          </div>
          <button className="admin-btn" style={{ marginTop: 8 }} onClick={() => toggle(v.id)}>
            {expanded === v.id ? 'Ocultar visitas' : 'Ver visitas'}
          </button>
          {expanded === v.id && (
            <div style={{ marginTop: 8 }}>
              {visits.length === 0 && <p style={{ fontSize: 13 }}>Sem visitas registradas.</p>}
              {visits.map((vis) => (
                <div key={vis.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  {photoUrl(vis.photo_path) && <img src={photoUrl(vis.photo_path)} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />}
                  <span style={{ fontSize: 13 }}>{new Date(vis.created_at).toLocaleString('pt-BR')}{vis.doorbell_id ? ` · campainha ${vis.doorbell_id}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Preenchido na Task 25
function TimelineView(_props: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  return <p>Carregando linha do tempo...</p>;
}

export default AdminVisitorsTab;
