import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import Button from '../../components/Button';
import { listenOnce, isSpeechRecognitionSupported } from '../../utils/voiceRecognition';

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

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

  const [presenceStatus, setPresenceStatus] = useState<{ text: string; updatedAt: string } | null>(null);
  const [recordingPresence, setRecordingPresence] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiService
      .getStorageUsage()
      .then(setUsage)
      .catch((err) => setError(err.message || 'Erro ao carregar uso de armazenamento'))
      .finally(() => setLoading(false));

    apiService.getAssistantInstructions().then(setInstructions);
    apiService.getPresenceStatus().then(setPresenceStatus);
  }, []);

  async function handleRecordPresence() {
    if (!isSpeechRecognitionSupported()) {
      showToast('Reconhecimento de voz não disponível neste dispositivo', 'error');
      return;
    }
    setRecordingPresence(true);
    try {
      const said = await listenOnce();
      if (!said.trim()) {
        showToast('Não entendi, tente novamente', 'error');
        return;
      }
      await apiService.setPresenceStatus(said);
      const updated = await apiService.getPresenceStatus();
      setPresenceStatus(updated);
      showToast('Status salvo!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar status', 'error');
    } finally {
      setRecordingPresence(false);
    }
  }

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
      <h2 className="admin-section-title">Armazenamento</h2>

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

      <h2 className="admin-section-title">Instruções para o assistente</h2>
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

      <h2 className="admin-section-title">Status de presença</h2>
      <p style={{ color: '#64748b', marginTop: '-8px', marginBottom: '16px', fontSize: '14px' }}>
        Grave um aviso por voz (ex: "Estou saindo, volto às 21h") para o assistente responder
        visitantes que perguntarem se há alguém em casa.
      </p>
      {presenceStatus && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            border: '2px solid var(--border)',
            textAlign: 'left',
            fontSize: '15px',
          }}
        >
          <strong>"{presenceStatus.text}"</strong>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            Atualizado em {formatUpdatedAt(presenceStatus.updatedAt)}
          </div>
        </div>
      )}
      <div className="grid grid-1" style={{ marginBottom: '24px' }}>
        <Button variant="outline" onClick={handleRecordPresence} disabled={recordingPresence}>
          {recordingPresence ? '🎙️ Ouvindo...' : '🎙️ Gravar status de presença'}
        </Button>
      </div>

      <h2 className="admin-section-title">Notificações</h2>
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
