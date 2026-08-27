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
        // Rings the resident's real devices first (RealCallPage); if
        // nobody answers, that page offers to fall back to the AI
        // assistant conversation instead of leaving the visitor stuck.
        navigate('/call/real');
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
          {BUTTON_OPTIONS.map((option) => (
            <Button
              key={option.value}
              icon={option.icon}
              onClick={() => handleButtonClick(option.value)}
              variant={option.value === 'call' ? 'primary' : 'outline'}
            >
              {option.label}
              {option.value === 'call' && residentsOnline !== null && (
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 400, marginTop: '2px' }}>
                  {residentsOnline > 0
                    ? `🟢 ${residentsOnline} dispositivo(s) com a tela aberta agora`
                    : '📳 toca em todo dispositivo cadastrado, mesmo fechado'}
                </span>
              )}
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
