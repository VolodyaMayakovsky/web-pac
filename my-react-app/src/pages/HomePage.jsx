// src/pages/HomePage.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Email:', email);
    setEmail('');
  };

  return (
    <>
      <section className="hero-section">
        <div className="hero-content">
          <span className="badge">Планирование 2.0</span>
          <h1>Эффективное планирование образовательного процесса</h1>
          <p className="hero-description">
            Инструмент для учебных заведений, преподавателей и студентов.
          </p>
          <div className="hero-actions">
            {!user && (
              <>
                <a href="/register" className="btn-primary">Начать бесплатно</a>
                <a href="/login" className="btn-secondary">Войти</a>
              </>
            )}
            {user && <a href="/schedule" className="btn-primary">Перейти к расписанию</a>}
          </div>
        </div>
      </section>
      {/* Остальные секции (features, cta, footer) как раньше */}
      <section id="features" className="features-section">...</section>
      <section className="cta-section">...</section>
      <footer className="footer">...</footer>
    </>
  );
};

export default HomePage;