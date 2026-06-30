import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from '@/pages/Login'
import SignUp from '@/pages/SignUp'
import KataListPage from '@/pages/KataListPage'
import KataDetailPage from '@/pages/KataDetailPage'
import ConfigPage from '@/pages/ConfigPage'
import { RedirectIfAuthed, RequireAuth } from './auth/guards'
import Logout from './components/Logout'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/logout" element={<Logout />} />
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<KataListPage />} />
          <Route path="/kata/:id" element={<KataDetailPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
