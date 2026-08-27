import { useEffect, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';
import { Event } from '@shared/types/event';
import { ChatTranscript } from '../../components/ChatTranscript';

function isTranscript(text: string): boolean {
  return text.includes('Assistente:') && text.includes('Visitante:');
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 90)}...` : flat;
}

export function AdminMessagesTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [messages, setMessages] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Remover ${selected.size} mensagem(ns) selecionada(s)?`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => apiService.deleteEvent(id)));
    const succeededIds = ids.filter((_, i) => results[i].status === 'fulfilled');
    setMessages((prev) => prev.filter((m) => !succeededIds.includes(m.id)));
    setSelected(new Set());
    setBulkDeleting(false);
    const failedCount = ids.length - succeededIds.length;
    if (failedCount > 0) {
      showToast(`${succeededIds.length} removida(s), ${failedCount} falharam`, 'error');
    } else {
      showToast(`${succeededIds.length} mensagem(ns) removida(s)`);
    }
  }

  return (
    <div>
      <h2 className="admin-section-title">Mensagens recebidas</h2>

      {messages.length > 0 && (
        <div className="admin-toolbar">
          <button
            className="admin-btn"
            onClick={() =>
              setSelected(selected.size === messages.length ? new Set() : new Set(messages.map((m) => m.id)))
            }
          >
            {selected.size === messages.length ? 'Desmarcar todas' : 'Selecionar todas'}
          </button>
          <button
            className="admin-btn admin-btn-danger"
            onClick={handleBulkDelete}
            disabled={selected.size === 0 || bulkDeleting}
          >
            {bulkDeleting ? 'Removendo...' : `🗑️ Apagar selecionadas (${selected.size})`}
          </button>
        </div>
      )}

      {loading && <p>Carregando...</p>}
      {!loading && messages.length === 0 && <div className="admin-empty">Nenhuma mensagem ainda.</div>}

      {messages.map((event) => {
        const message = event.metadata?.message as string | undefined;
        const transcript = message ? isTranscript(message) : false;
        const isExpanded = expanded.has(event.id);

        return (
          <div key={event.id} className="admin-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input
                type="checkbox"
                className="admin-checkbox"
                checked={selected.has(event.id)}
                onChange={() => toggleSelected(event.id)}
                style={{ marginTop: '3px' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                  {new Date(event.created_at).toLocaleString('pt-BR')}
                </div>

                {message && !transcript && (
                  <div style={{ fontSize: '15px', marginBottom: '8px' }}>{message}</div>
                )}

                {message && transcript && (
                  <>
                    {!isExpanded && (
                      <div style={{ fontSize: '14px', color: 'var(--text-gray)', marginBottom: '8px' }}>
                        {preview(message)}
                      </div>
                    )}
                    <button className="admin-btn" onClick={() => toggleExpanded(event.id)} style={{ marginBottom: '8px' }}>
                      {isExpanded ? '▲ Ocultar conversa' : '💬 Ver conversa'}
                    </button>
                    {isExpanded && <ChatTranscript text={message} />}
                  </>
                )}

                {event.metadata?.audioFile && (
                  <audio
                    controls
                    src={`${STORAGE_BASE_URL}/storage/audios/${event.metadata.audioFile}`}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                )}

                <div>
                  <button
                    className="admin-btn admin-btn-danger"
                    onClick={() => handleDelete(event)}
                    disabled={deletingId === event.id}
                    style={{ marginTop: '8px' }}
                  >
                    {deletingId === event.id ? '...' : '🗑️ Remover'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AdminMessagesTab;
