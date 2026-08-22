import { useNavigate } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { BUTTON_OPTIONS } from '@shared/constants';
import Button from '../components/Button';

export function HomePage() {
  const navigate = useNavigate();
  
  // Return to standby after 30 seconds of inactivity
  useInactivityTimer(() => {
    navigate('/');
  }, 30000);

  const handleButtonClick = (value: string) => {
    switch (value) {
      case 'call':
        // TODO: Phase 3 - Implement call functionality
        alert('Funcionalidade de chamada será implementada na Fase 3');
        break;
      case 'delivery':
        navigate('/delivery');
        break;
      case 'other':
        // TODO: Implement other reason flow
        alert('Obrigado! Evento registrado.');
        setTimeout(() => navigate('/'), 2000);
        break;
    }
  };

  return (
    <div className="fullscreen">
      <div className="container">
        <div className="mb-32 text-center">
          <div className="icon mb-24">🏠</div>
          <h1>Bem-vindo</h1>
          <p>Como podemos ajudar?</p>
        </div>

        <div className="grid grid-1">
          {BUTTON_OPTIONS.map((option) => (
            <Button
              key={option.value}
              icon={option.icon}
              onClick={() => handleButtonClick(option.value)}
              variant={option.value === 'call' ? 'primary' : 'outline'}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div
          onClick={() => navigate('/admin/residents')}
          style={{ marginTop: '32px', textAlign: 'center', color: '#334155', fontSize: '14px', cursor: 'pointer' }}
        >
          ⚙️ Admin
        </div>
      </div>
    </div>
  );
}

export default HomePage;
