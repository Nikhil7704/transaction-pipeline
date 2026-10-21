import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import './Dashboard.css';

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function statusClass(status) {
  if (!status) return '';
  const s = status.toUpperCase();
  if (s === 'COMPLETED') return 'badge badge-ok';
  if (s === 'FAILED') return 'badge badge-fail';
  return 'badge badge-pending';
}

function formatAmount(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountIds, setAccountIds] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        // We fetch history first, which tells us the account IDs
        const histRes = await api.get('/transactions/history');
        const hist = histRes.data;
        setTransactions(hist.slice(0, 8));

        // Collect unique account IDs visible to the user
        const ids = new Set();
        hist.forEach((t) => {
          ids.add(t.source_account_id);
          ids.add(t.destination_account_id);
        });
        setAccountIds([...ids]);

        // Fetch balances for each account we own (403 = not ours, skip)
        const acctResults = await Promise.allSettled(
          [...ids].map((id) => api.get(`/accounts/${id}`))
        );
        const ownedAccts = acctResults
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value.data);
        setAccounts(ownedAccts);
      } catch {
        // no transactions yet; accounts still empty
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance), 0);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">Welcome back, <strong>{user?.email}</strong></p>
        </div>
        <Link to="/transfer" className="btn-primary">New Transfer</Link>
      </div>

      {loading ? (
        <div className="center-spinner"><span className="spinner-lg" /></div>
      ) : (
        <>
          <div className="stats-row">
            <StatCard label="Total Balance" value={formatAmount(totalBalance)} sub="across all accounts" />
            <StatCard label="Accounts" value={accounts.length} sub="active accounts" />
            <StatCard label="Transactions" value={transactions.length} sub="recent activity" />
          </div>

          <div className="section-header">
            <h2>Your Accounts</h2>
            <Link to="/accounts" className="link-muted">Manage accounts →</Link>
          </div>

          {accounts.length === 0 ? (
            <div className="empty-state">
              <p>No accounts yet.</p>
              <Link to="/accounts" className="btn-secondary">Create your first account</Link>
            </div>
          ) : (
            <div className="accounts-grid">
              {accounts.map((acct) => (
                <Link to={`/accounts/${acct.id}`} key={acct.id} className="acct-card">
                  <div className="acct-card-top">
                    <span className="acct-currency">{acct.currency}</span>
                    <span className="acct-id">#{acct.id}</span>
                  </div>
                  <div className="acct-balance">{formatAmount(acct.balance)}</div>
                  <div className="acct-label">Available balance</div>
                </Link>
              ))}
            </div>
          )}

          <div className="section-header" style={{ marginTop: '2.5rem' }}>
            <h2>Recent Transactions</h2>
            <Link to="/transactions" className="link-muted">View all →</Link>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <p>No transactions yet. Make your first transfer!</p>
              <Link to="/transfer" className="btn-secondary">Transfer now</Link>
            </div>
          ) : (
            <div className="txn-table-wrap">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.transaction_id} onClick={() => window.location.href = `/transactions/${t.transaction_id}`} className="txn-row">
                      <td className="mono">#{t.transaction_id}</td>
                      <td className="mono">#{t.source_account_id}</td>
                      <td className="mono">#{t.destination_account_id}</td>
                      <td>{formatAmount(t.amount)}</td>
                      <td><span className={statusClass(t.status)}>{t.status}</span></td>
                      <td className="dim">{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
