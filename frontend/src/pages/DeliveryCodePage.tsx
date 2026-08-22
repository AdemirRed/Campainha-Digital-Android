import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { apiService } from '../services/apiService';
import { DeliveryCompany } from '@shared/types/delivery';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Toast from '../components/Toast';

export function DeliveryCodePage() {
  const navigate = useNavigate();
  const { company } = useParams<{ company: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useInactivityTimer(() => {
    navigate('/');
  }, 45000); // 45 seconds for this page (more time to type)

  const handleSubmit = async () => {
    if (!code.trim()) {
      setToast({ message: 'Por favor, informe o código', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      await apiService.createDelivery({
        company: company as DeliveryCompany,
        tracking_code: code
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
          <div className="icon mb-24">📦</div>
          <h2>Mercado Livre</h2>
          <p>Informe o código da entrega</p>
        </div>

        <input
          type="text"
          placeholder="ML123456789"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus
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
