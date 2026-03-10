import { ReactNode, useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U';

  const displayName = user?.email || 'User';
  const displayRole = user?.role || role;

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
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 bg-slate-800/50 border-b border-slate-700">
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">DFB Portal</span>
            <button className="lg:hidden text-slate-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>

          {/* Sidebar user info */}
          <div className="px-4 py-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-primary-400 font-medium">{displayRole}</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <div className="px-4 py-5 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{role} Menu</p>
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

          {/* Sidebar footer */}
          <div className="p-4 border-t border-slate-800">
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

      {/* Main Content */}
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

          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button
              className="h-9 w-9 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              title="Notifications"
            >
              <Bell size={18} />
            </button>

            {/* User profile dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                title="My account"
              >
                <div className="h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold text-sm">
                  {initials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{displayName}</p>
                  <p className="text-xs text-primary-600 font-medium">{displayRole}</p>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform hidden sm:block ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                        <span className="inline-block text-xs bg-primary-100 text-primary-700 font-semibold px-2 py-0.5 rounded-full mt-0.5">
                          {displayRole}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="py-1">
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                      <User size={16} className="text-slate-400" />
                      My Profile
                    </button>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
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
