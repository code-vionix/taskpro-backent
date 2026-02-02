import { Lock, Save, Settings, User } from 'lucide-react';

export default function Configuration() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div>
           <div className="flex items-center gap-3 mb-2 text-blue-400">
            <Settings className="w-5 h-5" />
            <span className="text-xs font-bold tracking-widest uppercase">Settings</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
             Configuration
          </h1>
          <p className="text-slate-400 mt-2 max-w-lg">
             Manage your profile settings and preferences.
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-8">
          {/* Profile Section */}
          <section className="glass-card p-8">
              <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <User className="w-6 h-6" />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold text-white">Profile Settings</h2>
                      <p className="text-slate-400 text-sm">Update your personal information</p>
                  </div>
              </div>
              
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">First Name</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" defaultValue="John" />
                      </div>
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">Last Name</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" defaultValue="Doe" />
                      </div>
                  </div>
                   <div>
                      <label className="block text-sm text-slate-400 mb-1">Email Address</label>
                      <input type="email" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-500 cursor-not-allowed" defaultValue="user@taskpro.com" disabled />
                  </div>
              </div>
          </section>

          {/* Security Section */}
          <section className="glass-card p-8">
              <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                      <Lock className="w-6 h-6" />
                  </div>
                   <div>
                      <h2 className="text-xl font-bold text-white">Security</h2>
                      <p className="text-slate-400 text-sm">Manage your password and security settings</p>
                  </div>
              </div>

               <div className="space-y-4">
                  <div>
                      <label className="block text-sm text-slate-400 mb-1">Current Password</label>
                      <input type="password" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                   <div>
                      <label className="block text-sm text-slate-400 mb-1">New Password</label>
                      <input type="password" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
               </div>
          </section>

          <div className="flex justify-end">
              <button className="premium-gradient text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
                  <Save className="w-4 h-4" />
                  Save Changes
              </button>
          </div>
      </div>
    </div>
  );
}
