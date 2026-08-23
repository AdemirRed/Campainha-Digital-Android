import { useEffect, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';
import { Event } from '@shared/types/event';

function DeleteButton({ onDelete, deleting }: { onDelete: () => void; deleting: boolean }) {
  return (
    <button
      onClick={onDelete}
      disabled={deleting}
      style={{
        background: 'transparent',
        border: '2px solid var(--error)',
        color: 'var(--error)',
        borderRadius: '8px',
        padding: '6px 12px',
        fontSize: '14px',
        cursor: 'pointer',
        marginTop: '8px',
      }}
    >
      {deleting ? '...' : '🗑️ Remover'}
    </button>
  );
}

export function AdminMessagesTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [messages, setMessages] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { items } = await apiService.getEvents(1, 50);
      setMessages(items.filter((e) => e.metadata?.reason === 'other'));
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
    if (!window.confirm('Remover esta mensagem?')) return;
    setDeletingId(event.id);
    try {
      await apiService.deleteEvent(event.id);
      setMessages((prev) => prev.filter((m) => m.id !== event.id));
      showToast('Mensagem removida');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h2 className="mb-16" style={{ fontSize: '24px' }}>Mensagens recebidas</h2>

      {loading && <p>Carregando...</p>}
      {!loading && messages.length === 0 && <p>Nenhuma mensagem ainda.</p>}

      {messages.map((event) => (
        <div
          key={event.id}
          style={{
            padding: '12px 16px',
            marginBottom: '10px',
            borderRadius: '10px',
            border: '2px solid var(--border)',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
            {new Date(event.created_at).toLocaleString('pt-BR')}
          </div>
          {event.metadata?.message && (
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>{event.metadata.message}</div>
          )}
          {event.metadata?.audioFile && (
            <audio
              controls
              src={`${STORAGE_BASE_URL}/storage/audios/${event.metadata.audioFile}`}
              style={{ width: '100%' }}
            />
          )}
          <DeleteButton onDelete={() => handleDelete(event)} deleting={deletingId === event.id} />
        </div>
      ))}
    </div>
  );
}

export default AdminMessagesTab;
