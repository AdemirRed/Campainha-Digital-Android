import { useRef, useState } from 'react';
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
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const { modelsReady, captureDescriptor } = useFaceRecognition();

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStarted(true);
    } catch {
      setToast('Não foi possível acessar a câmera');
    }
  }

  async function captureOne() {
    if (!videoRef.current || !modelsReady) return;
    setCapturing(true);
    const descriptor = await captureDescriptor(videoRef.current);
    setCapturing(false);

    if (!descriptor) {
      setToast('Nenhum rosto detectado, tente novamente');
      return;
    }

    setDescriptors((prev) => [...prev, descriptor]);
  }

  async function handleSave() {
    if (!name) {
      setToast('Nome é obrigatório');
      return;
    }
    if (descriptors.length === 0) {
      setToast('Capture ao menos uma foto');
      return;
    }

    try {
      await apiService.createResident({ name, is_admin: isAdmin, descriptors });
      setToast('Morador cadastrado com sucesso!');
      setName('');
      setIsAdmin(false);
      setDescriptors([]);
    } catch (err: any) {
      setToast(err.message || 'Erro ao salvar morador');
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
        <h1 className="mb-24">Cadastrar Morador</h1>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do morador"
          style={{ fontSize: '20px', padding: '12px', width: '100%', marginBottom: '16px' }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          Este morador tem acesso ao painel admin
        </label>

        <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: '400px', marginBottom: '16px' }} />

        <div className="grid grid-1">
          {!cameraStarted && <Button onClick={startCamera}>Ligar câmera</Button>}
          {cameraStarted && (
            <Button onClick={captureOne} disabled={capturing || !modelsReady}>
              Capturar foto ({descriptors.length}/{CAPTURES_NEEDED})
            </Button>
          )}
          <Button variant="success" onClick={handleSave} disabled={descriptors.length === 0}>
            Salvar morador
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>Sair</Button>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AdminResidentsPage;
