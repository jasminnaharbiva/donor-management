import { ReactNode, useCallback, useEffect, useState } from 'react';
import { FileBadge2, Award, Bell, Loader2 } from 'lucide-react';
import api from '../../services/api';

type Tab = 'id-cards' | 'certificates' | 'messages';

interface IdCard {
  card_id: string;
  issue_date: string;
  expiry_date: string | null;
  status: string;
  template_name: string;
}

interface Certificate {
  award_id: string;
  issue_date: string;
  expires_at: string | null;
  verification_code: string;
  template_name: string;
}

interface DonorMessage {
  message_id: string;
  subject: string;
  body: string;
  channel: string;
  is_read: number | boolean;
  sent_at: string;
}

export default function DonorRecordsPage() {
  const [tab, setTab] = useState<Tab>('id-cards');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [cards, setCards] = useState<IdCard[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [messages, setMessages] = useState<DonorMessage[]>([]);

  const openHtml = (html: string, title: string) => {
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Please allow popups to preview your document.');
      return;
    }
    popup.document.write(`<html><head><title>${title}</title></head><body style=\"margin:0;padding:16px;background:#f8fafc;\">${html}</body></html>`);
    popup.document.close();
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'id-cards') {
        const res = await api.get('/donor-records/my/id-cards');
        setCards(res.data?.data || []);
      }
      if (tab === 'certificates') {
        const res = await api.get('/donor-records/my/certificates');
        setCertificates(res.data?.data || []);
      }
      if (tab === 'messages') {
        const res = await api.get('/donor-records/my/messages');
        setMessages(res.data?.data || []);
      }
    } catch {
      setError('Failed to load your records.');
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const viewCardRender = async (cardId: string) => {
    try {
      const res = await api.get(`/donor-records/my/id-cards/${cardId}/render`);
      const html = res.data?.data?.rendered_html;
      if (html) openHtml(html, 'My Donor ID Card');
    } catch {
      setError('Could not open ID card preview.');
    }
  };

  const viewCertificateRender = async (awardId: string) => {
    try {
      const res = await api.get(`/donor-records/my/certificates/${awardId}/render`);
      const html = res.data?.data?.rendered_html;
      if (html) openHtml(html, 'My Donor Certificate');
    } catch {
      setError('Could not open certificate preview.');
    }
  };

  const markRead = async (messageId: string) => {
    try {
      await api.patch(`/donor-records/my/messages/${messageId}/read`);
      setMessages(prev => prev.map(m => m.message_id === messageId ? { ...m, is_read: true } : m));
    } catch {
      setError('Could not update message status.');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">My Records & Certificates</h2>

      {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {([
          { key: 'id-cards', label: 'My ID Cards', icon: <FileBadge2 size={16} /> },
          { key: 'certificates', label: 'My Certificates', icon: <Award size={16} /> },
          { key: 'messages', label: 'My Messages', icon: <Bell size={16} /> },
        ] as Array<{ key: Tab; label: string; icon: ReactNode }>).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border inline-flex items-center gap-2 ${tab === item.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-500" size={30} /></div>
      )}

      {!loading && tab === 'id-cards' && (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.card_id} className="glass rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800">{card.template_name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Issued: {new Date(card.issue_date).toLocaleDateString()} •
                  {card.expiry_date ? ` Expires: ${new Date(card.expiry_date).toLocaleDateString()}` : ' No expiry'}
                </div>
                <div className="text-xs mt-1">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${card.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{card.status}</span>
                </div>
              </div>
              <button onClick={() => viewCardRender(card.card_id)} className="px-3 py-2 rounded-lg text-sm bg-primary-600 text-white">View ID</button>
            </div>
          ))}
          {cards.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">No ID cards issued yet.</div>}
        </div>
      )}

      {!loading && tab === 'certificates' && (
        <div className="space-y-3">
          {certificates.map(cert => (
            <div key={cert.award_id} className="glass rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800">{cert.template_name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Issued: {new Date(cert.issue_date).toLocaleDateString()} •
                  {cert.expires_at ? ` Expires: ${new Date(cert.expires_at).toLocaleDateString()}` : ' No expiry'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Verification: {cert.verification_code}</div>
              </div>
              <button onClick={() => viewCertificateRender(cert.award_id)} className="px-3 py-2 rounded-lg text-sm bg-primary-600 text-white">View Certificate</button>
            </div>
          ))}
          {certificates.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">No certificates awarded yet.</div>}
        </div>
      )}

      {!loading && tab === 'messages' && (
        <div className="space-y-3">
          {messages.map(message => (
            <div key={message.message_id} className={`rounded-xl border p-4 ${message.is_read ? 'bg-white border-slate-200' : 'bg-primary-50 border-primary-200'}`}>
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-800">{message.subject}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{new Date(message.sent_at).toLocaleString()} • {message.channel}</div>
                </div>
                {!message.is_read && (
                  <button onClick={() => markRead(message.message_id)} className="text-xs text-primary-600 hover:underline">Mark read</button>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{message.body}</p>
            </div>
          ))}
          {messages.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">No messages yet.</div>}
        </div>
      )}
    </div>
  );
}
