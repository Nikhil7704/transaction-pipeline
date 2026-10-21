import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import './Dashboard.css';
import './AccountDetail.css';

function formatAmount(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
}

function statusClass(status) {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED') return 'badge badge-ok';
  if (s === 'FAILED') return 'badge badge-fail';
  return 'badge badge-pending';
}

function DetailRow({ label, value, mono }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 16px', borderBottom: '1px solid #141418'
    }}>
      <span style={{ fontSize: '0.82rem', color: '#555' }}>{label}</span>
      <span style={{ fontSize: '0.88rem', color: '#ccc', fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>
        {value}
      </span>
    </div>
  );
}

export default function TransactionDetailPage() {
  const { id } = useParams();
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/transactions/${id}`)
      .then((r) => setTxn(r.data))
      .catch((err) => setError(err.response?.data?.detail || 'Transaction not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-wrapper"><div className="center-spinner"><span className="spinner-lg" /></div></div>;
  if (error) return (
    <div className="page-wrapper">
      <div className="error-banner">{error}</div>
      <Link to="/transactions" className="link-muted" style={{ display: 'inline-block', marginTop: '1rem' }}>← Back to history</Link>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="breadcrumb">
        <Link to="/transactions" className="link-muted">Transactions</Link>
        <span className="breadcrumb-sep">›</span>
        <span>#{txn.transaction_id}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Transaction #{txn.transaction_id}</h1>
          <p className="page-sub">Full transfer details</p>
        </div>
        <span className={statusClass(txn.status)} style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
          {txn.status}
        </span>
      </div>

      <div style={{ maxWidth: '560px' }}>
        <div style={{
          background: '#0f0f12', border: '1px solid #1a1a1e',
          borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem'
        }}>
          <DetailRow label="Transaction ID" value={`#${txn.transaction_id}`} mono />
          <DetailRow label="Amount" value={formatAmount(txn.amount)} />
          <DetailRow label="Status" value={<span className={statusClass(txn.status)}>{txn.status}</span>} />
          <DetailRow label="From Account" value={`#${txn.source_account_id}`} mono />
          <DetailRow label="To Account" value={`#${txn.destination_account_id}`} mono />
          <DetailRow
            label="Timestamp"
            value={new Date(txn.created_at).toLocaleString('en-IN', {
              weekday: 'short', day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to={`/accounts/${txn.source_account_id}`} className="btn-secondary">
            View source account →
          </Link>
          <Link to={`/accounts/${txn.destination_account_id}`} className="btn-secondary">
            View destination account →
          </Link>
        </div>
      </div>
    </div>
  );
}
