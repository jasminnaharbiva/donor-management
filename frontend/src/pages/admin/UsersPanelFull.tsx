import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Users, CheckCircle, XCircle, RefreshCw, Search } from 'lucide-react';

interface User {
  user_id: string;
  email: string;
  role_name: string;
  status: string;
  last_login_at: string;
  created_at: string;
}

interface Role {
  role_id: number;
  role_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
  deleted: 'bg-slate-100 text-slate-500',
};

export default function UsersPanelFull() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ur, rr] = await Promise.all([api.get('/admin/users'), api.get('/admin/roles')]);
      setUsers(ur.data.data);
      setRoles(rr.data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const updateUser = async (userId: string, updates: any) => {
    setUpdating(userId);
    try {
      await api.put(`/admin/users/${userId}`, updates);
      await loadData();
    } catch { alert('Update failed'); }
    setUpdating(null);
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role_name?.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : 'Never';

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Users className="text-primary-500" /> User Management</h2>
        <button onClick={loadData} className="flex items-center justify-center sm:justify-start gap-2 text-sm text-slate-600 hover:text-primary-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="mb-4 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Search by email or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Email</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Role</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Status</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Last Login</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Joined</th>
                <th className="py-3 px-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(user => (
                <tr key={user.user_id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 text-slate-800 font-medium">{user.email}</td>
                  <td className="py-3 px-3">
                    <select
                      className="text-sm border border-slate-200 rounded px-2 py-1"
                      value={roles.find(r => r.role_name === user.role_name)?.role_id || ''}
                      onChange={e => updateUser(user.user_id, { role_id: Number(e.target.value) })}
                      disabled={updating === user.user_id}
                    >
                      {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                    </select>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[user.status] || 'bg-slate-100 text-slate-600'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{fmtDate(user.last_login_at)}</td>
                  <td className="py-3 px-3 text-slate-500">{fmtDate(user.created_at)}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-2 justify-center">
                      {user.status !== 'active' && (
                        <button
                          onClick={() => updateUser(user.user_id, { status: 'active' })}
                          className="text-green-600 hover:text-green-800 p-1 rounded"
                          title="Activate"
                          disabled={updating === user.user_id}
                        >
                          {updating === user.user_id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        </button>
                      )}
                      {user.status === 'active' && (
                        <button
                          onClick={() => updateUser(user.user_id, { status: 'suspended' })}
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          title="Suspend"
                          disabled={updating === user.user_id}
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
