import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { apiService } from '../services/apiService';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Toast from '../components/Toast';

type RecordingState = 'idle' | 'recording' | 'recorded';

export function OtherReasonPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useInactivityTimer(() => {
    navigate('/');
  }, 60000); // 60s - typing/recording a message takes longer than other flows

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioPreviewUrl(URL.createObjectURL(blob));

        const reader = new FileReader();
        reader.onload = () => setAudioBase64(reader.result as string);
        reader.readAsDataURL(blob);

        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setRecordingState('recording');
    } catch (err: any) {
      setToast({ message: `Não foi possível acessar o microfone: ${err.message || err.name}`, type: 'error' });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecordingState('recorded');
  }

  function discardRecording() {
    setAudioBase64(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setRecordingState('idle');
  }

  async function handleSubmit() {
    if (!text.trim() && !audioBase64) {
      setToast({ message: 'Digite uma mensagem ou grave um áudio', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await apiService.sendMessage({
        text: text.trim() || undefined,
        audioBase64: audioBase64 || undefined,
      });
      setToast({ message: 'Mensagem enviada! Obrigado.', type: 'success' });
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setToast({ message: err.message || 'Erro ao enviar mensagem', type: 'error' });
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="fullscreen">
        <Loading message="Enviando mensagem..." />
      </div>
    );
  }

  return (
    <div className="fullscreen">
      <div className="container">
        <div className="mb-32 text-center">
          <div className="icon mb-24">💬</div>
          <h2>Deixe seu recado</h2>
          <p>Digite uma mensagem ou grave um áudio para o morador</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva sua mensagem aqui..."
          rows={4}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            borderRadius: '12px',
            border: '3px solid var(--border)',
            background: 'var(--bg-darker)',
            color: 'var(--text-light)',
            marginBottom: '20px',
            resize: 'none',
            fontFamily: 'inherit',
          }}
        />

        {recordingState === 'recorded' && audioPreviewUrl && (
          <audio controls src={audioPreviewUrl} style={{ width: '100%', marginBottom: '16px' }} />
        )}

        <div className="grid grid-1">
          {recordingState === 'idle' && (
            <Button onClick={startRecording} variant="outline" icon="🎙️">
              Gravar áudio
            </Button>
          )}
          {recordingState === 'recording' && (
            <Button onClick={stopRecording} variant="primary" icon="⏹️">
              Parar gravação
            </Button>
          )}
          {recordingState === 'recorded' && (
            <Button onClick={discardRecording} variant="outline" icon="🗑️">
              Descartar áudio e gravar de novo
            </Button>
          )}

          <Button onClick={handleSubmit} variant="success" icon="✓">
            Enviar
          </Button>

          <Button onClick={() => navigate('/home')} variant="outline">
            ← Voltar
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default OtherReasonPage;
