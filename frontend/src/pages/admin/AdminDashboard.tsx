import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { Settings, Shield, Activity, Users } from 'lucide-react';

import SettingsPanel from './SettingsPanel';
// import RolesPanel from './RolesPanel';
// import AuditLogs from './AuditLogs';

export default function AdminDashboard() {
  const { user } = useAuth();

  const menuItems = [
    { name: 'System Settings', path: '/admin/settings', icon: <Settings size={20} /> },
    { name: 'Role Management', path: '/admin/roles', icon: <Shield size={20} /> },
    { name: 'Audit Logs', path: '/admin/audit', icon: <Activity size={20} /> },
    { name: 'User Management', path: '/admin/users', icon: <Users size={20} /> },
  ];

  return (
    <DashboardLayout 
      title="Admin Control Panel" 
      role={user?.role || 'Admin'} 
      menuItems={menuItems}
    >
      <div className="animate-in fade-in duration-500">
        <Routes>
          <Route path="/" element={<Navigate to="settings" replace />} />
          <Route path="settings" element={<SettingsPanel />} />
          <Route path="roles" element={<div className="glass p-6 rounded-xl">Role Management (Coming Soon)</div>} />
          <Route path="audit" element={<div className="glass p-6 rounded-xl">Audit Logs (Coming Soon)</div>} />
          <Route path="users" element={<div className="glass p-6 rounded-xl">User Management (Coming Soon)</div>} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
