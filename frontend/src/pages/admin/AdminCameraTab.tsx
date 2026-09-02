import { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import { useLiveViewer } from '../../hooks/useLiveViewer';
import type { Doorbell } from '@shared/types/doorbell';

export function AdminCameraTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [doorbells, setDoorbells] = useState<Doorbell[]>([]);
  const [selected, setSelected] = useState<number>(1);
  const { state, start, stop, videoRef, errorMsg } = useLiveViewer(selected);

  useEffect(() => {
    apiService.getDoorbells().then((list) => {
      setDoorbells(list);
      if (list[0]) setSelected(list[0].id);
    }).catch((e) => showToast(e.message || 'Erro ao carregar campainhas', 'error'));
  }, []);

  useEffect(() => () => stop(), [selected]); // troca de campainha encerra a atual

  const label: Record<string, string> = {
    idle: 'Parado', requesting: 'Chamando a campainha...', busy: 'Campainha ocupada em uma chamada',
    connecting: 'Conectando...', live: 'Ao vivo', error: errorMsg || 'Erro',
  };

  return (
    <div>
      <h2 className="admin-section-title">Câmera ao vivo</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={selected} onChange={(e) => setSelected(Number(e.target.value))} style={{ padding: 8, fontSize: 15 }}>
          {doorbells.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {state === 'idle' || state === 'error' || state === 'busy'
          ? <button className="admin-btn" onClick={start}>▶ Ver ao vivo</button>
          : <button className="admin-btn admin-btn-danger" onClick={stop}>■ Parar</button>}
        <span style={{ fontSize: 14, color: '#64748b' }}>{label[state]}</span>
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 640, borderRadius: 12, background: '#000', display: state === 'live' || state === 'connecting' ? 'block' : 'none' }}
      />
      {state === 'error' && <p style={{ color: 'var(--error)' }}>{errorMsg}</p>}
    </div>
  );
}

export default AdminCameraTab;
