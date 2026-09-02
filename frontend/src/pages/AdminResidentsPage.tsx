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
import AdminDoorbellsTab from './admin/AdminDoorbellsTab';
import '../styles/admin.css';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';

type Tab = 'residents' | 'messages' | 'visitors' | 'deliveries' | 'doorbells' | 'recordings' | 'settings';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'residents', icon: '👤', label: 'Moradores' },
  { key: 'messages', icon: '💬', label: 'Mensagens' },
  { key: 'visitors', icon: '🕵️', label: 'Visitantes' },
  { key: 'doorbells', icon: '📟', label: 'Campainhas' },
  { key: 'deliveries', icon: '📦', label: 'Entregas' },
  { key: 'recordings', icon: '📹', label: 'Gravações' },
  { key: 'settings', icon: '⚙️', label: 'Config.' },
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

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="admin-shell">
      <nav className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon">🔔</span>
          <span className="admin-brand-text">Campainha Digital</span>
        </div>

        <div className="admin-nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-nav-item${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="admin-nav-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
          <button className="admin-nav-item danger" onClick={() => navigate('/')}>
            <span className="admin-nav-icon">🚪</span>
            <span>Sair</span>
          </button>
        </div>

        <div className="admin-nav-footer">
          <div style={{ fontSize: '12px', color: 'var(--text-gray)' }}>Painel do administrador</div>
        </div>
      </nav>

      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-title">
            <span>{activeTab.icon}</span>
            <span>{activeTab.label}</span>
          </div>
        </div>

        <div className="admin-content">
          <div className="admin-content-inner">
            {tab === 'residents' && <AdminResidentsTab showToast={showToast} />}
            {tab === 'messages' && <AdminMessagesTab showToast={showToast} />}
            {tab === 'visitors' && <AdminVisitorsTab showToast={showToast} />}
            {tab === 'doorbells' && <AdminDoorbellsTab showToast={showToast} />}
            {tab === 'deliveries' && <AdminDeliveriesTab showToast={showToast} />}
            {tab === 'recordings' && <AdminRecordingsTab showToast={showToast} />}
            {tab === 'settings' && <AdminSettingsTab showToast={showToast} />}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AdminResidentsPage;
