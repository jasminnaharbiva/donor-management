import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function VolunteerApply() {
  const [form, setForm] = useState({
    applicantName: '',
    applicantEmail: '',
    phone: '',
    motivationStatement: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/volunteers/apply', {
        applicantName: form.applicantName.trim(),
        applicantEmail: form.applicantEmail.trim().toLowerCase(),
        phone: form.phone.trim(),
        motivationStatement: form.motivationStatement.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit application.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 text-center shadow-2xl">
          <CheckCircle className="mx-auto text-green-500 mb-3" size={42} />
          <h1 className="text-xl font-bold text-slate-800">Application Submitted</h1>
          <p className="text-slate-600 mt-2 text-sm">
            Your volunteer application has been submitted successfully. After approval, you can log in to the volunteer panel.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/login?panel=volunteer" className="bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-semibold">Volunteer Login</Link>
            <Link to="/" className="text-slate-600 hover:text-slate-800 text-sm">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white/10 border border-white/20 rounded-2xl p-6 sm:p-8 shadow-2xl text-white">
        <h1 className="text-xl sm:text-2xl font-bold">Volunteer Registration</h1>
        <p className="text-slate-300 text-sm mt-1 mb-5">Apply to join the volunteer panel.</p>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5 text-slate-200">Full Name</label>
            <input
              type="text"
              required
              value={form.applicantName}
              onChange={set('applicantName')}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5 text-slate-200">Email Address</label>
            <input
              type="email"
              required
              value={form.applicantEmail}
              onChange={set('applicantEmail')}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5 text-slate-200">Phone</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={set('phone')}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="+8801XXXXXXXXX"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5 text-slate-200">Motivation</label>
            <textarea
              required
              rows={4}
              value={form.motivationStatement}
              onChange={set('motivationStatement')}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Tell us why you want to volunteer"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit Application'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          <Link to="/auth?mode=login" className="text-slate-300 hover:text-white">Choose another panel</Link>
        </div>
      </div>
    </div>
  );
}
