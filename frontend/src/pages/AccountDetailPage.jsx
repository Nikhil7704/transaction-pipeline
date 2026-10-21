import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import './Dashboard.css';
import './AccountDetail.css';

function formatAmount(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

function statusClass(status) {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED') return 'badge badge-ok';
  if (s === 'FAILED') return 'badge badge-fail';
  return 'badge badge-pending';
}

export default function AccountDetailPage() {
  const { id } = useParams();
  const [account, setAccount] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [acctRes, histRes] = await Promise.all([
          api.get(`/accounts/${id}`),
          api.get('/transactions/history'),
        ]);
        setAccount(acctRes.data);
        const filtered = histRes.data.filter(
          (t) => t.source_account_id === parseInt(id) || t.destination_account_id === parseInt(id)
        );
        setTxns(filtered);
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load account.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="page-wrapper"><div className="center-spinner"><span className="spinner-lg" /></div></div>;
  if (error) return <div className="page-wrapper"><div className="error-banner">{error}</div></div>;

  return (
    <div className="page-wrapper">
      <div className="breadcrumb">
        <Link to="/accounts" className="link-muted">Accounts</Link>
        <span className="breadcrumb-sep">›</span>
        <span>#{account.id}</span>
      </div>

      <div className="acct-detail-hero">
        <div className="acct-detail-icon">{account.currency[0]}</div>
        <div>
          <h1 className="page-title">{account.currency} Wallet</h1>
          <p className="page-sub">Account ID: #{account.id}</p>
        </div>
        <Link to={`/transfer?from=${account.id}`} className="btn-primary" style={{ marginLeft: 'auto' }}>
          Transfer from this account
        </Link>
      </div>

      <div className="balance-hero">
        <span className="balance-label">Available balance</span>
        <span className="balance-amount">{formatAmount(account.balance, account.currency)}</span>
      </div>

      <div className="section-header" style={{ marginTop: '2.5rem' }}>
        <h2>Transactions</h2>
        <span className="link-muted">{txns.length} records</span>
      </div>

      {txns.length === 0 ? (
        <div className="empty-state">
          <p>No transactions for this account yet.</p>
        </div>
      ) : (
        <div className="txn-table-wrap">
          <table className="txn-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Counterparty</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const isDebit = t.source_account_id === parseInt(id);
                return (
                  <tr key={t.transaction_id} className="txn-row" onClick={() => window.location.href = `/transactions/${t.transaction_id}`}>
                    <td className="mono">#{t.transaction_id}</td>
                    <td>
                      <span className={isDebit ? 'badge badge-fail' : 'badge badge-ok'}>
                        {isDebit ? 'Debit' : 'Credit'}
                      </span>
                    </td>
                    <td className="mono">#{isDebit ? t.destination_account_id : t.source_account_id}</td>
                    <td>
                      <span style={{ color: isDebit ? '#f87171' : '#4ade80' }}>
                        {isDebit ? '−' : '+'}{formatAmount(t.amount, account.currency)}
                      </span>
                    </td>
                    <td><span className={statusClass(t.status)}>{t.status}</span></td>
                    <td className="dim">{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
