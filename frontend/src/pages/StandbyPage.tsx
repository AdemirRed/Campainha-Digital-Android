import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function StandbyPage() {
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Simulate person detection after 3 seconds
    const timer = setTimeout(() => {
      setShowWelcome(true);
      // Auto-navigate to home after showing welcome
      setTimeout(() => {
        navigate('/home');
      }, 2000);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fullscreen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      {!showWelcome ? (
        <div className="loading">
          <div className="icon">👁️</div>
          <p style={{ fontSize: '24px', color: '#64748b' }}>Sistema em espera...</p>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div className="icon mb-24">👋</div>
          <h1>Bem-vindo!</h1>
          <p>Ativando interface...</p>
        </div>
      )}
    </div>
  );
}

export default StandbyPage;
