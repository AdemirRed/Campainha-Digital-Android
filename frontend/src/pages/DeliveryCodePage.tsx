import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { apiService } from '../services/apiService';
import { captureVideoFrameAsBase64 } from '../utils/imageCapture';
import { DELIVERY_COMPANIES } from '@shared/constants';
import { DeliveryCompany } from '@shared/types/delivery';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Toast from '../components/Toast';

// Not every carrier gives out a tracking code at drop-off (e.g. Correios
// or an unlisted courier just hands over the package) - only require one
// where it realistically applies.
const CODE_REQUIRED_COMPANIES = new Set(['mercadolivre', 'shopee', 'amazon']);
const LIVE_PUSH_INTERVAL_MS = 1500;

export function DeliveryCodePage() {
  const navigate = useNavigate();
  const { company } = useParams<{ company: string }>();
  const companyInfo = DELIVERY_COMPANIES.find((c) => c.value === company);
  const codeRequired = CODE_REQUIRED_COMPANIES.has(company || '');
  const isOther = company === 'other';
  const [code, setCode] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useInactivityTimer(() => {
    navigate('/');
  }, 45000); // 45 seconds for this page (more time to type)

  // Show a live preview of who's at the door and push it to /notifications
  // so the resident can peek in near-real-time while a package gets
  // registered, in addition to snapping a still photo on confirm.
  useEffect(() => {
    let cancelled = false;
    let liveInterval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);

        const label = `📦 Entrega — ${companyInfo?.label || 'porta'}`;
        liveInterval = setInterval(() => {
          if (!videoRef.current) return;
          try {
            const frame = captureVideoFrameAsBase64(videoRef.current, 0.6);
            apiService.pushLiveFrame(frame, label).catch(() => {});
          } catch {
            // frame not ready yet - skip this tick
          }
        }, LIVE_PUSH_INTERVAL_MS);
      } catch {
        // camera unavailable - delivery can still be registered without a photo
      }
    })();

    return () => {
      cancelled = true;
      if (liveInterval) clearInterval(liveInterval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      apiService.stopLive().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (codeRequired && !code.trim()) {
      setToast({ message: 'Por favor, informe o código', type: 'error' });
      return;
    }
    if (isOther && !carrierName.trim()) {
      setToast({ message: 'Por favor, informe o nome da empresa', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const photoBase64 =
        cameraReady && videoRef.current ? captureVideoFrameAsBase64(videoRef.current) : undefined;

      await apiService.createDelivery({
        company: company as DeliveryCompany,
        tracking_code: code.trim() || undefined,
        notes: isOther && carrierName.trim() ? `Empresa informada: ${carrierName.trim()}` : undefined,
        photoBase64,
      });

      setToast({ message: 'Entrega registrada com sucesso!', type: 'success' });

      // Return to standby after success
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao registrar entrega', type: 'error' });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fullscreen">
        <Loading message="Registrando entrega..." />
      </div>
    );
  }

  return (
    <div className="fullscreen">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="container">
        <div className="mb-32 text-center">
          <div className="icon mb-24">{companyInfo?.icon || '📦'}</div>
          <h2>{companyInfo?.label || 'Entrega'}</h2>
        </div>

        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: '100%',
            maxWidth: '300px',
            borderRadius: '16px',
            marginBottom: '20px',
            border: '3px solid var(--border)',
            display: cameraReady ? 'block' : 'none',
            marginLeft: 'auto',
            marginRight: 'auto',
            transform: 'scaleX(-1)',
          }}
        />

        {isOther && (
          <>
            <p className="text-center">Nome da empresa/transportadora</p>
            <input
              type="text"
              placeholder="Ex: Jadlog, Loggi, entregador avulso..."
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              autoFocus
              maxLength={60}
              style={{ marginBottom: '16px' }}
            />
          </>
        )}

        <p className="text-center">
          {codeRequired ? 'Informe o código da entrega' : 'Código de rastreio (opcional)'}
        </p>
        <input
          type="text"
          placeholder={codeRequired ? 'ML123456789' : 'Deixe em branco se não tiver'}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus={!isOther}
          maxLength={20}
        />

        <div className="grid grid-1">
          <Button
            onClick={handleSubmit}
            variant="success"
            icon="✓"
          >
            Confirmar
          </Button>

          <Button
            onClick={() => navigate('/delivery')}
            variant="outline"
          >
            ← Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DeliveryCodePage;
