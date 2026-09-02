import { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import type { Doorbell } from '@shared/types/doorbell';

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
          {/* bloco de modo kiosk — Task 15 */}
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

export default AdminDoorbellsTab;
