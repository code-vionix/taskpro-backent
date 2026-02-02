import clsx from 'clsx';
import { Bell, ChevronRight, Home, List, LogOut, Settings, Shield } from 'lucide-react';
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#030712] text-slate-200 overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Sidebar */}
      <aside className="w-72 glass border-r border-white/5 flex flex-col z-20">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight uppercase italic leading-none">
                Task<span className="text-blue-500">Pro</span>
              </h1>
              <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">Enterprise</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          <div className="px-4 py-2 mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">General</div>
          <NavItem to="/" icon={<Home className="w-5 h-5"/>} label="Dashboard" />
          <NavItem to="/tasks" icon={<List className="w-5 h-5"/>} label="My Tasks" />
          
          {user?.role === 'ADMIN' && (
            <>
              <div className="px-4 py-2 mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Administration</div>
              <NavItem to="/admin" icon={<Shield className="w-5 h-5"/>} label="System Control" />
              <NavItem to="/settings" icon={<Settings className="w-5 h-5"/>} label="Configuration" />
            </>
          )}
        </nav>

        <div className="p-6 mt-auto">
          <div className="glass-card p-4 flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden">
               <span className="text-sm font-bold text-white">{user?.email[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-xs font-bold text-white truncate px-0">{user?.email.split('@')[0]}</p>
               <p className="text-[10px] text-slate-500 truncate lowercase">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20 shadow-lg shadow-rose-500/0 hover:shadow-rose-500/5 group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between z-10 backdrop-blur-sm bg-[#030712]/50">
           <div className="flex items-center gap-2 text-slate-500 text-sm">
             <span className="font-medium">System</span>
             <ChevronRight className="w-4 h-4" />
             <span className="text-white font-bold">{useLocation().pathname === '/' ? 'Dashboard' : 'Navigation'}</span>
           </div>
           <div className="flex items-center gap-4">
              <button className="p-2.5 glass-card rounded-xl text-slate-400 hover:text-white transition-colors relative">
                 <Bell className="w-5 h-5" />
                 <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border border-[#030712]"></span>
              </button>
              <div className="h-6 w-px bg-white/10 mx-2"></div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 hidden sm:block">UPTIME: 99.9%</span>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
             <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === to;
    
    return (
        <button
            onClick={() => navigate(to)}
            className={clsx(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                isActive 
                  ? "bg-blue-600/10 text-white border border-blue-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            )}
        >
            {isActive && (
              <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            )}
            <span className={clsx("transition-all duration-300", isActive ? "text-blue-400 scale-110" : "group-hover:scale-110")}>
                {icon}
            </span>
            <span className={clsx("font-bold text-sm tracking-wide", isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100")}>
              {label}
            </span>
            {!isActive && (
              <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-40 transition-all group-hover:translate-x-1" />
            )}
        </button>
    )
}
