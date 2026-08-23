import { useEffect, useMemo, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';

interface Recording {
  filename: string;
  size: number;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminRecordingsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRecordings(await apiService.getContinuousRecordings());
    } catch {
      // non-critical - other tabs still work
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byDay = useMemo(() => {
    const groups: Record<string, Recording[]> = {};
    for (const rec of recordings) {
      const day = rec.createdAt.slice(0, 10);
      (groups[day] ||= []).push(rec);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [recordings]);

  async function handleDelete(filename: string) {
    if (!window.confirm('Apagar este clipe?')) return;
    setDeletingFile(filename);
    try {
      await apiService.deleteContinuousRecording(filename);
      setRecordings((prev) => prev.filter((r) => r.filename !== filename));
      showToast('Clipe removido');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover', 'error');
    } finally {
      setDeletingFile(null);
    }
  }

  return (
    <div>
      <h2 className="mb-16" style={{ fontSize: '24px' }}>Gravações 24h (últimos 7 dias)</h2>
      <p style={{ color: '#64748b', marginTop: '-8px', marginBottom: '16px', fontSize: '14px' }}>
        Clipes de 5 minutos gravados continuamente. Os mais antigos que 7 dias são apagados
        automaticamente.
      </p>

      {loading && <p>Carregando...</p>}
      {!loading && byDay.length === 0 && <p>Nenhuma gravação ainda.</p>}

      {byDay.map(([day, dayRecordings]) => (
        <div key={day} style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setExpandedDay(expandedDay === day ? null : day)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '2px solid var(--border)',
              background: 'var(--bg-darker)',
              color: 'var(--text-light)',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            {new Date(day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            {' — '}
            {dayRecordings.length} clipe(s) {expandedDay === day ? '▲' : '▼'}
          </button>

          {expandedDay === day && (
            <div style={{ marginTop: '8px' }}>
              {dayRecordings.map((rec) => (
                <div
                  key={rec.filename}
                  style={{
                    padding: '10px 14px',
                    marginBottom: '8px',
                    borderRadius: '8px',
                    border: '2px solid var(--border)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                    {new Date(rec.createdAt).toLocaleTimeString('pt-BR')} · {formatBytes(rec.size)}
                  </div>
                  <video
                    controls
                    src={`${STORAGE_BASE_URL}/storage/continuous/${rec.filename}`}
                    style={{ width: '100%', maxWidth: '400px' }}
                  />
                  <div>
                    <button
                      onClick={() => handleDelete(rec.filename)}
                      disabled={deletingFile === rec.filename}
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
                      {deletingFile === rec.filename ? '...' : '🗑️ Apagar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default AdminRecordingsTab;
