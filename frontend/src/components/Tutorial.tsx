import { useState } from 'react';

const STORAGE_KEY = 'campainha_tutorial_seen';

export function useTutorial() {
  const [show, setShow] = useState(() => !localStorage.getItem(STORAGE_KEY));

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  return { show, dismiss };
}

export function Tutorial({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.92)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div className="container text-center" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="icon mb-24">👋</div>
        <h1 className="mb-24">Como funciona</h1>

        <div style={{ textAlign: 'left', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
          <p style={{ textAlign: 'left' }}>
            <strong>🔔 Chamar morador</strong> — avisa o morador (recurso completo em breve).
          </p>
          <p style={{ textAlign: 'left' }}>
            <strong>📦 Entrega</strong> — escolha a transportadora e informe o código, se tiver.
          </p>
          <p style={{ textAlign: 'left' }}>
            <strong>💬 Outro motivo</strong> — digite ou grave um áudio com seu recado.
          </p>
          <p style={{ textAlign: 'left' }}>
            <strong>👁️ Reconhecimento facial</strong> — a tela de espera reconhece moradores
            cadastrados automaticamente. Quem não for reconhecido tem a visita gravada e listada
            no painel admin.
          </p>
          <p style={{ textAlign: 'left' }}>
            <strong>⚙️ Admin</strong> — cadastra moradores, vê mensagens recebidas e visitantes não
            reconhecidos.
          </p>
          <p style={{ textAlign: 'left' }}>
            <strong>🔔 Notificações</strong> — abra <code>/notifications</code> num segundo
            aparelho pra ouvir um aviso toda vez que alguém tocar a campainha.
          </p>
        </div>

        <button onClick={onDismiss} className="btn btn-primary">
          Entendi
        </button>
      </div>
    </div>
  );
}

export default Tutorial;
