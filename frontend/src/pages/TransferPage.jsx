import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import './Dashboard.css';
import './Transfer.css';

function formatAmount(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

export default function TransferPage() {
  const [searchParams] = useSearchParams();
  const prefillFrom = searchParams.get('from');

  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    source_account_id: prefillFrom || '',
    destination_account_id: '',
    amount: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const hist = await api.get('/transactions/history');
        const ids = [...new Set(hist.data.flatMap((t) => [t.source_account_id, t.destination_account_id]))];
        const results = await Promise.allSettled(ids.map((id) => api.get(`/accounts/${id}`)));
        const own = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.data);
        setAccounts(own);
        if (!prefillFrom && own.length > 0) {
          setForm((f) => ({ ...f, source_account_id: String(own[0].id) }));
        }
      } catch {
        setAccounts([]);
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [prefillFrom]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);

    if (!form.source_account_id) { setError('Select a source account.'); return; }
    if (!form.destination_account_id) { setError('Enter a destination account ID.'); return; }
    if (form.source_account_id === form.destination_account_id) { setError('Source and destination cannot be the same account.'); return; }
    if (!amount || amount <= 0) { setError('Enter a valid amount greater than 0.'); return; }
    if (amount > 10000000) { setError('Amount cannot exceed ₹1,00,00,000 (1 crore).'); return; }

    setLoading(true);
    setResult(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await api.post(
        '/transactions/transfer',
        {
          source_account_id: parseInt(form.source_account_id),
          destination_account_id: parseInt(form.destination_account_id),
          amount: amount,
        },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      setResult({ ...res.data, idempotencyKey });
      setForm((f) => ({ ...f, destination_account_id: '', amount: '' }));
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Transfer failed. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find((a) => String(a.id) === String(form.source_account_id));

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transfer Funds</h1>
          <p className="page-sub">Send money between accounts securely</p>
        </div>
      </div>

      <div className="transfer-layout">
        <div className="transfer-form-col">
          <div className="transfer-card">
            {result ? (
              <div className="transfer-success">
                <div className="success-icon">✓</div>
                <h3>Transfer Successful</h3>
                <p>Your transfer has been processed.</p>
                <div className="result-details">
                  <div className="result-row">
                    <span>Transaction ID</span>
                    <span className="mono">#{result.transaction_id}</span>
                  </div>
                  <div className="result-row">
                    <span>Amount</span>
                    <span>{formatAmount(result.amount)}</span>
                  </div>
                  <div className="result-row">
                    <span>Status</span>
                    <span className="badge badge-ok">{result.status}</span>
                  </div>
                  <div className="result-row idempotency-row">
                    <span>Idempotency Key</span>
                    <span className="mono key-text">{result.idempotencyKey}</span>
                  </div>
                </div>
                <button className="btn-primary" onClick={() => setResult(null)} style={{ width: '100%', marginTop: '0.5rem' }}>
                  Make another transfer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="transfer-form">
                <div className="field-group">
                  <label>From account</label>
                  {fetching ? (
                    <div className="skeleton-select" />
                  ) : accounts.length === 0 ? (
                    <p className="no-accounts-msg">No accounts found. <a href="/accounts">Create one first.</a></p>
                  ) : (
                    <select name="source_account_id" value={form.source_account_id} onChange={handleChange} className="select-input">
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          Account #{a.id} — {a.currency} ({formatAmount(a.balance, a.currency)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="field-group">
                  <label>To account ID</label>
                  <input
                    type="number"
                    name="destination_account_id"
                    value={form.destination_account_id}
                    onChange={handleChange}
                    placeholder="e.g. 3"
                    min="1"
                  />
                  <span className="field-hint">Enter the recipient's account number</span>
                </div>

                <div className="field-group">
                  <label>Amount</label>
                  <div className="amount-input-wrap">
                    <span className="amount-prefix">{selectedAccount?.currency || 'INR'}</span>
                    <input
                      type="number"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      placeholder="0.00"
                      min="0.01"
                      max="10000000"
                      step="0.01"
                      className="amount-input"
                    />
                  </div>
                  <span className="field-hint">Max ₹1,00,00,000 per transfer</span>
                </div>

                {error && <p className="form-error">{error}</p>}

                <button type="submit" className="btn-primary transfer-btn" disabled={loading || accounts.length === 0}>
                  {loading ? <span className="spinner" /> : 'Transfer →'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="transfer-info-col">
          <div className="info-card">
            <h3>How it works</h3>
            <ol className="info-list">
              <li>Select your source account and enter the destination account ID.</li>
              <li>Specify the amount. Max transfer is ₹1 crore.</li>
              <li>Every transfer gets an auto-generated <strong>Idempotency Key</strong> — retrying the same transfer won't duplicate it.</li>
              <li>Transfers use <strong>row-level locking</strong> to prevent race conditions.</li>
              <li>Each transfer creates a <strong>double-entry ledger</strong> record (DEBIT + CREDIT).</li>
            </ol>
          </div>

          {selectedAccount && (
            <div className="balance-preview">
              <span className="balance-label">Selected account balance</span>
              <span className="balance-amount-sm">{formatAmount(selectedAccount.balance, selectedAccount.currency)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
