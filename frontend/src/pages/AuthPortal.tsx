import { Link, useSearchParams } from 'react-router-dom';
import { Shield, Heart, Users, ArrowRight } from 'lucide-react';

type Mode = 'login' | 'register';

export default function AuthPortal() {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as Mode) || 'login';

  const actionLabel = mode === 'register' ? 'registration' : 'login';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto pt-8 sm:pt-14">
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Choose Your Panel</h1>
          <p className="text-slate-300 mt-2">Select the correct {actionLabel} flow for your panel.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="text-sky-300" size={20} />
              <h2 className="text-lg font-semibold">Admin Panel</h2>
            </div>
            <p className="text-slate-300 text-sm mb-5">Restricted access for Admin and Super Admin accounts.</p>
            <Link
              to="/login?panel=admin"
              className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-400 text-white font-semibold py-2.5 px-4 rounded-xl transition-all"
            >
              Admin Login <ArrowRight size={16} />
            </Link>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="text-pink-300" size={20} />
              <h2 className="text-lg font-semibold">Donor Panel</h2>
            </div>
            <p className="text-slate-300 text-sm mb-5">Donate, track impact, and manage donor profile.</p>
            <div className="flex flex-col gap-2">
              <Link
                to="/login?panel=donor"
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-400 text-white font-semibold py-2.5 px-4 rounded-xl transition-all"
              >
                Donor Login
              </Link>
              <Link
                to="/register?panel=donor"
                className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-4 rounded-xl border border-white/20 transition-all"
              >
                Donor Registration
              </Link>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Users className="text-green-300" size={20} />
              <h2 className="text-lg font-semibold">Volunteer Panel</h2>
            </div>
            <p className="text-slate-300 text-sm mb-5">Login as volunteer or apply as a new volunteer.</p>
            <div className="flex flex-col gap-2">
              <Link
                to="/login?panel=volunteer"
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-400 text-white font-semibold py-2.5 px-4 rounded-xl transition-all"
              >
                Volunteer Login
              </Link>
              <Link
                to="/volunteer-apply"
                className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-4 rounded-xl border border-white/20 transition-all"
              >
                Volunteer Registration
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link to="/" className="text-slate-300 hover:text-white text-sm">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
