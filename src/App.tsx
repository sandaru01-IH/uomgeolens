import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Report from './pages/Report';
import TreeDetail from './pages/TreeDetail';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/layout/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={<><Navbar /><Dashboard /><Footer /></>}
        />
        <Route
          path="/map"
          element={<><Navbar /><MapView /></>}
        />
        <Route
          path="/report"
          element={<><Navbar /><Report /><Footer /></>}
        />
        <Route
          path="/tree/:id"
          element={<><Navbar /><TreeDetail /><Footer /></>}
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <><Navbar admin /><AdminPanel /></>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
