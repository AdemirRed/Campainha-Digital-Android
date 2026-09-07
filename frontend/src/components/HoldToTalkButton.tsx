import type { HoldState } from '../hooks/useHoldToTalk';

// The persistent press-and-hold-to-talk button for the AI assistant.
// Render it for the whole conversation when `show` is true (kiosk WebView).
export function HoldToTalkButton({
  show,
  state,
  handlers,
}: {
  show: boolean;
  state: HoldState;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
}) {
  if (!show) return null;

  return (
    <div style={{ marginTop: '20px' }}>
      <button
        {...handlers}
        disabled={state === 'processing'}
        style={{
          width: '100%',
          maxWidth: '360px',
          padding: '24px',
          fontSize: '20px',
          fontWeight: 700,
          borderRadius: '16px',
          border: 'none',
          color: 'white',
          userSelect: 'none',
          touchAction: 'none',
          background: state === 'recording' ? '#ef4444' : state === 'processing' ? '#64748b' : '#2563eb',
        }}
      >
        {state === 'recording'
          ? '🔴 Gravando... solte para enviar'
          : state === 'processing'
          ? '⏳ Entendendo...'
          : '🎤 Segure para falar'}
      </button>
    </div>
  );
}

export default HoldToTalkButton;
