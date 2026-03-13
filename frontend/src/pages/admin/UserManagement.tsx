import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Users, Search, Edit2 } from 'lucide-react';

interface User {
  user_id: string;
  email: string;
  status: string;
  role_name: string;
  last_login_at: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="text-center sm:text-left">
          <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center gap-2">
            <Users className="text-primary-600" size={24} />
            User Management
          </h2>
          <p className="text-sm text-slate-500 mt-1 text-center sm:text-left">Manage system access, roles, and accounts</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search users by email..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none text-sm"
          />
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-4 px-6">User</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Last Login</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {users.map((user) => (
                <tr key={user.user_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-6">
                    <div className="font-medium text-slate-800">{user.email}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.user_id.split('-')[0]}...</div>
                  </td>
                  <td className="py-3 px-6">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {user.role_name}
                    </span>
                  </td>
                  <td className="py-3 px-6">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      user.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                      user.status === 'suspended' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-slate-500 whitespace-nowrap">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 px-6 text-right">
                    <button className="text-primary-600 hover:text-primary-800 p-1.5 hover:bg-primary-50 rounded transition-colors inline-block" title="Edit User">
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
