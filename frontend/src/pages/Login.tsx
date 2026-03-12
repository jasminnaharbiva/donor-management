import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Loader2, AlertCircle, Info, Shield } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [twoFaToken, setTwoFaToken] = useState('');
  const [tempUserId, setTempUserId] = useState('');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === '1';
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.twoFaRequired) {
        setTwoFaRequired(true);
        setTempUserId(response.data.userId);
        return;
      }

      if (response.data.success) {
        // Store both tokens
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        login(response.data.token || response.data.accessToken, response.data.user);
        
        // Route based on role
        const role = response.data.user.role;
        if (role === 'Super Admin' || role === 'Admin') navigate('/admin');
        else if (role === 'Volunteer') navigate('/volunteer');
        else navigate('/donor');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handle2FaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await api.post('/auth/2fa/login', { userId: tempUserId, token: twoFaToken });
      
      if (response.data.success) {
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        login(response.data.token || response.data.accessToken, response.data.user);
        
        const role = response.data.user.role;
        if (role === 'Super Admin' || role === 'Admin') navigate('/admin');
        else if (role === 'Volunteer') navigate('/volunteer');
        else navigate('/donor');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid authentication code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* Logo / Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl shadow-xl mb-3">
            <Heart size={32} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-300">DFB Portal</h1>
          <p className="text-slate-300 mt-1">Donor & Volunteer Management System</p>
        </div>

        {/* Session expired notice */}
        {sessionExpired && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm">
            <Info size={18} className="shrink-0" />
            <span>Your session has expired. Please sign in again.</span>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}


          {twoFaRequired ? (
            <form onSubmit={handle2FaSubmit} className="space-y-5">
              <div className="text-center mb-6">
                <Shield size={48} className="mx-auto text-primary-400 mb-3" />
                <p className="text-slate-300 text-sm">Enter the 6-digit code from your authenticator app to continue.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 text-center">Authentication Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400/50 transition-all text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  value={twoFaToken}
                  onChange={(e) => setTwoFaToken(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setTwoFaRequired(false); setTwoFaToken(''); setPassword(''); }}
                  className="w-1/3 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-xl transition-all border border-white/20"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || twoFaToken.length !== 6}
                  className="w-2/3 bg-primary-500 hover:bg-primary-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-primary-500/30 flex justify-center items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <><Loader2 className="animate-spin" size={18} /> Verifying…</>
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400/50 transition-all"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400/50 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="flex justify-end -mt-2 mb-1">
                <Link to="/forgot-password" className="text-sm text-primary-400 hover:text-primary-300">Forgot password?</Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary-500 hover:bg-primary-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-primary-500/30 flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" size={18} /> Signing In…</>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

          {!twoFaRequired && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-center text-slate-400 text-sm">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
                  Register here
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Demo credentials */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-xs text-slate-400 space-y-2">
          <p className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Info size={13} /> Demo Credentials
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setEmail('admin@dfb.org'); setPassword('Admin@2026'); }}
              className="text-left bg-white/5 hover:bg-white/10 rounded-lg p-2 transition-all border border-white/10 cursor-pointer">
              <span className="block text-primary-400 font-medium">Admin</span>
              <span className="block">admin@dfb.org</span>
              <span className="block">Admin@2026</span>
            </button>
            <button type="button" onClick={() => { setEmail('volunteer@dfb.org'); setPassword('Volunteer@2026'); }}
              className="text-left bg-white/5 hover:bg-white/10 rounded-lg p-2 transition-all border border-white/10 cursor-pointer">
              <span className="block text-green-400 font-medium">Volunteer</span>
              <span className="block">volunteer@dfb.org</span>
              <span className="block">Volunteer@2026</span>
            </button>
          </div>
          <p className="text-center text-slate-500">Click a role to auto-fill credentials</p>
        </div>

        <p className="text-center text-slate-600 text-xs">
          © 2026 DFB Foundation. All rights reserved.
        </p>
      </div>
    </div>
  );
}
