import { useEffect, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';
import { Event, EventType } from '@shared/types/event';

export function AdminVisitorsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [visits, setVisits] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { items } = await apiService.getEvents(1, 50);
      setVisits(
        items.filter((e) => e.type === EventType.PERSON_DETECTED && e.metadata?.recognized === false)
      );
    } catch {
      // non-critical - other tabs still work
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(event: Event) {
    if (!window.confirm('Remover este registro e o vídeo associado?')) return;
    setDeletingId(event.id);
    try {
      await apiService.deleteEvent(event.id);
      setVisits((prev) => prev.filter((v) => v.id !== event.id));
      showToast('Registro removido');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h2 className="admin-section-title">Visitantes não reconhecidos</h2>

      {loading && <p>Carregando...</p>}
      {!loading && visits.length === 0 && <div className="admin-empty">Nenhum registro ainda.</div>}

      <div className="admin-video-grid">
        {visits.map((event) => (
          <div key={event.id} className="admin-card">
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
              {new Date(event.created_at).toLocaleString('pt-BR')}
            </div>
            {event.metadata?.videoFile && (
              <video controls src={`${STORAGE_BASE_URL}/storage/videos/${event.metadata.videoFile}`} />
            )}
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => handleDelete(event)}
              disabled={deletingId === event.id}
              style={{ marginTop: '8px' }}
            >
              {deletingId === event.id ? '...' : '🗑️ Remover'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminVisitorsTab;
