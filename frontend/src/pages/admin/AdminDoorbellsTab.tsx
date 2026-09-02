import { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import type { Doorbell, KioskLockState } from '@shared/types/doorbell';

export function AdminDoorbellsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [doorbells, setDoorbells] = useState<Doorbell[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [draft, setDraft] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    try {
      const list = await apiService.getDoorbells();
      setDoorbells(list);
      setDraft(Object.fromEntries(list.map((d) => [d.id, d.name])));
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar campainhas', 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleRename(id: number) {
    const name = (draft[id] ?? '').trim();
    if (!name) return;
    try {
      await apiService.renameDoorbell(id, name);
      showToast('Nome salvo');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao renomear', 'error');
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await apiService.createDoorbell(name);
      setNewName('');
      showToast('Campainha adicionada');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao adicionar', 'error');
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Remover esta campainha?')) return;
    try {
      await apiService.deleteDoorbell(id);
      showToast('Campainha removida');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao remover', 'error');
    }
  }

  return (
    <div>
      <h2 className="admin-section-title">Campainhas</h2>
      {loading && <p>Carregando...</p>}

      {doorbells.map((d) => (
        <div key={d.id} className="admin-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={draft[d.id] ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, [d.id]: e.target.value }))}
              style={{ fontSize: 16, padding: 8, flex: '1 1 180px' }}
            />
            <button className="admin-btn" onClick={() => handleRename(d.id)}>Salvar nome</button>
            {d.id !== 1 && (
              <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(d.id)}>Remover</button>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>ID técnico: {d.device_key}</div>
          <KioskBlock doorbellId={d.id} showToast={showToast} />
        </div>
      ))}

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="Nome da nova campainha"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ fontSize: 16, padding: 8, flex: '1 1 180px' }}
        />
        <button className="admin-btn" onClick={handleCreate}>Adicionar campainha</button>
      </div>
    </div>
  );
}

function KioskBlock({ doorbellId, showToast }: { doorbellId: number; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [state, setState] = useState<KioskLockState | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [remaining, setRemaining] = useState<number>(0);

  async function refresh() {
    try { setState(await apiService.getKioskLock(doorbellId)); } catch { /* silencioso */ }
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [doorbellId]);

  useEffect(() => {
    if (!state?.unlockUntil) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, new Date(state.unlockUntil!).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [state?.unlockUntil]);

  const mmss = () => {
    const s = Math.floor(remaining / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  async function doUnlock() {
    try { setState(await apiService.unlockKiosk(doorbellId, minutes)); showToast(`Desbloqueado por ${minutes} min`); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }
  async function doLock() {
    try { setState(await apiService.lockKiosk(doorbellId)); showToast('Retravado'); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }
  async function toggleEnabled() {
    if (!state) return;
    try { setState(await apiService.setKioskLockEnabled(doorbellId, !state.lockEnabled)); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }

  if (!state) return null;
  const statusText = !state.lockEnabled ? '⚪ Modo kiosk desligado'
    : state.locked ? '🔒 Travado'
    : `🔓 Destravado${remaining > 0 ? ` (${mmss()})` : ''}`;

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={state.lockEnabled} onChange={toggleEnabled} />
        Modo kiosk (reabre sozinho ao fechar)
      </label>
      <div style={{ margin: '6px 0', fontWeight: 600 }}>{statusText}</div>
      {state.lockEnabled && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ padding: 6 }}>
            {[5, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <button className="admin-btn" onClick={doUnlock}>Desbloquear</button>
          <button className="admin-btn admin-btn-danger" onClick={doLock}>Retravar agora</button>
        </div>
      )}
    </div>
  );
}

export default AdminDoorbellsTab;
