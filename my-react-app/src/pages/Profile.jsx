// src/pages/Profile.jsx
import { useState } from 'react';

const Profile = ({ user, onUpdate }) => {
  const [form, setForm] = useState({
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    middleName: user.middle_name || '',
    phone: user.phone || '',
    address: user.address || '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onUpdate(form);
      setMessage('Данные обновлены');
    } catch {
      setMessage('Ошибка обновления');
    }
  };

  return (
    <div className="profile-container">
      <h2>Личный кабинет</h2>
      <form onSubmit={handleSubmit}>
        <input name="firstName" placeholder="Имя" value={form.firstName} onChange={handleChange} />
        <input name="lastName" placeholder="Фамилия" value={form.lastName} onChange={handleChange} />
        <input name="middleName" placeholder="Отчество" value={form.middleName} onChange={handleChange} />
        <input name="phone" placeholder="Телефон" value={form.phone} onChange={handleChange} />
        <input name="address" placeholder="Адрес" value={form.address} onChange={handleChange} />
        <button type="submit">Сохранить</button>
        {message && <p>{message}</p>}
      </form>
    </div>
  );
};

export default Profile;