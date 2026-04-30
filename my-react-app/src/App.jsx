// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import Auth from './pages/Auth';
import SchedulePage from './pages/SchedulePage';
import Profile from './pages/Profile';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function App() {
  const { user, logout, updateProfile } = useAuth();

  return (
    <>
      <Header user={user} onLogout={logout} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route
          path="/schedule"
          element={
            <PrivateRoute>
              <SchedulePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile user={user} onUpdate={updateProfile} />
            </PrivateRoute>
          }
        />
        <Route path="/dashboard" element={<Navigate to="/schedule" />} />
      </Routes>
    </>
  );
}

export default App;