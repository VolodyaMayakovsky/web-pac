// src/components/Header.jsx
import { Link } from 'react-router-dom';

const Header = ({ user, onLogout }) => {
  return (
    <header className="header">
      <Link to="/" className="logo">EduPlan</Link>
      <nav className="nav">
        {user && <Link to="/schedule">Расписание</Link>}
        {user && <Link to="/profile">Профиль</Link>}
      </nav>
      <div>
        {user ? (
          <>
            <span style={{ marginRight: '16px' }}>{user.first_name || user.email}</span>
            <button className="btn-outline" onClick={onLogout}>Выйти</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-outline" style={{ marginRight: '8px' }}>Войти</Link>
            <Link to="/register" className="btn-primary">Регистрация</Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;