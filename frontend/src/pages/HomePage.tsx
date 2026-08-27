import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { apiService } from '../services/apiService';
import { BUTTON_OPTIONS } from '@shared/constants';
import Button from '../components/Button';
import Tutorial, { useTutorial } from '../components/Tutorial';

export function HomePage() {
  const navigate = useNavigate();
  const { show: showTutorial, dismiss: dismissTutorial } = useTutorial();
  const [residentsOnline, setResidentsOnline] = useState<number | null>(null);

  useEffect(() => {
    apiService
      .getCallPresence()
      .then((r) => setResidentsOnline(r.residentsOnline))
      .catch(() => setResidentsOnline(null));
  }, []);

  // Return to standby after 30 seconds of inactivity
  useInactivityTimer(() => {
    navigate('/');
  }, 30000);

  const handleButtonClick = (value: string) => {
    switch (value) {
      case 'call':
        navigate('/call');
        break;
      case 'delivery':
        navigate('/delivery');
        break;
      case 'other':
        navigate('/other');
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
          <Button
            icon="📞"
            variant="primary"
            onClick={() => navigate('/call/real')}
          >
            LIGAR PARA O MORADOR
            {residentsOnline !== null && (
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 400, marginTop: '2px' }}>
                {residentsOnline > 0
                  ? `🟢 ${residentsOnline} dispositivo(s) online agora`
                  : '⚪ nenhum dispositivo online agora (ainda toca, se notificações estiverem ativadas)'}
              </span>
            )}
          </Button>

          {BUTTON_OPTIONS.map((option) => (
            <Button
              key={option.value}
              icon={option.icon}
              onClick={() => handleButtonClick(option.value)}
              variant="outline"
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

      {showTutorial && <Tutorial onDismiss={dismissTutorial} />}
    </div>
  );
}

export default HomePage;
