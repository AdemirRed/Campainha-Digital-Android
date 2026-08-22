interface LoadingProps {
  message?: string;
}

export function Loading({ message = 'Carregando...' }: LoadingProps) {
  return (
    <div className="loading">
      <div className="spinner"></div>
      <p style={{ fontSize: '24px' }}>{message}</p>
    </div>
  );
}

export default Loading;
