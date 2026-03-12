import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Bell, Settings, Megaphone, RefreshCw, Mail, Smartphone,
  CheckCheck, Search, Loader2, AlertCircle, Edit2, Send, X
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================
interface NotifRule {
  rule_id: number;
  event_type: string;
  label: string;
  description: string;
  is_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_subject: string;
  email_body: string;
  recipients: 'user' | 'admin' | 'both';
}

interface NotifLog {
  notification_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  sent_at: string;
  recipient_email: string;
  recipient_name: string;
}

// =============================================================================
// Toggle Switch component
// =============================================================================
function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-green-500' : 'bg-slate-300'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-1'}`} />
    </button>
  );
}

// =============================================================================
// Rule Edit Modal
// =============================================================================
function RuleEditModal({ rule, onClose, onSaved }: { rule: NotifRule; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    email_subject: rule.email_subject || '',
    email_body:    rule.email_body || '',
    recipients:    rule.recipients,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/notifications/rules/${rule.event_type}`, form);
      setMsg('Saved!');
      setTimeout(() => { setMsg(''); onSaved(); onClose(); }, 1200);
    } catch { setMsg('Save failed'); }
    setSaving(false);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await api.post(`/notifications/rules/${rule.event_type}/test`);
      setMsg('Test sent! Check your email and notification bell.');
      setTimeout(() => setMsg(''), 4000);
    } catch { setMsg('Test failed'); }
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Edit2 size={18} className="text-primary-600" /> Edit: {rule.label}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Recipients */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Recipients</label>
            <select value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value as any }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              <option value="user">User only</option>
              <option value="admin">Admin only</option>
              <option value="both">Both user & admin</option>
            </select>
          </div>

          {/* Email Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Email Subject <span className="text-slate-400 normal-case font-normal">(supports {'{{variable}}'} placeholders)</span>
            </label>
            <input value={form.email_subject} onChange={e => setForm(f => ({ ...f, email_subject: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g. ✅ Your donation of {{formattedAmount}} is confirmed" />
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Email Body <span className="text-slate-400 normal-case font-normal">(HTML supported)</span>
            </label>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-2.5 mb-2 text-xs text-primary-700">
              <strong>Available variables:</strong> {'{{firstName}}'} {'{{formattedAmount}}'} {'{{amount}}'} {'{{currency}}'} {'{{transactionId}}'} {'{{campaignName}}'} {'{{fundName}}'} {'{{date}}'} {'{{purpose}}'} {'{{reason}}'} {'{{status}}'} {'{{title}}'} {'{{message}}'} {'{{resetUrl}}'}
            </div>
            <textarea value={form.email_body} onChange={e => setForm(f => ({ ...f, email_body: e.target.value }))}
              rows={10}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="<p>Hi {{firstName}},</p><p>Your donation of <strong>{{formattedAmount}}</strong> has been received.</p>" />
          </div>

          {msg && <div className={`p-3 rounded-lg text-sm ${msg.includes('fail') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t bg-slate-50">
          <button onClick={sendTest} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-100 disabled:opacity-50">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Test
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Panel
// =============================================================================
export default function NotificationsAdminPanel() {
  const [tab, setTab] = useState<'rules' | 'log'>('rules');

  // --- Rules state ---
  const [rules, setRules] = useState<NotifRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [editRule, setEditRule] = useState<NotifRule | null>(null);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  // --- Log state ---
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [logMeta, setLogMeta] = useState({ total: 0, page: 1 });
  const [logLoading, setLogLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logType, setLogType] = useState('');

  // --- Broadcast state ---
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', message: '', target: 'all' });
  const [sending, setSending] = useState(false);

  // --- Shared ---
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load rules
  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await api.get('/notifications/rules');
      setRules(res.data.data || []);
    } catch { setError('Failed to load notification rules'); }
    setRulesLoading(false);
  }, []);

  // Load log
  const loadLog = useCallback(async (page = 1) => {
    setLogLoading(true);
    try {
      const params: any = { page, limit: 25 };
      if (logType)   params.type = logType;
      if (logSearch) params.search = logSearch;
      const res = await api.get('/notifications/admin-log', { params });
      setLogs(res.data.data || []);
      setLogMeta({ total: res.data.meta?.total || 0, page });
    } catch { setError('Failed to load notification log'); }
    setLogLoading(false);
  }, [logType, logSearch]);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { if (tab === 'log') loadLog(); }, [tab, loadLog]);

  // Toggle rule field
  const toggleRule = async (rule: NotifRule, field: 'is_enabled' | 'in_app_enabled' | 'email_enabled', value: boolean) => {
    const key = `${rule.event_type}:${field}`;
    setToggling(t => ({ ...t, [key]: true }));
    try {
      await api.patch(`/notifications/rules/${rule.event_type}`, { [field]: value });
      setRules(rs => rs.map(r => r.event_type === rule.event_type ? { ...r, [field]: value } : r));
    } catch { setError('Failed to update rule'); }
    setToggling(t => ({ ...t, [key]: false }));
  };

  // Broadcast
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/notifications/broadcast', broadcast);
      setSuccess(`Broadcast sent to ${res.data.data?.count || 'all'} users!`);
      setShowBroadcast(false);
      setBroadcast({ title: '', message: '', target: 'all' });
      setTimeout(() => setSuccess(''), 4000);
    } catch { setError('Failed to send broadcast'); }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
            <Bell size={22} className="text-primary-600" /> Notification System
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage notification rules, email templates, and view the notification log</p>
        </div>
        <button onClick={() => setShowBroadcast(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 transition-colors">
          <Megaphone size={16} /> Broadcast
        </button>
      </div>

      {/* Alerts */}
      {error   && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl"><AlertCircle size={16}/>{error}<button onClick={() => setError('')} className="ml-auto"><X size={14}/></button></div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl"><CheckCheck size={16}/>{success}</div>}

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Megaphone size={18} className="text-orange-600"/>Send Broadcast</h3>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <input required placeholder="Title" value={broadcast.title} onChange={e => setBroadcast(b => ({ ...b, title: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400" />
              <textarea required placeholder="Message…" value={broadcast.message} onChange={e => setBroadcast(b => ({ ...b, message: e.target.value }))}
                rows={4} className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-400" />
              <select value={broadcast.target} onChange={e => setBroadcast(b => ({ ...b, target: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="all">All Users</option>
                <option value="donors">Donors Only</option>
                <option value="volunteers">Volunteers Only</option>
              </select>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setShowBroadcast(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={sending}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {sending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200">
        {(['rules', 'log'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap flex-shrink-0 flex items-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'rules' ? <Settings size={15} /> : <Bell size={15} />}
            {t === 'rules' ? 'Notification Rules' : 'Notification Log'}
          </button>
        ))}
      </div>

      {/* ====================================================================
          TAB 1: NOTIFICATION RULES
      ==================================================================== */}
      {tab === 'rules' && (
        <div className="space-y-4">
          {rulesLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-500"/></div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-5 py-3 text-left text-slate-600 font-semibold">Event</th>
                      <th className="px-4 py-3 text-center text-slate-600 font-semibold">Enabled</th>
                      <th className="px-4 py-3 text-center text-slate-600 font-semibold flex items-center gap-1 justify-center"><Smartphone size={13}/> In-App</th>
                      <th className="px-4 py-3 text-center text-slate-600 font-semibold"><div className="flex items-center gap-1 justify-center"><Mail size={13}/> Email</div></th>
                      <th className="px-4 py-3 text-center text-slate-600 font-semibold">Recipients</th>
                      <th className="px-4 py-3 text-center text-slate-600 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rules.map(rule => (
                      <tr key={rule.rule_id} className={`hover:bg-slate-50 transition-colors ${!rule.is_enabled ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900">{rule.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{rule.event_type}</p>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Toggle
                            checked={Boolean(rule.is_enabled)}
                            onChange={v => toggleRule(rule, 'is_enabled', v)}
                            disabled={toggling[`${rule.event_type}:is_enabled`]}
                          />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Toggle
                            checked={Boolean(rule.in_app_enabled)}
                            onChange={v => toggleRule(rule, 'in_app_enabled', v)}
                            disabled={!rule.is_enabled || toggling[`${rule.event_type}:in_app_enabled`]}
                          />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Toggle
                            checked={Boolean(rule.email_enabled)}
                            onChange={v => toggleRule(rule, 'email_enabled', v)}
                            disabled={!rule.is_enabled || toggling[`${rule.event_type}:email_enabled`]}
                          />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${rule.recipients === 'admin' ? 'bg-purple-100 text-purple-700' :
                              rule.recipients === 'both'  ? 'bg-primary-100 text-primary-700' :
                              'bg-green-100 text-green-700'}`}>
                            {rule.recipients}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={() => setEditRule(rule)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                            <Edit2 size={12} /> Edit Template
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rules.length === 0 && (
                  <div className="py-16 text-center text-slate-400">No notification rules found</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: NOTIFICATION LOG
      ==================================================================== */}
      {tab === 'log' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={logSearch} onChange={e => { setLogSearch(e.target.value); loadLog(1); }}
                placeholder="Search title or email…"
                className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500"/>
            </div>
            <select value={logType} onChange={e => { setLogType(e.target.value); loadLog(1); }}
              className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
              <option value="">All Types</option>
              <option value="donation_received">Donation Received</option>
              <option value="high_value_donation_alert">High-Value Donation</option>
              <option value="expense_approved">Expense Approved</option>
              <option value="expense_rejected">Expense Rejected</option>
              <option value="announcement">Announcement</option>
              <option value="welcome">Welcome</option>
            </select>
            <button onClick={() => loadLog(logMeta.page)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
              <RefreshCw size={18}/>
            </button>
          </div>

          {logLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-500"/></div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-slate-50 text-sm text-slate-500">
                {logMeta.total} total notifications
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-5 py-3 text-left text-slate-600 font-semibold">Title</th>
                      <th className="px-4 py-3 text-left text-slate-600 font-semibold">Recipient</th>
                      <th className="px-4 py-3 text-left text-slate-600 font-semibold">Type</th>
                      <th className="px-4 py-3 text-left text-slate-600 font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-slate-600 font-semibold">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-16 text-slate-400">No notifications found</td></tr>
                    ) : logs.map(log => (
                      <tr key={log.notification_id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900 truncate max-w-xs">{log.title}</p>
                          {log.body && <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{log.body}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{log.recipient_name || '—'}</p>
                          <p className="text-xs text-slate-400">{log.recipient_email || ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium capitalize">
                            {log.type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.is_read ? 'bg-slate-100 text-slate-600' : 'bg-yellow-100 text-yellow-700'}`}>
                            {log.is_read ? 'Read' : 'Unread'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(log.sent_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {logMeta.total > 25 && (
                <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-slate-500">
                  <span>Page {logMeta.page} of {Math.ceil(logMeta.total / 25)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => loadLog(logMeta.page - 1)} disabled={logMeta.page === 1}
                      className="px-3 py-1 border rounded-lg hover:bg-slate-50 disabled:opacity-40">← Prev</button>
                    <button onClick={() => loadLog(logMeta.page + 1)} disabled={logMeta.page >= Math.ceil(logMeta.total / 25)}
                      className="px-3 py-1 border rounded-lg hover:bg-slate-50 disabled:opacity-40">Next →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Rule Modal */}
      {editRule && (
        <RuleEditModal
          rule={editRule}
          onClose={() => setEditRule(null)}
          onSaved={loadRules}
        />
      )}
    </div>
  );
}
