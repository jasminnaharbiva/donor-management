import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';

interface Notification {
  notification_id: string;
  type: string;
  title: string;
  body: string;
  action_url?: string;
  is_read: boolean;
  sent_at: string;
}

interface NotifMeta {
  unread: number;
  total: number;
}

const TYPE_ICONS: Record<string, string> = {
  donation_received:         '💰',
  high_value_donation_alert: '🔔',
  expense_approved:          '✅',
  expense_rejected:          '❌',
  welcome:                   '🎉',
  announcement:              '📢',
  campaign_milestone:        '🏆',
  fund_low:                  '⚠️',
  timesheet_reviewed:        '📋',
  volunteer_app_reviewed:    '👤',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<NotifMeta>({ unread: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { socket } = useSocket();

  const fetch = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications?limit=15');
      setNotifications(res.data.data || []);
      setMeta({ unread: res.data.meta?.unread || 0, total: res.data.meta?.total || 0 });
    } catch { /* silent fail */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [fetch]);

  // Listen for real-time new notifications
  useEffect(() => {
    if (!socket) return;
    const handler = (notif: any) => {
      setNotifications(prev => [{
        notification_id: `rt-${Date.now()}`,
        type:     notif.type || 'system_alert',
        title:    notif.title || 'New Notification',
        body:     notif.body || '',
        action_url: notif.actionUrl,
        is_read:  false,
        sent_at:  notif.sentAt || new Date().toISOString(),
      }, ...prev.slice(0, 14)]);
      setMeta(m => ({ ...m, unread: m.unread + 1 }));
    };
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket]);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
      setMeta(m => ({ ...m, unread: Math.max(0, m.unread - 1) }));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setMeta(m => ({ ...m, unread: 0 }));
    } catch { /* silent */ }
  };

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
      setMeta(m => ({ ...m, total: Math.max(0, m.total - 1) }));
    } catch { /* silent */ }
  };

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) markRead(notif.notification_id);
    if (notif.action_url) {
      setOpen(false);
      navigate(notif.action_url);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000)  return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetch(); }}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
        aria-label="Notifications"
        id="notification-bell-btn"
      >
        <Bell size={20} />
        {meta.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {meta.unread > 99 ? '99+' : meta.unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
          style={{ maxHeight: '520px', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-blue-600" />
              <span className="font-semibold text-slate-800 text-sm">Notifications</span>
              {meta.unread > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {meta.unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {meta.unread > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.notification_id}
                  onClick={() => handleClick(notif)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors group
                    ${notif.is_read ? 'hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                >
                  <div className="mt-0.5 text-xl flex-shrink-0">
                    {TYPE_ICONS[notif.type] || '🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug truncate ${notif.is_read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notif.sent_at)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {!notif.is_read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />
                    )}
                    <button
                      onClick={(e) => deleteNotif(notif.notification_id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {meta.total > 15 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-center">
              <button
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                View all {meta.total} notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
