import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './Dashboard.css';

function formatAmount(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
}

function statusClass(status) {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED') return 'badge badge-ok';
  if (s === 'FAILED') return 'badge badge-fail';
  return 'badge badge-pending';
}

export default function TransactionHistoryPage() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('/transactions/history')
      .then((r) => setTxns(r.data))
      .catch(() => setTxns([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? txns : txns.filter((t) => t.status.toUpperCase() === filter);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transaction History</h1>
          <p className="page-sub">{txns.length} total transaction{txns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="filter-tabs">
          {['ALL', 'COMPLETED', 'FAILED', 'PENDING'].map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'filter-tab-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="center-spinner"><span className="spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>{txns.length === 0 ? 'No transactions yet.' : `No ${filter.toLowerCase()} transactions.`}</p>
          {txns.length === 0 && <Link to="/transfer" className="btn-secondary">Make your first transfer</Link>}
        </div>
      ) : (
        <div className="txn-table-wrap">
          <table className="txn-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>From Account</th>
                <th>To Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.transaction_id}
                  className="txn-row"
                  onClick={() => window.location.href = `/transactions/${t.transaction_id}`}
                >
                  <td className="mono">#{t.transaction_id}</td>
                  <td className="mono">#{t.source_account_id}</td>
                  <td className="mono">#{t.destination_account_id}</td>
                  <td>{formatAmount(t.amount)}</td>
                  <td><span className={statusClass(t.status)}>{t.status}</span></td>
                  <td className="dim">
                    {new Date(t.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .filter-tabs { display: flex; gap: 4px; }
        .filter-tab {
          padding: 5px 12px; border-radius: 6px; border: 1px solid #222228;
          background: transparent; color: #666; font-size: 0.75rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.3px;
        }
        .filter-tab:hover { border-color: #444; color: #ccc; }
        .filter-tab-active { background: #1a1832; border-color: #2d2960; color: #9d8fff; }
      `}</style>
    </div>
  );
}
