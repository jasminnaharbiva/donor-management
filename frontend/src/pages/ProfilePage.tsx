import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, KeyRound, LogOut, Loader2, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import api from '../services/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // 2FA state
  const [qrCodeData, setQrCodeData] = useState('');
  const [twoFaToken, setTwoFaToken] = useState('');
  const [twoFaEnabling, setTwoFaEnabling] = useState(false);
  const [twoFaSuccess, setTwoFaSuccess] = useState('');

  const generate2Fa = async () => {
    try {
      const res = await api.post('/auth/2fa/generate');
      setQrCodeData(res.data.qrCode);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate 2FA token.');
    }
  };

  const verify2Fa = async () => {
    setTwoFaEnabling(true);
    setTwoFaSuccess('');
    setError('');
    try {
      await api.post('/auth/2fa/verify', { token: twoFaToken });
      setTwoFaSuccess('Two-Factor Authentication is now actively protecting your account.');
      setQrCodeData('');
      setTwoFaToken('');
      // Force refresh user context if available, otherwise just rely on page reload or future relogin
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid 2FA code. Please try again.');
    } finally {
      setTwoFaEnabling(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password. Check your current password.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get initials from email
  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"
        >
          ← Back
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-2xl shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email}
              </h1>
              <span className="inline-block text-xs bg-primary-100 text-primary-700 font-semibold px-3 py-1 rounded-full mt-1">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <User size={16} className="text-primary-600" /> Account Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1 flex items-center gap-1"><Mail size={12} /> Email</p>
              <p className="text-sm font-medium text-slate-800">{user?.email}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1 flex items-center gap-1"><Shield size={12} /> Role</p>
              <p className="text-sm font-medium text-slate-800">{user?.role}</p>
            </div>
            {user?.firstName && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">First Name</p>
                <p className="text-sm font-medium text-slate-800">{user.firstName}</p>
              </div>
            )}
            {user?.lastName && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Last Name</p>
                <p className="text-sm font-medium text-slate-800">{user.lastName}</p>
              </div>
            )}
          </div>
        </div>

        {/* 2FA Security Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <Smartphone size={16} className="text-indigo-600" /> Two-Factor Authentication (2FA)
          </h2>
          
          {twoFaSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl mb-4">
              <CheckCircle size={16} /> {twoFaSuccess}
            </div>
          )}

          {(user as any)?.two_fa_enabled || twoFaSuccess ? (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3 text-indigo-800 text-sm">
              <Shield size={20} className="shrink-0 text-indigo-600 mt-0.5" />
              <div>
                <strong className="block mb-1">2FA is Enabled</strong>
                Your account is secured with Two-Factor Authentication. A Time-based One Time Password (TOTP) from your authenticator app will be required during login.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Enhance your account security by requiring an authentication code from an app like Google Authenticator or Authy when you sign in.
              </p>

              {!qrCodeData ? (
                <button
                  onClick={generate2Fa}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Enable 2FA
                </button>
              ) : (
                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 shrink-0">
                      <img src={qrCodeData} alt="2FA QR Code" className="w-32 h-32" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <h4 className="font-semibold text-slate-800 text-sm">1. Scan the QR Code</h4>
                      <p className="text-sm text-slate-600">Open your authenticator app and scan the QR code to add this account.</p>
                      <h4 className="font-semibold text-slate-800 text-sm mt-4">2. Enter the verification code</h4>
                      <div className="flex gap-2 max-w-xs">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="e.g. 123456"
                          value={twoFaToken}
                          onChange={(e) => setTwoFaToken(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center tracking-widest font-mono"
                        />
                        <button
                          onClick={verify2Fa}
                          disabled={twoFaToken.length !== 6 || twoFaEnabling}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
                        >
                          {twoFaEnabling ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <KeyRound size={16} className="text-primary-600" /> Change Password
          </h2>

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl mb-4">
              <CheckCircle size={16} /> {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl mb-4">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500/40 outline-none text-sm"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500/40 outline-none text-sm"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500/40 outline-none text-sm"
                placeholder="Repeat new password"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {saving ? 'Saving…' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Sign Out */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-3">Session</h2>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors text-sm border border-red-200"
          >
            <LogOut size={16} />
            Sign Out of All Devices
          </button>
        </div>

      </div>
    </div>
  );
}
