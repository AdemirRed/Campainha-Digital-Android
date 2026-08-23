import { useEffect, useRef, useState } from 'react';
import { apiService } from '../../services/apiService';
import { captureVideoFrameAsBase64, fileToBase64 } from '../../utils/imageCapture';
import { Resident } from '@shared/types/resident';
import Button from '../../components/Button';

const CAPTURES_NEEDED = 4;

export function AdminResidentsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadResidents() {
    setLoading(true);
    setError(null);
    try {
      setResidents(await apiService.getResidents());
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar cadastrados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResidents();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function handleDelete(resident: Resident) {
    if (!window.confirm(`Remover "${resident.name}" dos cadastrados?`)) return;
    setDeletingId(resident.id);
    try {
      await apiService.deleteResident(resident.id);
      setResidents((prev) => prev.filter((r) => r.id !== resident.id));
      showToast('Removido com sucesso');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStarted(true);
    } catch (err: any) {
      showToast(`Não foi possível acessar a câmera: ${err.message || err.name || 'erro desconhecido'}`, 'error');
    }
  }

  async function captureOne() {
    if (!videoRef.current) return;
    setCapturing(true);
    try {
      const base64 = captureVideoFrameAsBase64(videoRef.current);
      const descriptor = await apiService.getFaceDescriptor(base64);
      setDescriptors((prev) => [...prev, descriptor]);
      showToast('Foto capturada!');
    } catch (err: any) {
      showToast(err.message || 'Nenhum rosto detectado, tente novamente', 'error');
    } finally {
      setCapturing(false);
    }
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setCapturing(true);
    let added = 0;

    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        const descriptor = await apiService.getFaceDescriptor(base64);
        setDescriptors((prev) => [...prev, descriptor]);
        added++;
      } catch {
        // skip files that fail to load or have no detectable face
      }
    }

    setCapturing(false);

    if (added === 0) {
      showToast('Nenhum rosto detectado nas fotos enviadas', 'error');
    } else if (added < files.length) {
      showToast(`${added} de ${files.length} fotos usadas (as demais não tinham rosto detectável)`);
    } else {
      showToast(`${added} foto(s) adicionada(s)`);
    }
  }

  async function handleSave() {
    if (!name) {
      showToast('Nome é obrigatório', 'error');
      return;
    }
    if (descriptors.length === 0) {
      showToast('Capture ou envie ao menos uma foto', 'error');
      return;
    }

    try {
      await apiService.createResident({ name, is_admin: isAdmin, descriptors });
      showToast('Cadastrado com sucesso!');
      setName('');
      setIsAdmin(false);
      setDescriptors([]);
      loadResidents();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar cadastro', 'error');
    }
  }

  return (
    <div>
      <h2 className="mb-16" style={{ fontSize: '24px' }}>Cadastrar pessoa</h2>
      <p style={{ color: '#64748b', marginTop: '-8px', marginBottom: '16px' }}>
        Moradores, visitantes frequentes, etc. (reconhecimento processado no servidor)
      </p>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome"
        style={{ fontSize: '20px', padding: '12px', width: '100%', marginBottom: '16px' }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        Esta pessoa tem acesso ao painel admin
      </label>

      <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: '400px', marginBottom: '8px' }} />
      {cameraStarted && (
        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
          Afaste um pouco o celular para o rosto inteiro (testa ao queixo) aparecer no quadro, com boa
          iluminação.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      <div className="grid grid-1">
        {!cameraStarted && <Button onClick={startCamera}>Ligar câmera</Button>}
        {cameraStarted && (
          <Button onClick={captureOne} disabled={capturing}>
            {capturing ? 'Analisando rosto...' : `Capturar foto (${descriptors.length}/${CAPTURES_NEEDED})`}
          </Button>
        )}
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={capturing}>
          {capturing ? 'Analisando fotos...' : `Enviar fotos do dispositivo (${descriptors.length}/${CAPTURES_NEEDED})`}
        </Button>
        <Button variant="success" onClick={handleSave} disabled={descriptors.length === 0}>
          Salvar cadastro
        </Button>
      </div>

      <h2 className="mt-32 mb-16" style={{ fontSize: '24px' }}>Pessoas cadastradas</h2>

      {loading && <p>Carregando...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {!loading && !error && residents.length === 0 && <p>Nenhuma pessoa cadastrada ainda.</p>}

      {residents.map((resident) => (
        <div
          key={resident.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            marginBottom: '10px',
            borderRadius: '10px',
            border: '2px solid var(--border)',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>
              {resident.name} {resident.is_admin && '👑'}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {resident.descriptors.length} foto(s) · cadastrado em{' '}
              {new Date(resident.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <button
            onClick={() => handleDelete(resident)}
            disabled={deletingId === resident.id}
            style={{
              background: 'transparent',
              border: '2px solid var(--error)',
              color: 'var(--error)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '18px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {deletingId === resident.id ? '...' : '🗑️'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default AdminResidentsTab;
