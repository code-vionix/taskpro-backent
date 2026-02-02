import { Calendar, Mail, Search, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function SystemControl() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2 text-blue-400">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold tracking-widest uppercase">Administration</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
             System Control
          </h1>
          <p className="text-slate-400 mt-2 max-w-lg">
             Manage users, roles, and system-wide configurations.
          </p>
        </div>
      </div>

       <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight">Registered Users ({users.length})</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search users..." 
                className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all w-64"
              />
            </div>
          </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">User</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Role</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Joined</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
                {users.map((u) => (
                    <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 text-white font-bold">
                                    {u.email[0].toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-white">{u.email.split('@')[0]}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> {u.email}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-500/20 text-slate-400'
                            }`}>
                                {u.role}
                            </span>
                        </td>
                        <td className="p-4">
                            <div className="text-sm text-slate-400 flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {new Date(u.createdAt).toLocaleDateString()}
                            </div>
                        </td>
                        <td className="p-4 text-right">
                             <button className="text-xs font-bold text-blue-400 hover:text-blue-300">Edit</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
