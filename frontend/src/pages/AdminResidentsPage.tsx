import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Toast from '../components/Toast';
import AdminResidentsTab from './admin/AdminResidentsTab';
import AdminMessagesTab from './admin/AdminMessagesTab';
import AdminVisitorsTab from './admin/AdminVisitorsTab';
import AdminDeliveriesTab from './admin/AdminDeliveriesTab';
import AdminRecordingsTab from './admin/AdminRecordingsTab';
import AdminSettingsTab from './admin/AdminSettingsTab';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';

type Tab = 'residents' | 'messages' | 'visitors' | 'deliveries' | 'recordings' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'residents', label: '👤 Moradores' },
  { key: 'messages', label: '💬 Mensagens' },
  { key: 'visitors', label: '🕵️ Visitantes' },
  { key: 'deliveries', label: '📦 Entregas' },
  { key: 'recordings', label: '📹 Gravações 24h' },
  { key: 'settings', label: '⚙️ Configurações' },
];

export function AdminResidentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const recognizedAdmin = Boolean((location.state as any)?.recognizedAdmin);

  const [unlocked, setUnlocked] = useState(recognizedAdmin);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('residents');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
  }

  function handleUnlock() {
    if (pin === ADMIN_PIN) {
      setUnlocked(true);
      setPinError(null);
    } else {
      setPinError('PIN incorreto');
    }
  }

  if (!unlocked) {
    return (
      <div className="fullscreen">
        <div className="container text-center">
          <h1 className="mb-24">Acesso Admin</h1>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            style={{ fontSize: '24px', padding: '12px', textAlign: 'center', marginBottom: '16px' }}
          />
          {pinError && <p style={{ color: '#ef4444' }}>{pinError}</p>}
          <div className="grid grid-1">
            <Button onClick={handleUnlock}>Entrar</Button>
            <Button variant="outline" onClick={() => navigate('/')}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen" style={{ alignItems: 'stretch', padding: 0 }}>
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '8px',
          padding: '16px',
          borderBottom: '2px solid var(--border)',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              borderRadius: '999px',
              border: tab === t.key ? '2px solid var(--primary)' : '2px solid var(--border)',
              background: tab === t.key ? 'var(--primary)' : 'transparent',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => navigate('/')}
          style={{
            flexShrink: 0,
            padding: '10px 16px',
            borderRadius: '999px',
            border: '2px solid var(--error)',
            background: 'transparent',
            color: 'var(--error)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          🚪 Sair
        </button>
      </div>

      <div className="container" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {tab === 'residents' && <AdminResidentsTab showToast={showToast} />}
        {tab === 'messages' && <AdminMessagesTab showToast={showToast} />}
        {tab === 'visitors' && <AdminVisitorsTab showToast={showToast} />}
        {tab === 'deliveries' && <AdminDeliveriesTab showToast={showToast} />}
        {tab === 'recordings' && <AdminRecordingsTab showToast={showToast} />}
        {tab === 'settings' && <AdminSettingsTab showToast={showToast} />}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AdminResidentsPage;
