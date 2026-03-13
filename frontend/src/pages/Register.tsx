import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, User, Mail, Lock } from 'lucide-react';
import api from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const panel = searchParams.get('panel') || 'donor';
  const defaultCountries = useMemo(() => ['Bangladesh', 'India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'UAE', 'Saudi Arabia', 'Qatar', 'Malaysia', 'Singapore'], []);
  const defaultProfessions = useMemo(() => ['Student', 'Teacher', 'Doctor', 'Engineer', 'Business', 'Govt Service', 'Private Service', 'NGO Worker', 'Freelancer', 'Farmer', 'Other'], []);
  const [countryOptions, setCountryOptions] = useState<string[]>(defaultCountries);
  const [professionOptions, setProfessionOptions] = useState<string[]>(defaultProfessions);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    country: '',
    profession: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/public/settings')
      .then((res) => {
        const settings = res.data?.data || {};
        const countries = settings['registration.country_options'];
        const professions = settings['registration.profession_options'];

        if (Array.isArray(countries) && countries.length > 0) {
          setCountryOptions(countries.map((x) => String(x)).filter(Boolean));
        }
        if (Array.isArray(professions) && professions.length > 0) {
          setProfessionOptions(professions.map((x) => String(x)).filter(Boolean));
        }
      })
      .catch(() => {
        setCountryOptions(defaultCountries);
        setProfessionOptions(defaultProfessions);
      });
  }, [defaultCountries, defaultProfessions]);

  const passwordChecks = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(form.password) },
    { label: 'Number', ok: /\d/.test(form.password) },
    { label: 'Special character', ok: /[^A-Za-z0-9]/.test(form.password) },
  ];
  const passwordValid = passwordChecks.every(c => c.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordValid) {
      setError('Password does not meet the requirements.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        role: 'Donor',
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        country: form.country.trim() || undefined,
        profession: form.profession.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  if (panel === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Admin Registration Disabled</h2>
          <p className="text-slate-500 mb-6 text-sm">Admin accounts are created by system administrators only.</p>
          <div className="flex flex-col gap-2">
            <Link to="/login?panel=admin" className="w-full bg-primary-500 hover:bg-primary-400 text-white font-bold py-3 px-6 rounded-xl transition-all">Admin Login</Link>
            <Link to="/auth?mode=register" className="text-slate-600 text-sm hover:text-slate-800">Choose another panel</Link>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'volunteer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Volunteer Registration</h2>
          <p className="text-slate-500 mb-6 text-sm">Please submit a volunteer application first. After approval, you can log in to the volunteer panel.</p>
          <div className="flex flex-col gap-2">
            <Link to="/volunteer-apply" className="w-full bg-primary-500 hover:bg-primary-400 text-white font-bold py-3 px-6 rounded-xl transition-all">Apply as Volunteer</Link>
            <Link to="/login?panel=volunteer" className="text-slate-600 text-sm hover:text-slate-800">Already approved? Volunteer login</Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 p-4 rounded-full">
              <CheckCircle className="text-green-500" size={40} />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Account Created!</h2>
          <p className="text-slate-500 mb-6">
            Welcome to DFB Foundation. Your donor account is active and ready to use.
            Check your email for a welcome message.
          </p>
          <button
            onClick={() => navigate('/login?panel=donor')}
            className="w-full bg-primary-500 hover:bg-primary-400 text-white font-bold py-3 px-6 rounded-xl transition-all"
          >
            Sign In Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full mb-4">
            <Heart className="text-pink-400" fill="currentColor" size={20} />
            <span className="text-white font-bold text-lg">DFB Foundation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-1 text-sm">Donor Registration — join thousands of donors making a difference</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">First Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={set('firstName')}
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    placeholder="John"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Last Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={set('lastName')}
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    placeholder="Doe"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Phone (optional)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Country (optional)</label>
                <select
                  value={form.country}
                  onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                >
                  <option value="" className="text-slate-900">Select country</option>
                  {countryOptions.map((country) => (
                    <option key={country} value={country} className="text-slate-900">{country}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Profession (optional)</label>
                <select
                  value={form.profession}
                  onChange={(e) => setForm(f => ({ ...f, profession: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                >
                  <option value="" className="text-slate-900">Select profession</option>
                  {professionOptions.map((profession) => (
                    <option key={profession} value={profession} className="text-slate-900">{profession}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={set('password')}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  placeholder="Create a strong password"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {passwordChecks.map((c, i) => (
                    <div key={i} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-400' : 'text-slate-500'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${c.ok ? 'bg-green-400' : 'bg-slate-600'}`} />
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Confirm Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  className={`w-full bg-white/10 border text-white placeholder-slate-400 rounded-xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent ${
                    form.confirmPassword && form.confirmPassword !== form.password
                      ? 'border-red-400/50'
                      : 'border-white/20'
                  }`}
                  placeholder="Repeat your password"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-400 disabled:bg-primary-800 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-primary-900/50"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Creating Account…</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login?panel=donor" className="text-primary-400 hover:text-primary-300 font-semibold">Sign in</Link>
          </p>
          <p className="text-center mt-2 text-xs text-slate-500">
            <Link to="/auth?mode=register" className="hover:text-slate-300">Choose another panel</Link>
          </p>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          By creating an account, you agree to DFB Foundation's terms and conditions.
        </p>
      </div>
    </div>
  );
}
