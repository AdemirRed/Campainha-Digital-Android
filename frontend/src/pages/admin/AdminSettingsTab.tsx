import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import Button from '../../components/Button';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface Usage {
  audios: { bytes: number; files: number };
  videos: { bytes: number; files: number };
  continuous: { bytes: number; files: number };
  photos: { bytes: number; files: number };
  totalBytes: number;
}

export function AdminSettingsTab() {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiService
      .getStorageUsage()
      .then(setUsage)
      .catch((err) => setError(err.message || 'Erro ao carregar uso de armazenamento'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="mb-16" style={{ fontSize: '24px' }}>Armazenamento</h2>

      {loading && <p>Carregando...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {usage && (
        <div
          style={{
            padding: '16px',
            marginBottom: '24px',
            borderRadius: '10px',
            border: '2px solid var(--border)',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
            Total: {formatBytes(usage.totalBytes)}
          </div>
          <div style={{ fontSize: '15px', lineHeight: 1.8 }}>
            <div>🎙️ Mensagens de áudio: {formatBytes(usage.audios.bytes)} ({usage.audios.files} arquivo(s))</div>
            <div>🎥 Visitantes gravados: {formatBytes(usage.videos.bytes)} ({usage.videos.files} arquivo(s))</div>
            <div>📹 Gravações 24h: {formatBytes(usage.continuous.bytes)} ({usage.continuous.files} arquivo(s))</div>
            <div>🖼️ Fotos: {formatBytes(usage.photos.bytes)} ({usage.photos.files} arquivo(s))</div>
          </div>
        </div>
      )}

      <h2 className="mb-16" style={{ fontSize: '24px' }}>Notificações</h2>
      <p style={{ color: '#64748b', marginTop: '-8px', marginBottom: '16px', fontSize: '14px' }}>
        Abra esta tela num segundo aparelho para ouvir um aviso toda vez que alguém tocar a
        campainha.
      </p>
      <div className="grid grid-1">
        <Button variant="outline" onClick={() => navigate('/notifications')}>
          🔔 Abrir tela de notificações
        </Button>
      </div>
    </div>
  );
}

export default AdminSettingsTab;
