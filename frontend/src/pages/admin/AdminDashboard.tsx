import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  Settings, Shield, Activity, Users, Megaphone, BarChart3,
  Heart, DollarSign, Target, UserCheck, Layers, Globe, HandCoins,
  CalendarClock, Bell, UserRound, FolderOpen, ToggleLeft,
  Clock, Network, Mail, Sliders, Languages, FileText, FormInput, Palette
} from 'lucide-react';

import SettingsPanel from './SettingsPanel';
import RolesPanelFull from './RolesPanelFull';
import AuditLogsFull from './AuditLogsFull';
import UsersPanelFull from './UsersPanelFull';
import CampaignsPanel from './CampaignsPanel';
import DonorsPanel from './DonorsPanel';
import DonationsPanel from './DonationsPanel';
import ExpensesAdminPanel from './ExpensesAdminPanel';
import ReportsPanel from './ReportsPanel';
import AnnouncementsPanel from './AnnouncementsPanel';
import DashboardStats from './DashboardStats';
import SeoPanel from './SeoPanel';
import BeneficiariesPanel from './BeneficiariesPanel';
import PledgesPanel from './PledgesPanel';
import RecurringPanel from './RecurringPanel';
import NotificationsAdminPanel from './NotificationsAdminPanel';
import ProjectsPanel from './ProjectsPanel';
import FeatureFlagsPanel from './FeatureFlagsPanel';
import ShiftsPanel from './ShiftsPanel';
import P2PPanel from './P2PPanel';
import EmailTemplatesPanel from './EmailTemplatesPanel';
import CustomFieldsPanel from './CustomFieldsPanel';
import TranslationsPanel from './TranslationsPanel';
import PublicPagesPanel from './PublicPagesPanel';
import FormSchemasPanel from './FormSchemasPanel';
import UIDesignPanel from './UIDesignPanel';
import VolunteerHubPanel from './VolunteerHubPanel';
import DonorRecordsPanel from './DonorRecordsPanel';

export default function AdminDashboard() {
  const { user } = useAuth();

  const menuItems = [
    { name: 'Overview', path: '/admin/overview', icon: <Layers size={20} /> },
    { name: 'Campaigns', path: '/admin/campaigns', icon: <Target size={20} /> },
    { name: 'Donations', path: '/admin/donations', icon: <DollarSign size={20} /> },
    { name: 'Donors', path: '/admin/donors', icon: <Heart size={20} /> },
    { name: 'Projects', path: '/admin/projects', icon: <FolderOpen size={20} /> },
    { name: 'Expenses', path: '/admin/expenses', icon: <BarChart3 size={20} /> },
    { name: 'Volunteer Hub', path: '/admin/volunteer-hub', icon: <UserCheck size={20} /> },
    { name: 'Donor Records', path: '/admin/donor-records', icon: <FileText size={20} /> },
    { name: 'Shifts & Timesheets', path: '/admin/shifts', icon: <Clock size={20} /> },
    { name: 'P2P Campaigns', path: '/admin/p2p', icon: <Network size={20} /> },
    { name: 'Users', path: '/admin/users', icon: <Users size={20} /> },
    { name: 'Roles & Perms', path: '/admin/roles', icon: <Shield size={20} /> },
    { name: 'Announcements', path: '/admin/announcements', icon: <Megaphone size={20} /> },
    { name: 'Beneficiaries', path: '/admin/beneficiaries', icon: <UserRound size={20} /> },
    { name: 'Pledges', path: '/admin/pledges', icon: <HandCoins size={20} /> },
    { name: 'Recurring', path: '/admin/recurring', icon: <CalendarClock size={20} /> },
    { name: 'Notifications', path: '/admin/notifications', icon: <Bell size={20} /> },
    { name: 'Email Templates', path: '/admin/email-templates', icon: <Mail size={20} /> },
    { name: 'Custom Fields', path: '/admin/custom-fields', icon: <Sliders size={20} /> },
    { name: 'Feature Flags', path: '/admin/feature-flags', icon: <ToggleLeft size={20} /> },
    { name: 'Reports', path: '/admin/reports', icon: <Activity size={20} /> },
    { name: 'Audit Logs', path: '/admin/audit', icon: <Activity size={20} /> },
    { name: 'System Settings', path: '/admin/settings', icon: <Settings size={20} /> },
    { name: 'SEO Manager', path: '/admin/seo', icon: <Globe size={20} /> },
    { name: 'Translations', path: '/admin/translations', icon: <Languages size={20} /> },
    { name: 'Public Pages', path: '/admin/public-pages', icon: <FileText size={20} /> },
    { name: 'Form Schemas', path: '/admin/form-schemas', icon: <FormInput size={20} /> },
    { name: 'UI Design', path: '/admin/ui-design', icon: <Palette size={20} /> },
  ];

  return (
    <DashboardLayout
      title="Admin Control Panel"
      role={user?.role || 'Admin'}
      menuItems={menuItems}
    >
      <div className="animate-in fade-in duration-500 dfb-admin-panel">
        <Routes>
          <Route path="/" element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<DashboardStats />} />
          <Route path="campaigns" element={<CampaignsPanel />} />
          <Route path="donations" element={<DonationsPanel />} />
          <Route path="donors" element={<DonorsPanel />} />
          <Route path="projects" element={<ProjectsPanel />} />
          <Route path="expenses" element={<ExpensesAdminPanel />} />
          <Route path="volunteer-hub" element={<VolunteerHubPanel />} />
          <Route path="donor-records" element={<DonorRecordsPanel />} />
          <Route path="volunteers" element={<Navigate to="/admin/volunteer-hub?tab=people" replace />} />
          <Route path="vol-applications" element={<Navigate to="/admin/volunteer-hub?tab=applications" replace />} />
          <Route path="shifts" element={<ShiftsPanel />} />
          <Route path="p2p" element={<P2PPanel />} />
          <Route path="users" element={<UsersPanelFull />} />
          <Route path="roles" element={<RolesPanelFull />} />
          <Route path="announcements" element={<AnnouncementsPanel />} />
          <Route path="reports" element={<ReportsPanel />} />
          <Route path="audit" element={<AuditLogsFull />} />
          <Route path="settings" element={<SettingsPanel />} />
          <Route path="seo" element={<SeoPanel />} />
          <Route path="beneficiaries" element={<BeneficiariesPanel />} />
          <Route path="pledges" element={<PledgesPanel />} />
          <Route path="recurring" element={<RecurringPanel />} />
          <Route path="notifications" element={<NotificationsAdminPanel />} />
          <Route path="email-templates" element={<EmailTemplatesPanel />} />
          <Route path="custom-fields" element={<CustomFieldsPanel />} />
          <Route path="feature-flags" element={<FeatureFlagsPanel />} />
          <Route path="translations" element={<TranslationsPanel />} />
          <Route path="public-pages" element={<PublicPagesPanel />} />
          <Route path="form-schemas" element={<FormSchemasPanel />} />
          <Route path="vol-records" element={<Navigate to="/admin/volunteer-hub?tab=records" replace />} />
          <Route path="vms" element={<Navigate to="/admin/volunteer-hub?tab=records" replace />} />
          <Route path="ui-design" element={<UIDesignPanel />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}

