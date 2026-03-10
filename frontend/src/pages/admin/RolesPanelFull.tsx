import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Shield, Plus, Save } from 'lucide-react';

interface Role {
  role_id: number;
  role_name: string;
  description: string;
  is_system_role: boolean;
}

interface Permission {
  permission_id: number;
  resource: string;
  action: string;
}

const RESOURCES = ['expenses', 'donors', 'funds', 'reports', 'settings', 'api_keys', 'users', 'campaigns', 'volunteers', 'beneficiaries', 'announcements'];
const ACTIONS = ['view', 'create', 'update', 'delete', 'approve', 'reject', 'export'];

export default function RolesPanelFull() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    api.get('/admin/roles').then(r => {
      setRoles(r.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectRole = async (role: Role) => {
    setSelectedRole(role);
    const res = await api.get(`/admin/roles/${role.role_id}/permissions`);
    const perms: Permission[] = res.data.data;
    const m: Record<string, Record<string, boolean>> = {};
    RESOURCES.forEach(r => { m[r] = {}; ACTIONS.forEach(a => { m[r][a] = false; }); });
    perms.forEach(p => { if (m[p.resource]) m[p.resource][p.action] = true; });
    setMatrix(m);
  };

  const togglePerm = (resource: string, action: string) => {
    setMatrix(prev => ({
      ...prev,
      [resource]: { ...prev[resource], [action]: !prev[resource]?.[action] }
    }));
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    const permsToSave: any[] = [];
    RESOURCES.forEach(resource => {
      ACTIONS.forEach(action => {
        if (matrix[resource]?.[action]) permsToSave.push({ resource, action });
      });
    });
    try {
      await api.put(`/admin/roles/${selectedRole.role_id}/permissions`, { permissions: permsToSave });
      alert('Permissions saved!');
    } catch { alert('Failed to save permissions'); }
    setSaving(false);
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      await api.post('/admin/roles', { roleName: newRoleName, description: newRoleDesc });
      const res = await api.get('/admin/roles');
      setRoles(res.data.data);
      setNewRoleName('');
      setNewRoleDesc('');
    } catch { alert('Failed to create role'); }
    setCreating(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Shield className="text-primary-500" /> Role Management</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-semibold text-slate-700 mb-4">All Roles</h3>
          <div className="space-y-2 mb-6">
            {roles.map(role => (
              <button
                key={role.role_id}
                onClick={() => selectRole(role)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all text-sm font-medium border ${
                  selectedRole?.role_id === role.role_id
                    ? 'bg-primary-600 text-white border-primary-600 shadow'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-primary-300 hover:bg-primary-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{role.role_name}</span>
                  {role.is_system_role && <span className="text-xs opacity-70">System</span>}
                </div>
                {role.description && <p className={`text-xs mt-0.5 ${selectedRole?.role_id === role.role_id ? 'text-primary-100' : 'text-slate-400'}`}>{role.description}</p>}
              </button>
            ))}
          </div>

          {/* Create Role */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Create New Role</p>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
              placeholder="Role name"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
            />
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
              placeholder="Description (optional)"
              value={newRoleDesc}
              onChange={e => setNewRoleDesc(e.target.value)}
            />
            <button
              onClick={createRole}
              disabled={creating || !newRoleName}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Role
            </button>
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="col-span-2 glass rounded-xl p-6 overflow-x-auto">
          {!selectedRole ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <Shield size={48} className="mx-auto mb-3 opacity-30" />
                <p>Select a role to manage permissions</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">
                  Permissions for <span className="text-primary-600">{selectedRole.role_name}</span>
                </h3>
                <button
                  onClick={savePermissions}
                  disabled={saving || selectedRole.is_system_role && selectedRole.role_name === 'Super Admin'}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Permissions
                </button>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 bg-slate-50 rounded-l font-semibold text-slate-600 w-32">Resource</th>
                    {ACTIONS.map(a => (
                      <th key={a} className="py-2 px-2 bg-slate-50 font-semibold text-slate-600 text-center capitalize text-xs">{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map((resource, idx) => (
                    <tr key={resource} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-2 px-3 font-medium text-slate-700 capitalize">{resource}</td>
                      {ACTIONS.map(action => (
                        <td key={action} className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={matrix[resource]?.[action] || false}
                            onChange={() => togglePerm(resource, action)}
                            disabled={selectedRole.is_system_role && selectedRole.role_name === 'Super Admin'}
                            className="w-4 h-4 accent-primary-600 cursor-pointer disabled:cursor-default"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
