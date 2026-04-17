// src/pages/Auth.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Auth = ({ onLogin, onRegister, mode }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister({ email, password, firstName, lastName, phone, address, role });
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required />
          {mode === 'register' && (
            <>
              <input placeholder="Имя" value={firstName} onChange={e => setFirstName(e.target.value)} required />
              <input placeholder="Фамилия" value={lastName} onChange={e => setLastName(e.target.value)} required />
              <input placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} />
              <input placeholder="Адрес" value={address} onChange={e => setAddress(e.target.value)} />
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="student">Студент</option>
                <option value="teacher">Преподаватель</option>
              </select>
            </>
          )}
          {error && <div className="error">{error}</div>}
          <button type="submit">{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
        </form>
      </div>
    </div>
  );
};

export default Auth;