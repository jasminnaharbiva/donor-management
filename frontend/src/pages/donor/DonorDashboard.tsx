import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { Heart, Trophy, CreditCard, Activity } from 'lucide-react';
import api from '../../services/api';
import { io } from 'socket.io-client';

interface Badge {
  badge_name: string;
  description: string;
  icon_url: string;
  awarded_at: string;
}

function Overview() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [liveDonationFeed, setLiveDonationFeed] = useState<string[]>([]);
  
  useEffect(() => {
    // Fetch Badges
    api.get('/advanced/badges/me').then(res => setBadges(res.data.data)).catch(console.error);

    // Setup Socket.IO
    const socket = io('http://localhost:3000', { transports: ['websocket'] });
    
    // Listen to global fund updates (assuming fund 1 is general)
    socket.emit('subscribe_to_fund', 1);
    
    socket.on('fund_updated', (data) => {
      setLiveDonationFeed(prev => [
        `Anonymous donor just gave $${data.amountAdded}!`,
        ...prev.slice(0, 4)
      ]);
    });

    return () => { socket.disconnect(); };
  }, []);

  return (
    <div className="space-y-6">
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-primary-500">
             <div className="p-4 bg-primary-100 text-primary-600 rounded-full"><Heart size={28} /></div>
             <div><p className="text-sm font-semibold text-slate-500">Lifetime Giving</p><p className="text-2xl font-bold text-slate-800">$1,450</p></div>
          </div>
          <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-purple-500">
             <div className="p-4 bg-purple-100 text-purple-600 rounded-full"><Activity size={28} /></div>
             <div><p className="text-sm font-semibold text-slate-500">Active Subscriptions</p><p className="text-2xl font-bold text-slate-800">1</p></div>
          </div>
          <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-amber-500">
             <div className="p-4 bg-amber-100 text-amber-600 rounded-full"><Trophy size={28} /></div>
             <div><p className="text-sm font-semibold text-slate-500">Gamification Badges</p><p className="text-2xl font-bold text-slate-800">{badges.length}</p></div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Badges Section */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Trophy className="text-amber-500" /> Your Achievements</h3>
            {badges.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Make your first donation to earn a badge!</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                 {badges.map((b, i) => (
                    <div key={i} className="bg-slate-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 hover:shadow-md transition">
                      <div className="text-4xl">{b.icon_url || '🏅'}</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{b.badge_name}</h4>
                        <p className="text-xs text-slate-500">{b.description}</p>
                      </div>
                    </div>
                 ))}
              </div>
            )}
          </div>

          {/* Live Activity Feed */}
          <div className="glass rounded-xl p-6">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity className="text-green-500" /> Live Global Activity</h3>
             <ul className="space-y-4">
               {liveDonationFeed.length === 0 ? (
                 <p className="text-slate-500 text-center py-8">Waiting for real-time events...</p>
               ) : (
                 liveDonationFeed.map((msg, i) => (
                   <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-700 bg-green-50 p-3 rounded-lg border border-green-100 animate-in slide-in-from-left">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                     {msg}
                   </li>
                 ))
               )}
             </ul>
          </div>
       </div>

    </div>
  );
}

export default function DonorDashboard() {
  const { user } = useAuth();
  const menuItems = [
    { name: 'Overview', path: '/donor/overview', icon: <Activity size={20} /> },
    { name: 'My Donations', path: '/donor/history', icon: <Heart size={20} /> },
    { name: 'Payment Methods', path: '/donor/billing', icon: <CreditCard size={20} /> },
  ];

  return (
    <DashboardLayout title="Donor Portal" role={user?.role || 'Donor'} menuItems={menuItems}>
      <Routes>
        <Route path="/" element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="history" element={<div className="glass p-6 rounded-xl text-slate-500 text-center">Donation History mapping stub</div>} />
        <Route path="billing" element={<div className="glass p-6 rounded-xl text-slate-500 text-center">Billing stub</div>} />
      </Routes>
    </DashboardLayout>
  );
}
