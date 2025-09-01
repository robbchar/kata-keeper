import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user || user.isAnonymous) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user && !user.isAnonymous) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
