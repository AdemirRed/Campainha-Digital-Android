import { useEffect, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';
import { Delivery } from '@shared/types/delivery';
import { DELIVERY_COMPANIES } from '@shared/constants';

function companyLabel(company: string): string {
  const known = DELIVERY_COMPANIES.find((c) => c.value === company);
  return known ? `${known.icon} ${known.label}` : `📦 ${company}`;
}

export function AdminDeliveriesTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
  }

  useEffect(() => {
    load();
  }, []);

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
