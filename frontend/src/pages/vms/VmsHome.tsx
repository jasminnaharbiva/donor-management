import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

type VmsSettings = {
  site_name?: string;
  home_title?: string;
  logo_path?: string;
};

export default function VmsHome() {
  const [certificateId, setCertificateId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<VmsSettings>({});
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/vms/public/settings')
      .then((res) => setSettings(res.data.data || {}))
      .catch(() => undefined);
  }, []);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!certificateId.trim()) {
      setError('Please enter a certificate ID');
      return;
    }

    setLoading(true);
    try {
      await api.post('/vms/public/verify-certificate', { certificateId: certificateId.trim() });
      navigate(`/vms/certificate/${encodeURIComponent(certificateId.trim())}`);
    } catch {
      navigate(`/vms/certificate/${encodeURIComponent(certificateId.trim())}?notfound=1`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white/10 border border-white/20 backdrop-blur rounded-2xl p-8 shadow-2xl text-white">
        <div className="text-center mb-6">
          {settings.logo_path && <img src={settings.logo_path} alt="logo" className="h-16 mx-auto mb-4" />}
          <h1 className="text-2xl sm:text-3xl font-bold">{settings.site_name || 'Volunteer Management System'}</h1>
          <p className="text-slate-300 mt-2">{settings.home_title || 'Verify volunteer certificate'}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            value={certificateId}
            onChange={(e) => setCertificateId(e.target.value)}
            placeholder="Enter Certificate ID"
            className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 outline-none border border-transparent focus:border-primary-500"
          />
          {error && <div className="text-red-300 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium"
          >
            {loading ? 'Verifying...' : 'Verify Certificate'}
          </button>
        </form>
      </div>
    </div>
  );
}
