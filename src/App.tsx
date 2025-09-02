import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import SignUp from '@/pages/SignUp';
import KataKeeperApp from './pages/KataKeeperApp';
import { RedirectIfAuthed, RequireAuth } from './auth/guards';
import Logout from './components/Logout';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/logout" element={<Logout />} />
        {/* public auth pages when logged OUT */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>

        {/* everything else requires auth */}
        <Route element={<RequireAuth />}>
          <Route path="/*" element={<KataKeeperApp />} />
        </Route>

        {/* catch-all: redirect to / */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
