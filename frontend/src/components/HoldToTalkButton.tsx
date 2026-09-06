import type { HoldState } from '../hooks/useHoldToTalk';

// The press-and-hold-to-talk button for the AI assistant. Renders nothing
// when `listening` is null (not the visitor's turn to speak).
export function HoldToTalkButton({
  listening,
  handlers,
}: {
  listening: HoldState;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
}) {
  if (listening === null) return null;

  return (
    <button
      {...handlers}
      disabled={listening === 'processing'}
      style={{
        marginTop: '16px',
        width: '100%',
        maxWidth: '360px',
        padding: '22px',
        fontSize: '20px',
        fontWeight: 700,
        borderRadius: '16px',
        border: 'none',
        color: 'white',
        userSelect: 'none',
        touchAction: 'none',
        background:
          listening === 'recording' ? '#ef4444' : listening === 'processing' ? '#64748b' : '#2563eb',
      }}
    >
      {listening === 'recording'
        ? '🔴 Gravando... solte para enviar'
        : listening === 'processing'
        ? '⏳ Entendendo...'
        : '🎤 Segure para falar'}
    </button>
  );
}

export default HoldToTalkButton;
