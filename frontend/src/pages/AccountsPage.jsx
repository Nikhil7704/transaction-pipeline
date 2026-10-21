import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './Dashboard.css';
import './Accounts.css';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

function formatAmount(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/accounts');
        setAccounts(res.data || []);
      } catch (err) {
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await api.post('/accounts', { currency });
      setAccounts((prev) => [...prev, res.data]);
      setShowForm(false);
      setCurrency('INR');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create account.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-sub">Manage your wallets and balances</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Account'}
        </button>
      </div>

      {showForm && (
        <div className="create-form-card">
          <h3>Create a new account</h3>
          <form onSubmit={handleCreate} className="create-form">
            <div className="field-group">
              <label>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="select-input">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? <span className="spinner" /> : 'Create account'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="center-spinner"><span className="spinner-lg" /></div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <p>You have no accounts yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="acct-list">
          {accounts.map((acct) => (
            <Link to={`/accounts/${acct.id}`} key={acct.id} className="acct-list-item">
              <div className="acct-list-left">
                <div className="acct-icon">{acct.currency[0]}</div>
                <div>
                  <div className="acct-list-name">{acct.currency} Wallet</div>
                  <div className="acct-list-id">Account #{acct.id}</div>
                </div>
              </div>
              <div className="acct-list-right">
                <div className="acct-list-balance">{formatAmount(acct.balance, acct.currency)}</div>
                <div className="acct-list-label">balance</div>
              </div>
              <span className="acct-arrow">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
