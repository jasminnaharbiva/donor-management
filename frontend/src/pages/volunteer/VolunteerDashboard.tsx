import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Calendar, Clock, Star, Edit3 } from 'lucide-react';

export default function VolunteerDashboard() {

  const menuItems = [
    { name: 'Shift Signups', path: '/volunteer/shifts', icon: <Calendar size={20} /> },
    { name: 'My Timesheets', path: '/volunteer/timesheets', icon: <Clock size={20} /> },
  ];

  return (
    <DashboardLayout title="Volunteer Portal" role="Volunteer" menuItems={menuItems}>
       <Routes>
         <Route path="/" element={<Navigate to="shifts" replace />} />
         
         <Route path="shifts" element={
           <div className="space-y-6">
             <div className="glass rounded-xl p-6 flex justify-between items-center text-slate-800">
               <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-1"><Star className="text-primary-500" /> Upcoming Shifts</h3>
                  <p className="text-sm text-slate-500">Pick up open slots to support our upcoming campaigns.</p>
               </div>
             </div>
             {/* Stubs for shifts UI */}
             <div className="bg-white/50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                Fetching open shift assignments...
             </div>
           </div>
         } />

         <Route path="timesheets" element={
           <div className="space-y-6">
             <div className="glass rounded-xl p-6 flex justify-between items-center text-slate-800">
               <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-1"><Edit3 className="text-primary-500" /> Log Timecard</h3>
                  <p className="text-sm text-slate-500">Submit your worked hours for admin approval.</p>
               </div>
             </div>
             {/* Stubs for timesheets UI */}
             <div className="bg-white/50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                Loading shift history...
             </div>
           </div>
         } />
       </Routes>
    </DashboardLayout>
  );
}
