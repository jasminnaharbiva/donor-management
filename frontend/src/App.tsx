import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/AdminDashboard';
import DonorDashboard from './pages/donor/DonorDashboard';
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard';
import PublicHome from './pages/PublicHome';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']} />}>
            <Route path="/admin/*" element={<AdminDashboard />} />
          </Route>
          
          {/* Donor Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Donor', 'Super Admin', 'Admin']} />}>
            <Route path="/donor/*" element={<DonorDashboard />} />
          </Route>
          
          {/* Volunteer Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Volunteer', 'Super Admin', 'Admin']} />}>
            <Route path="/volunteer/*" element={<VolunteerDashboard />} />
          </Route>

          {/* Catch All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
