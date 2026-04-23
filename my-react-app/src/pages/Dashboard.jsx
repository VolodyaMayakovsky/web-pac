import React from 'react';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user, logout } = useAuth();
  return (
    <div>
      <h1>Добро пожаловать, {user?.name}!</h1>
      <button onClick={logout}>Выйти</button>
    </div>
  );
};

export default Dashboard;