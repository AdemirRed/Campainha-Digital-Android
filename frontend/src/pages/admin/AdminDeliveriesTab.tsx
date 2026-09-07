import { useEffect, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';
import { Delivery } from '@shared/types/delivery';
import { DeliveryCode } from '@shared/types/deliveryCode';
import { DELIVERY_COMPANIES } from '@shared/constants';

function companyLabel(company: string): string {
  const known = DELIVERY_COMPANIES.find((c) => c.value === company);
  return known ? `${known.icon} ${known.label}` : `📦 ${company}`;
}

export function AdminDeliveriesTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [codes, setCodes] = useState<DeliveryCode[]>([]);
  const [newCompany, setNewCompany] = useState('mercadolivre');
  const [newOtherCompany, setNewOtherCompany] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { items } = await apiService.getDeliveries(1, 50);
      setDeliveries(items);
    } catch {
      // non-critical - other tabs still work
    } finally {
      setLoading(false);
    }
    apiService.getDeliveryCodes().then(setCodes).catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function persistCodes(next: DeliveryCode[]) {
    setCodes(next);
    setSavingCode(true);
    try {
      await apiService.setDeliveryCodes(next);
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar código', 'error');
    } finally {
      setSavingCode(false);
    }
  }

  async function handleAddCode() {
    const company = newCompany === 'other' ? newOtherCompany.trim() : newCompany;
    const code = newCode.trim();
    if (!company || !code) {
      showToast('Informe a empresa e o código', 'error');
      return;
    }
    const entry: DeliveryCode = {
      id: (crypto.randomUUID?.() || String(Date.now())),
      company,
      code,
      note: newNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await persistCodes([entry, ...codes]);
    setNewCode('');
    setNewNote('');
    setNewOtherCompany('');
    showToast('Código cadastrado');
  }

  async function handleRemoveCode(id: string) {
    await persistCodes(codes.filter((c) => c.id !== id));
    showToast('Código removido');
  }

  async function handleDelete(delivery: Delivery) {
    if (!window.confirm('Remover este registro de entrega?')) return;
    setDeletingId(delivery.id);
    try {
      await apiService.deleteDelivery(delivery.id);
      setDeliveries((prev) => prev.filter((d) => d.id !== delivery.id));
      showToast('Entrega removida');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h2 className="admin-section-title">Códigos de recebimento</h2>
      <p style={{ color: '#64748b', marginTop: '-8px', marginBottom: '14px', fontSize: '14px' }}>
        Cadastre aqui o código que o entregador vai pedir (iFood, Mercado Livre, etc). Quando alguém
        chegar dizendo que é dessa empresa, o assistente informa o código.
      </p>

      <div className="admin-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', flex: '1 1 150px' }}>
            Empresa
            <select
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              style={{ padding: '10px', fontSize: '15px', marginTop: '4px' }}
            >
              {DELIVERY_COMPANIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </label>
          {newCompany === 'other' && (
            <input
              placeholder="Nome da empresa"
              value={newOtherCompany}
              onChange={(e) => setNewOtherCompany(e.target.value)}
              style={{ padding: '10px', fontSize: '15px', flex: '1 1 140px' }}
            />
          )}
          <input
            placeholder="Código"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            style={{ padding: '10px', fontSize: '15px', flex: '1 1 110px' }}
          />
          <input
            placeholder="Observação (opcional)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            style={{ padding: '10px', fontSize: '15px', flex: '2 1 160px' }}
          />
          <button className="admin-btn" onClick={handleAddCode} disabled={savingCode}>
            Cadastrar
          </button>
        </div>
      </div>

      {codes.length === 0 ? (
        <div className="admin-empty" style={{ marginBottom: '32px' }}>Nenhum código cadastrado.</div>
      ) : (
        <div style={{ marginBottom: '32px' }}>
          {codes.map((c) => (
            <div
              key={c.id}
              className="admin-card"
              style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{companyLabel(c.company)}</div>
                <div style={{ fontSize: '20px', letterSpacing: '2px' }}>{c.code}</div>
                {c.note && <div style={{ fontSize: '13px', color: '#94a3b8' }}>{c.note}</div>}
              </div>
              <button className="admin-btn admin-btn-danger" onClick={() => handleRemoveCode(c.id)}>
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="admin-section-title">Entregas registradas</h2>

      {loading && <p>Carregando...</p>}
      {!loading && deliveries.length === 0 && <div className="admin-empty">Nenhuma entrega ainda.</div>}

      <div className="admin-video-grid">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="admin-card">
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
              {new Date(delivery.created_at).toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
              {companyLabel(delivery.company)}
            </div>
            {delivery.tracking_code && (
              <div style={{ fontSize: '15px', marginBottom: '4px' }}>Código: {delivery.tracking_code}</div>
            )}
            {delivery.notes && (
              <div style={{ fontSize: '15px', color: '#94a3b8', marginBottom: '4px' }}>{delivery.notes}</div>
            )}
            {delivery.photo_path && (
              <img
                src={`${STORAGE_BASE_URL}/storage/photos/${delivery.photo_path}`}
                alt="Foto da entrega"
                style={{ marginTop: '8px' }}
              />
            )}
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => handleDelete(delivery)}
              disabled={deletingId === delivery.id}
              style={{ marginTop: '8px' }}
            >
              {deletingId === delivery.id ? '...' : '🗑️ Remover'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminDeliveriesTab;
