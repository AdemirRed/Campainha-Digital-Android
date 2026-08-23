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

export function AdminSettingsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instructions, setInstructions] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiService
      .getStorageUsage()
      .then(setUsage)
      .catch((err) => setError(err.message || 'Erro ao carregar uso de armazenamento'))
      .finally(() => setLoading(false));

    apiService.getAssistantInstructions().then(setInstructions);
  }, []);

  async function handleSaveInstructions() {
    setSavingInstructions(true);
    try {
      await apiService.setAssistantInstructions(instructions);
      showToast('Instruções salvas!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSavingInstructions(false);
    }
  }

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

      <h2 className="mb-16" style={{ fontSize: '24px' }}>Instruções para o assistente</h2>
      <p style={{ color: '#64748b', marginTop: '-8px', marginBottom: '16px', fontSize: '14px' }}>
        O que a IA deve dizer para visitantes específicos, ex: "Se for entrega do Mercado Livre, o
        código é 1234. Peça para o entregador deixar o pacote na cadeira da varanda."
      </p>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={5}
        placeholder="Digite as instruções..."
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '16px',
          borderRadius: '10px',
          border: '2px solid var(--border)',
          background: 'var(--bg-darker)',
          color: 'var(--text-light)',
          marginBottom: '12px',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <div className="grid grid-1" style={{ marginBottom: '24px' }}>
        <Button onClick={handleSaveInstructions} disabled={savingInstructions}>
          {savingInstructions ? 'Salvando...' : 'Salvar instruções'}
        </Button>
      </div>

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
