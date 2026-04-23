// src/pages/Auth.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Auth = ({ mode }) => {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (!result.success) throw new Error(result.error);
        navigate('/');
      } else {
        // Регистрация: объединяем имя и фамилию в одно поле name
        const fullName = `${firstName} ${lastName}`.trim();
        if (!fullName) throw new Error('Имя и фамилия обязательны');

        // Отправляем только те поля, которые ожидает бэкенд
        const result = await register(fullName, email, password, role);
        if (!result.success) throw new Error(result.error);

        // После успешной регистрации переходим на страницу входа
        navigate('/login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          {mode === 'register' && (
            <>
              <input
                placeholder="Имя"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={loading}
              />
              <input
                placeholder="Фамилия"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={loading}
              />
              <input
                placeholder="Телефон (опционально)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
              <input
                placeholder="Адрес (опционально)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
              >
                <option value="student">Студент</option>
                <option value="teacher">Преподаватель</option>
              </select>
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Загрузка...' : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>Нет аккаунта? <button onClick={() => navigate('/register')} className="link-btn">Зарегистрироваться</button></>
          ) : (
            <>Уже есть аккаунт? <button onClick={() => navigate('/login')} className="link-btn">Войти</button></>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;