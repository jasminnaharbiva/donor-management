import { Link } from 'react-router-dom';
import { Heart, Users, Activity, Sparkles } from 'lucide-react';

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden relative">
      <div className="absolute top-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
      </div>

      <nav className="relative z-10 w-full px-6 py-4 flex justify-between items-center glass-dark">
        <div className="flex items-center gap-2">
           <Heart className="text-pink-400" fill="currentColor" />
           <span className="font-bold text-xl tracking-tight text-white">Nonprofit DFB</span>
        </div>
        <div>
          <Link to="/login" className="text-white hover:text-primary-300 font-semibold px-4 py-2 transition-colors">Sign In</Link>
          <button className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-6 rounded-full shadow-lg hover:shadow-primary-500/50 transition-all ml-4">
            Donate Now
          </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 text-primary-700 font-semibold text-sm">
           <Sparkles size={16} className="text-amber-500" />
           <span>Empowering real-time generosity</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Fund the future, <br/><span className="bg-gradient-to-r from-primary-500 to-purple-600 bg-clip-text text-transparent">transparently.</span>
        </h1>
        
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
          Join thousands of donors who see the direct impact of their giving. Track allocations in real-time, earn badges, and manage your volunteer shifts all in one place.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
           <button className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-full shadow-xl transition-all flex justify-center items-center gap-2 text-lg">
             <Heart size={20} />
             Make a Contribution
           </button>
           <button className="glass hover:bg-white/90 text-slate-800 font-bold py-4 px-8 rounded-full shadow-lg transition-all flex justify-center items-center gap-2 text-lg">
             <Users size={20} />
             Become a Volunteer
           </button>
        </div>
      </main>

      <div className="relative z-10 bg-white border-t border-slate-200 mt-20">
         <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <Activity className="w-12 h-12 text-primary-500 mx-auto mb-4" />
               <h3 className="font-bold text-xl mb-2 text-slate-800">Real-Time Impact</h3>
               <p className="text-slate-500 tracking-wide">Live thermometers update instantly via our WebSocket array the moment your payment clears.</p>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <Users className="w-12 h-12 text-purple-500 mx-auto mb-4" />
               <h3 className="font-bold text-xl mb-2 text-slate-800">Peer to Peer</h3>
               <p className="text-slate-500 tracking-wide">Start your own sub-campaigns and leverage your network to amplify our reach.</p>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
               <h3 className="font-bold text-xl mb-2 text-slate-800">Gamification</h3>
               <p className="text-slate-500 tracking-wide">Unlock exclusive achievement badges as your lifetime giving profile grows.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
