import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Shield, Plus, Lock } from 'lucide-react';

interface Role {
  role_id: number;
  role_name: string;
  description: string;
  is_system_role: boolean;
}

export default function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/admin/roles');
      setRoles(res.data.data);
    } catch (err) {
      console.error('Failed to load roles', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-primary-600" size={24} />
            Role Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">Configure system roles and permission matrices</p>
        </div>
        <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold shadow-sm">
          <Plus size={18} />
          Create Custom Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.role_id} className="glass rounded-xl p-6 border border-slate-200 hover:border-primary-200 transition-all group flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {role.role_name}
                  {role.is_system_role && (
                    <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Lock size={12} /> System
                    </span>
                  )}
                </h3>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-6 flex-1">
              {role.description || 'No description provided.'}
            </p>
            
            <div className="pt-4 border-t border-slate-100 mt-auto">
              <button className="text-sm font-semibold text-primary-600 hover:text-primary-800 transition-colors w-full text-left flex items-center justify-between">
                <span>Manage Permissions</span>
                <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
