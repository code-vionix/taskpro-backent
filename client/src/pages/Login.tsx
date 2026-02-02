import clsx from 'clsx';
import { Lock, LogIn, Mail, Shield, UserPlus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!error) return;

    const match = error.match(/Try again in (\d+) seconds/);
    if (match) {
      const seconds = parseInt(match[1], 10);
      if (seconds > 0) {
        const timer = setTimeout(() => {
          setError((prev) => prev.replace(/in \d+ seconds/, `in ${seconds - 1} seconds`));
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        setError((prev) => prev.replace(/Try again in \d+ seconds\./, 'You can try again now.'));
      }
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isRegister) {
        await api.post('/auth/register', { email, password });
        setIsRegister(false);
        setError('Registration successful! Please login.');
      } else {
        const res = await api.post('/auth/login', { email, password });
        const { access_token, refresh_token } = res.data;
        const base64Url = access_token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        
        login(access_token, refresh_token, { id: payload.sub, email: payload.username, role: payload.role });
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      </div>

      <div className="w-full max-w-md px-6 z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl premium-gradient flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/20 ring-4 ring-white/5">
             <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase italic leading-none">
            Task<span className="text-blue-500">Pro</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold tracking-[0.3em] uppercase mt-2">Enterprise Solutions</p>
        </div>

        <div className="glass p-8 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 premium-gradient opacity-50"></div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isRegister ? 'Initialize Access' : 'Secure Terminal'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isRegister ? 'Construct your authorized identity.' : 'Provide your encrypted credentials.'}
            </p>
          </div>
          
          {error && (
            <div className={clsx(
              "p-4 mb-6 rounded-xl text-sm font-medium border animate-in slide-in-from-top-2 duration-300",
              error.includes('successful') 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            )}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Universal Identifier</label>
              <div className="relative group/input">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within/input:text-blue-500 transition-colors" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/[0.05] text-white placeholder-slate-600 transition-all font-medium"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Security Keyphrase</label>
              <div className="relative group/input">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within/input:text-blue-500 transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/[0.05] text-white placeholder-slate-600 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full premium-gradient hover:opacity-90 text-white font-bold py-4 rounded-xl transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{isRegister ? 'Authorize Account' : 'Authenticate Access'}</span>
                  {isRegister ? <UserPlus className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> : <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-slate-500 hover:text-white text-xs font-bold tracking-wide transition-colors uppercase"
            >
              {isRegister ? 'Return to Primary Terminal' : "Initiate New Account Protocol"}
            </button>
          </div>
        </div>
        
        <p className="mt-8 text-center text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
          &copy; 2026 TASKPRO TECHNOLOGIES. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  );
}
