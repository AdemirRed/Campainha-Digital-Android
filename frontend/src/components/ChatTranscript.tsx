// Renders a saved "Assistente: ...\nVisitante: ..." transcript as chat
// bubbles (assistant left, visitor right) instead of one raw paragraph.
export function ChatTranscript({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
      {lines.map((line, i) => {
        const isAssistant = line.startsWith('Assistente:');
        const isVisitor = line.startsWith('Visitante:');
        const content = line.replace(/^Assistente:\s*|^Visitante:\s*/, '');

        if (!isAssistant && !isVisitor) {
          return (
            <div key={i} style={{ fontSize: '14px', color: 'var(--text-gray)' }}>
              {line}
            </div>
          );
        }

        return (
          <div key={i} style={{ display: 'flex', justifyContent: isVisitor ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: '14px',
                borderBottomLeftRadius: isAssistant ? '4px' : '14px',
                borderBottomRightRadius: isVisitor ? '4px' : '14px',
                fontSize: '14px',
                lineHeight: 1.45,
                background: isVisitor ? 'var(--primary)' : 'var(--bg-darker)',
                color: isVisitor ? 'white' : 'var(--text-light)',
                border: isVisitor ? 'none' : '1px solid var(--border)',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '10.5px', opacity: 0.7, marginBottom: '2px', fontWeight: 700 }}>
                {isAssistant ? '🤖 ASSISTENTE' : '🧑 VISITANTE'}
              </div>
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ChatTranscript;
