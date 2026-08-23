import { useNavigate } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { DELIVERY_COMPANIES } from '@shared/constants';
import Button from '../components/Button';

export function DeliveryPage() {
  const navigate = useNavigate();
  
  useInactivityTimer(() => {
    navigate('/');
  }, 30000);

  const handleCompanySelect = (company: string) => {
    navigate(`/delivery/${company}`);
  };

  return (
    <div className="fullscreen">
      <div className="container">
        <div className="mb-32 text-center">
          <h2>Entrega</h2>
          <p>Qual empresa?</p>
        </div>

        <div className="grid grid-2">
          {DELIVERY_COMPANIES.map((company) => (
            <Button
              key={company.value}
              icon={company.icon}
              onClick={() => handleCompanySelect(company.value)}
              variant="outline"
            >
              {company.label}
            </Button>
          ))}
        </div>

        <div className="mt-32">
          <Button
            onClick={() => navigate('/home')}
            variant="outline"
          >
            ← Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DeliveryPage;
