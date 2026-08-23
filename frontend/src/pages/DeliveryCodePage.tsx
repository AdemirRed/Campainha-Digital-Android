import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { apiService } from '../services/apiService';
import { DELIVERY_COMPANIES } from '@shared/constants';
import { DeliveryCompany } from '@shared/types/delivery';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Toast from '../components/Toast';

// Not every carrier gives out a tracking code at drop-off (e.g. Correios
// or an unlisted courier just hands over the package) - only require one
// where it realistically applies.
const CODE_REQUIRED_COMPANIES = new Set(['mercadolivre', 'shopee', 'amazon']);

export function DeliveryCodePage() {
  const navigate = useNavigate();
  const { company } = useParams<{ company: string }>();
  const companyInfo = DELIVERY_COMPANIES.find((c) => c.value === company);
  const codeRequired = CODE_REQUIRED_COMPANIES.has(company || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useInactivityTimer(() => {
    navigate('/');
  }, 45000); // 45 seconds for this page (more time to type)

  const handleSubmit = async () => {
    if (codeRequired && !code.trim()) {
      setToast({ message: 'Por favor, informe o código', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      await apiService.createDelivery({
        company: company as DeliveryCompany,
        tracking_code: code.trim() || undefined
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
          <p>
            {codeRequired
              ? 'Informe o código da entrega'
              : 'Código de rastreio (opcional)'}
          </p>
        </div>

        <input
          type="text"
          placeholder={codeRequired ? 'ML123456789' : 'Deixe em branco se não tiver'}
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
