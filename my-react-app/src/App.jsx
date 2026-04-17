// App.jsx
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; // используем уже предоставленный роутер из main
import Header from './components/Header';
import Auth from './pages/Auth';
import SchedulePage from './pages/SchedulePage';
import Profile from './pages/Profile';
import './App.css';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleRegister = async (formData) => {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error('Ошибка регистрации');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const handleLogin = async (email, password) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Неверный email или пароль');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const handleUpdateUser = async (updatedData) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updatedData),
    });
    if (!res.ok) throw new Error('Ошибка обновления');
    const updatedUser = await res.json();
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/login" element={<Auth onLogin={handleLogin} mode="login" />} />
        <Route path="/register" element={<Auth onRegister={handleRegister} mode="register" />} />
        <Route path="/profile" element={user ? <Profile user={user} onUpdate={handleUpdateUser} /> : <Navigate to="/login" />} />
        <Route path="/schedule" element={user ? <SchedulePage user={user} /> : <Navigate to="/login" />} />
        <Route path="/" element={<HomePage user={user} />} />
      </Routes>
    </>
  );
}

function HomePage({ user }) {
  return (
    <div className="hero-section">
      <h1>EduPlan</h1>
      {user ? <p>Добро пожаловать, {user.first_name || user.email}</p> : <p>Войдите, чтобы продолжить</p>}
    </div>
  );
}

export default App;