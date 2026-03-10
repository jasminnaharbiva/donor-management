import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.success) {
        login(response.data.token, response.data.user);
        
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Decorative Blob */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="glass w-full max-w-md p-8 rounded-2xl relative z-10 transition-all-200 hover:shadow-2xl">
        <div className="flex justify-center mb-6 text-primary-600">
          <Heart size={48} className="drop-shadow-sm" />
        </div>
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-2 font-inter">Welcome Back</h2>
        <p className="text-center text-slate-500 mb-8 font-inter">Sign in to your DFB portal</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-md">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white/50 backdrop-blur-sm"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white/50 backdrop-blur-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-primary-500/30 flex justify-center items-center"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
