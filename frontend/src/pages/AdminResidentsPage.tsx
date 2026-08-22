import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFaceRecognition } from '../hooks/useFaceRecognition';
import { apiService } from '../services/apiService';
import Button from '../components/Button';
import Toast from '../components/Toast';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';
const CAPTURES_NEEDED = 4;

export function AdminResidentsPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const { modelsReady, modelError, residentsError, captureDescriptor } = useFaceRecognition();

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
    if (!modelsReady) {
      setToast('Modelos de reconhecimento ainda não carregaram, aguarde e tente novamente');
      return;
    }
    setCapturing(true);
    const descriptor = await captureDescriptor(videoRef.current);
    setCapturing(false);

    if (!descriptor) {
      setToast('Nenhum rosto detectado, tente novamente');
      return;
    }

    setDescriptors((prev) => [...prev, descriptor]);
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    if (!modelsReady) {
      setToast('Modelos de reconhecimento ainda não carregaram, aguarde e tente novamente');
      return;
    }

    setCapturing(true);
    let added = 0;

    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Falha ao carregar imagem'));
          el.src = url;
        });

        const descriptor = await captureDescriptor(img);
        if (descriptor) {
          setDescriptors((prev) => [...prev, descriptor]);
          added++;
        }
      } catch {
        // skip files that fail to load or have no detectable face
      } finally {
        URL.revokeObjectURL(url);
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
          Moradores, visitantes frequentes, etc.
        </p>

        {modelError && (
          <p style={{ color: '#ef4444', marginBottom: '16px' }}>
            Erro ao carregar reconhecimento facial: {modelError}
          </p>
        )}
        {!modelsReady && !modelError && (
          <p style={{ color: '#f59e0b', marginBottom: '16px' }}>Carregando modelos de reconhecimento...</p>
        )}
        {residentsError && (
          <p style={{ color: '#ef4444', marginBottom: '16px' }}>
            Não foi possível conectar ao servidor ({residentsError}). Você ainda pode capturar fotos,
            mas o cadastro só será salvo quando o backend estiver acessível.
          </p>
        )}

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

        <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: '400px', marginBottom: '16px' }} />

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
            <Button onClick={captureOne} disabled={capturing || !modelsReady}>
              {capturing ? 'Analisando rosto...' : `Capturar foto (${descriptors.length}/${CAPTURES_NEEDED})`}
            </Button>
          )}
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={capturing || !modelsReady}>
            {capturing ? 'Analisando fotos...' : `Enviar fotos do dispositivo (${descriptors.length}/${CAPTURES_NEEDED})`}
          </Button>
          <Button variant="success" onClick={handleSave} disabled={descriptors.length === 0}>
            Salvar cadastro
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>Sair</Button>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AdminResidentsPage;
