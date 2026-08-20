import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

const QUICK_ACCOUNTS = [
  { username: 'host', password: 'host123', role: 'host', displayName: 'Host Superuser' },
  { username: 'cellcare', password: 'cellcare123', role: 'admin', displayName: 'Cellcare' },
  { username: 'gaminggrounds', password: 'gaminggrounds123', role: 'admin', displayName: 'Gaming Grounds' },
  { username: 'store', password: 'store123', role: 'store', displayName: 'Cellcare Store' },
  { username: 'store2', password: 'store2123', role: 'store', displayName: 'Gaming Grounds Store' },
  { username: 'store3', password: 'store3123', role: 'store', displayName: 'Gamens and Gadgets Store' },
  { username: 'cc-cindy', password: 'cc-cindy', role: 'staff', displayName: 'Cindy' },
  { username: 'gg-jc', password: 'gg-jc', role: 'staff', displayName: 'JC' }
];

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const doLogin = async (u, p) => {
    setError('');
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { username: u, password: p });
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    doLogin(username, password);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">AH</div>
          <div>
            <div className="login-brand-name">AccessoryHub</div>
            <div className="login-brand-sub">Inventory &amp; Sales System</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="host / cellcare / store ..."
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="login-quick">
          <div className="login-quick-title">Quick Login Accounts</div>
          <div className="login-quick-list">
            {QUICK_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                className="login-quick-btn"
                onClick={() => {
                  setUsername(acc.username);
                  setPassword(acc.password);
                }}
              >
                <b>{acc.username}</b> / {acc.password}{' '}
                <span className="quick-meta">• {acc.role} • {acc.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
