import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User } from 'lucide-react';

interface SidebarItem {
  name: string;
  path: string;
  icon: ReactNode;
}

interface DashboardLayoutProps {
  children: ReactNode;
  menuItems: SidebarItem[];
  title: string;
  role: string;
}

export default function DashboardLayout({ children, menuItems, title, role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-background-light">
      
      {/* Mobile sidebar overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between h-16 px-4 bg-slate-800/50 border-b border-slate-700">
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">DFB Portal</span>
            <button className="lg:hidden text-slate-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <div className="px-4 py-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{role} Menu</p>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive 
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.icon}
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-4 border-t border-slate-800">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Worker */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top App Bar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-slate-500 hover:text-slate-700 focus:outline-none"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-semibold text-slate-800 hidden sm:block">{title}</h1>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center border border-primary-200">
                <User size={16} />
             </div>
          </div>
        </header>

        {/* Page Body Context */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
             <h1 className="text-2xl font-bold text-slate-800 sm:hidden mb-6">{title}</h1>
             {children}
          </div>
        </main>
      </div>
      
    </div>
  );
}
