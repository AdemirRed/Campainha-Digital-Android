import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { apiService } from '../services/apiService';
import Tutorial, { useTutorial } from '../components/Tutorial';
import '../styles/home.css';

const actions = [
  { route: '/call', title: 'Falar com o assistente', description: 'Conte o motivo da visita por voz.' },
  { route: '/delivery', title: 'Fazer uma entrega', description: 'Informe a empresa e confirme a entrega.' },
  { route: '/other', title: 'Deixar um recado', description: 'Escreva ou grave uma mensagem.' },
] as const;

function Arrow() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

export function HomePage() {
  const navigate = useNavigate();
  const { show: showTutorial, dismiss: dismissTutorial } = useTutorial();
  const [residentsOnline, setResidentsOnline] = useState<number | null>(null);
  const [connection, setConnection] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    const refresh = () => {
      apiService.getCallPresence()
        .then((result) => { if (active) { setResidentsOnline(result.residentsOnline); setConnection('ready'); } })
        .catch(() => { if (active) { setResidentsOnline(null); setConnection('error'); } });
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useInactivityTimer(() => navigate('/'), 30000);

  return (
    <main className="doorbell-home">
      <div className="doorbell-home__shell">
        <header className="doorbell-home__header">
          <div className="doorbell-home__brand"><span className="doorbell-home__brand-mark" aria-hidden="true">C</span><span>Campainha</span></div>
          <span className={`doorbell-home__availability doorbell-home__availability--${connection}`} role="status"><span aria-hidden="true" />{connection === 'ready' ? 'Pronta para atender' : connection === 'error' ? 'Sem conexão' : 'Conectando'}</span>
        </header>

        <section className="doorbell-home__content" aria-labelledby="doorbell-title">
          <div className="doorbell-home__intro">
            <h1 id="doorbell-title">Olá, seja bem-vindo.</h1>
            <p>Escolha como prefere falar com o morador.</p>
          </div>

          <button className="doorbell-home__primary" onClick={() => navigate('/call/real')}>
            <span className="doorbell-home__primary-copy"><strong>Chamar o morador</strong><small>{residentsOnline && residentsOnline > 0 ? `${residentsOnline} dispositivo${residentsOnline > 1 ? 's' : ''} conectado${residentsOnline > 1 ? 's' : ''} agora` : 'Iniciar uma chamada'}</small></span>
            <Arrow />
          </button>

          <div className="doorbell-home__divider"><span>Ou escolha outra opção</span></div>

          <div className="doorbell-home__actions">
            {actions.map((action) => (
              <button key={action.route} className="doorbell-home__action" onClick={() => navigate(action.route)}>
                <span className="doorbell-home__action-copy"><strong>{action.title}</strong><small>{action.description}</small></span>
                <Arrow />
              </button>
            ))}
          </div>
        </section>

        <footer className="doorbell-home__footer">
          <span>Se ninguém atender, você poderá deixar um recado.</span>
          <button onClick={() => navigate('/admin/residents')} aria-label="Abrir área do morador">Área do morador</button>
        </footer>
      </div>
      {showTutorial && <Tutorial onDismiss={dismissTutorial} />}
    </main>
  );
}

export default HomePage;
