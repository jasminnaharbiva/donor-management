import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CampaignPage from './pages/CampaignPage';
import VolunteerVerify from './pages/VolunteerVerify';
import AdminDashboard from './pages/admin/AdminDashboard';
import DonorDashboard from './pages/donor/DonorDashboard';
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard';
import PublicHome from './pages/PublicHome';
import ProfilePage from './pages/ProfilePage';

import { useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import api from './services/api';

export default function App() {
  const { socket, connected } = useSocket();

  useEffect(() => {
    // 1. Listen for global admin-broadcasts via WebSocket
    if (socket && connected) {
      socket.on('admin-broadcast', (data: any) => {
        console.log('[App] Received admin broadcast:', data);
        if (data.type === 'settings_updated') {
          // In a full app, you might re-fetch settings into a Zustand store or AuthContext here
          console.log('[App] Settings updated globally. Refreshing SEO...');
          loadDynamicSeo();
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('admin-broadcast');
      }
    };
  }, [socket, connected]);

  useEffect(() => {
    // Initial SEO load
    loadDynamicSeo();
  }, []);

  const loadDynamicSeo = async () => {
    try {
      // Assuming a public endpoint exists for global SEO
      // Fallback securely if it doesn't
      const res = await api.get('/public/settings').catch(() => null);
      if (!res?.data?.data || typeof res.data.data !== 'object') return;

      const settingsObj = res.data.data as Record<string, unknown>;
      const gtmScript = settingsObj['integration.gtm_id'] as string | undefined;
      const jsonLd = settingsObj['seo.global_json_ld'] as string | undefined;

      // Inject GTM if configured
      if (gtmScript && !document.getElementById('dfb-gtm')) {
        const script = document.createElement('script');
        script.id = 'dfb-gtm';
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gtmScript}`;
        document.head.appendChild(script);

        const inlineScript = document.createElement('script');
        inlineScript.id = 'dfb-gtm-inline';
        inlineScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gtmScript}');
        `;
        document.head.appendChild(inlineScript);
      }

      // Inject JSON-LD if configured
      if (jsonLd) {
        let script = document.getElementById('dfb-json-ld') as HTMLScriptElement;
        if (!script) {
          script = document.createElement('script');
          script.id = 'dfb-json-ld';
          script.type = 'application/ld+json';
          document.head.appendChild(script);
        }
        script.innerHTML = jsonLd;
      }
    } catch (e) {
      console.error('[App] Failed to inject dynamic SEO:', e);
    }
  };

  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/campaigns/:slug" element={<CampaignPage />} />
          <Route path="/verify/:badgeNumber" element={<VolunteerVerify />} />

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

          {/* Profile — all authenticated roles */}
          <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Donor', 'Volunteer']} />}>
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Catch All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}
