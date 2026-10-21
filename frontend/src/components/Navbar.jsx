import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">⬡</span>
        <span className="brand-name">TransactIQ</span>
      </div>

      <nav className="navbar-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Overview
        </NavLink>
        <NavLink to="/accounts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Accounts
        </NavLink>
        <NavLink to="/transfer" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Transfer
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          History
        </NavLink>
      </nav>

      <div className="navbar-user">
        <div className="user-avatar">
          {user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="user-email">{user?.email}</span>
        <button className="logout-btn" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
