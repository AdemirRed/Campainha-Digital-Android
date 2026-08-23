import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { captureVideoFrameAsBase64, fileToBase64 } from '../utils/imageCapture';
import { Resident } from '@shared/types/resident';
import Button from '../components/Button';
import Toast from '../components/Toast';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';
const CAPTURES_NEEDED = 4;

export function AdminResidentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const recognizedAdmin = Boolean((location.state as any)?.recognizedAdmin);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [unlocked, setUnlocked] = useState(recognizedAdmin);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [residentsError, setResidentsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadResidents() {
    setResidentsLoading(true);
    setResidentsError(null);
    try {
      const list = await apiService.getResidents();
      setResidents(list);
    } catch (err: any) {
      setResidentsError(err.message || 'Erro ao carregar cadastrados');
    } finally {
      setResidentsLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) loadResidents();
  }, [unlocked]);

  async function handleDelete(resident: Resident) {
    if (!window.confirm(`Remover "${resident.name}" dos cadastrados?`)) return;

    setDeletingId(resident.id);
    try {
      await apiService.deleteResident(resident.id);
      setResidents((prev) => prev.filter((r) => r.id !== resident.id));
      setToast('Removido com sucesso');
    } catch (err: any) {
      setToast(err.message || 'Erro ao remover');
    } finally {
      setDeletingId(null);
    }
  }

  // Stop any open camera stream when leaving this page, otherwise it keeps
  // the camera device locked and other pages (StandbyPage) can't open it.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function handleUnlock() {
    if (pin === ADMIN_PIN) {
      setUnlocked(true);
      setPinError(null);
    } else {
      setPinError('PIN incorreto');
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
      setToast(`Não foi possível acessar a câmera: ${err.message || err.name || 'erro desconhecido'}`);
    }
  }

  async function captureOne() {
    if (!videoRef.current) return;
    setCapturing(true);

    try {
      const base64 = captureVideoFrameAsBase64(videoRef.current);
      const descriptor = await apiService.getFaceDescriptor(base64);
      setDescriptors((prev) => [...prev, descriptor]);
      setToast('Foto capturada!');
    } catch (err: any) {
      setToast(err.message || 'Nenhum rosto detectado, tente novamente');
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
      setToast('Nenhum rosto detectado nas fotos enviadas');
    } else if (added < files.length) {
      setToast(`${added} de ${files.length} fotos usadas (as demais não tinham rosto detectável)`);
    } else {
      setToast(`${added} foto(s) adicionada(s)`);
    }
  }

  async function handleSave() {
    if (!name) {
      setToast('Nome é obrigatório');
      return;
    }
    if (descriptors.length === 0) {
      setToast('Capture ou envie ao menos uma foto');
      return;
    }

    try {
      await apiService.createResident({ name, is_admin: isAdmin, descriptors });
      setToast('Cadastrado com sucesso!');
      setName('');
      setIsAdmin(false);
      setDescriptors([]);
      loadResidents();
    } catch (err: any) {
      setToast(err.message || 'Erro ao salvar cadastro');
    }
  }

  if (!unlocked) {
    return (
      <div className="fullscreen">
        <div className="container text-center">
          <h1 className="mb-24">Acesso Admin</h1>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            style={{ fontSize: '24px', padding: '12px', textAlign: 'center', marginBottom: '16px' }}
          />
          {pinError && <p style={{ color: '#ef4444' }}>{pinError}</p>}
          <div className="grid grid-1">
            <Button onClick={handleUnlock}>Entrar</Button>
            <Button variant="outline" onClick={() => navigate('/')}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen">
      <div className="container">
        <h1 className="mb-24">Cadastrar Pessoa</h1>
        <p style={{ color: '#64748b', marginTop: '-16px', marginBottom: '16px' }}>
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
            Afaste um pouco o celular para o rosto inteiro (testa ao queixo) aparecer no quadro,
            com boa iluminação.
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
          <Button variant="outline" onClick={() => navigate('/')}>Sair</Button>
        </div>

        <h2 className="mt-32 mb-16" style={{ fontSize: '24px' }}>Pessoas cadastradas</h2>

        {residentsLoading && <p>Carregando...</p>}
        {residentsError && <p style={{ color: '#ef4444' }}>{residentsError}</p>}
        {!residentsLoading && !residentsError && residents.length === 0 && (
          <p>Nenhuma pessoa cadastrada ainda.</p>
        )}

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

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AdminResidentsPage;
