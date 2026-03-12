import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const token                   = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    if (!token) setError('Missing or invalid reset link. Please request a new one.');
  }, [token]);

  const strength = () => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[!@#$%^&*]/.test(password)) s++;
    return s;
  };

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-primary-500', 'bg-green-500'];
  const s = strength();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (s < 2) { setError('Password is too weak.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid or expired reset link. Please request a new one.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600/20 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Set New Password</h1>
          <p className="text-slate-400 text-sm mt-1">Choose a strong password for your account</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium">Password Reset!</p>
              <p className="text-slate-300 text-sm">Your password has been updated. Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= s ? strengthColor[s] : 'bg-white/20'}`} />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 ${s >= 3 ? 'text-green-400' : s === 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {strengthLabel[s]}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                <input
                  type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {confirm && password !== confirm && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
              </div>
              <button
                type="submit" disabled={loading || !token}
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition-all"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <div className="text-center">
                <Link to="/forgot-password" className="text-slate-400 hover:text-slate-300 text-sm">Request a new link</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
