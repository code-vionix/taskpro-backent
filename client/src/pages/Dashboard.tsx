import clsx from 'clsx';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, Filter, LayoutDashboard, Play, Plus, Search, StopCircle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // Poll every 10s for updates
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStart = async (id: string) => {
      try {
          await api.patch(`/tasks/${id}/start`);
          fetchTasks();
      } catch (e) {
          alert('Failed to start task');
      }
  };

  const handleComplete = async (id: string) => {
      try {
          await api.patch(`/tasks/${id}/complete`);
          fetchTasks();
      } catch (e: any) {
          alert(e.response?.data?.message || 'Failed to complete task');
      }
  };

  const handleStop = async (id: string) => {
    try {
        await api.patch(`/tasks/${id}/stop`);
        fetchTasks();
    } catch (e) {
        alert('Failed to stop task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
        await api.delete(`/tasks/${id}`);
        fetchTasks();
    } catch (e) {
        alert('Failed to delete task');
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        isAdmin={user?.role === 'ADMIN'}
        onSuccess={fetchTasks}
      />
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2 text-blue-400">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs font-bold tracking-widest uppercase">Overview</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Welcome, {user?.role === 'ADMIN' ? 'Administrator' : user?.email.split('@')[0] || 'User'}
          </h1>
          <p className="text-slate-400 mt-2 max-w-lg">
            Manage your project tasks and monitor system performance from your central command center.
          </p>
        </div>
        {user?.role === 'ADMIN' && (
            <button onClick={() => setIsModalOpen(true)} className="premium-gradient text-white px-6 py-3 rounded-xl flex items-center gap-2 font-semibold shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1 active:scale-95 group">
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span>Create New Task</span>
            </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard icon={<Clock className="w-12 h-12 text-blue-400" />} label="Total Tasks" value={tasks.length} subValue="+12% from last week" color="blue" />
        <StatsCard icon={<CheckCircle2 className="w-12 h-12 text-emerald-400" />} label="Active Projects" value={tasks.filter(t => t.status === 'IN_PROGRESS').length} color="emerald" />
        <StatsCard icon={<AlertCircle className="w-12 h-12 text-rose-400" />} label="Paused/Stopped" value={tasks.filter(t => t.isStopped).length} color="rose" />
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white tracking-tight">Recent Activity</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search tasks..." 
                className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all w-64"
              />
            </div>
            <button className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
              <Filter className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {tasks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                 <LayoutDashboard className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No tasks available</h3>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {tasks.map((task) => (
                <TaskItem key={task.id} task={task} isAdmin={user?.role === 'ADMIN'} onStart={handleStart} onComplete={handleComplete} onStop={handleStop} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({ isOpen, onClose, isAdmin, onSuccess }: any) {
    if (!isOpen) return null;
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState('5');
    const [assignedToEmail, setAssignedToEmail] = useState('');
    const [type, setType] = useState('PRACTICE');

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/tasks', { 
                title, 
                description, 
                duration: parseInt(duration), 
                type,
                assignedToEmail: isAdmin ? assignedToEmail : undefined 
            });
            onSuccess();
            onClose();
            setTitle(''); setDescription('');
        } catch (err) {
            alert('Failed to create task');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-300">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><Plus className="w-6 h-6 rotate-45" /></button>
                <h3 className="text-2xl font-bold text-white mb-6">Create New Task</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Title</label>
                        <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Duration (mins)</label>
                            <input type="number" min="1" required value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                        </div>
                        <div>
                             <label className="block text-sm text-slate-400 mb-1">Type</label>
                             <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                                 <option value="PRACTICE" className="text-slate-900">Practice</option>
                                 <option value="EXAM" className="text-slate-900">Exam</option>
                             </select>
                        </div>
                    </div>
                    {isAdmin && (
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Assign To (Email)</label>
                            <input value={assignedToEmail} onChange={e => setAssignedToEmail(e.target.value)} placeholder="user@taskpro.com" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                        </div>
                    )}
                    <button disabled={loading} className="w-full premium-gradient text-white py-3 rounded-xl font-bold mt-4 hover:opacity-90 disabled:opacity-50">
                        {loading ? 'Creating...' : 'Create Task'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function StatsCard({ icon, label, value, subValue, color }: any) {
  return (
    <div className="glass-card p-6 flex items-center justify-between group hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">{label}</h3>
        <div className="text-4xl font-extrabold text-white tracking-tight mb-2 tabular-nums">
           {value}
        </div>
        {subValue && (
            <p className={clsx("text-xs font-bold", 
                color === 'blue' ? 'text-blue-400' : 
                color === 'emerald' ? 'text-emerald-400' : 
                'text-rose-400'
            )}>
              {subValue}
            </p>
        )}
      </div>
      <div className={clsx("relative z-10 p-4 rounded-2xl transition-all duration-300 border border-white/5", 
          color === 'blue' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-blue-500/10' : 
          color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-emerald-500/10' : 
          'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-rose-500/10'
      )}>
        {icon}
      </div>
    </div>
  )
}

function TaskItem({ task, isAdmin, onStart, onComplete, onStop, onDelete, depth = 0 }: any) {
    // ... state ...
    // Note: Re-implement formatTime/useEffect etc if needed, but assuming block replacement preserves context if strictly replacing.
    // Wait, I need to provide full TaskItem to be safe.
    
    const [expanded, setExpanded] = useState(false);
    const hasChildren = (task.subTasks && task.subTasks.length > 0) || (task.subSubTasks && task.subSubTasks.length > 0);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        if (task.status === 'IN_PROGRESS' && task.startedAt && task.duration && !task.isStopped) {
            const interval = setInterval(() => {
                const start = new Date(task.startedAt).getTime();
                const now = Date.now();
                const elapsed = (now - start) / 1000;
                const remaining = Math.max(0, task.duration - elapsed);
                setTimeLeft(remaining);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [task]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="transition-all duration-300">
            <div className={clsx("group p-5 flex items-center justify-between hover:bg-white/[0.02]", 
                depth > 0 && "border-l border-white/5 bg-white/[0.01]",
                { 'pl-10': depth === 1, 'pl-16': depth === 2 }
            )}>
                <div className="flex items-center gap-4">
                    {hasChildren && (
                        <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-white/10 rounded">
                            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </button>
                    )}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                        task.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-500' :
                        task.status === 'EXPIRED' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-slate-500/10 text-slate-500'
                    }`}>
                        {task.status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> :
                         task.status === 'IN_PROGRESS' ? <Clock className="w-6 h-6 animate-pulse" /> :
                         task.status === 'EXPIRED' ? <AlertCircle className="w-6 h-6" /> :
                         <LayoutDashboard className="w-6 h-6" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                             <h4 className={clsx("font-bold text-white group-hover:text-blue-400 transition-colors", depth > 0 && "text-sm")}>{task.title}</h4>
                             {task.type === 'EXAM' && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold">Exam</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                             <span className={clsx("text-[10px] uppercase font-bold px-2 py-0.5 rounded", {
                                 'bg-blue-500/20 text-blue-400': task.status === 'IN_PROGRESS',
                                 'bg-emerald-500/20 text-emerald-400': task.status === 'COMPLETED',
                                 'bg-rose-500/20 text-rose-400': task.status === 'EXPIRED',
                                 'bg-slate-500/20 text-slate-400': task.status === 'PENDING'
                             })}>{task.status}</span>
                             
                             {task.status === 'IN_PROGRESS' && timeLeft !== null && (
                                 <span className="text-xs font-mono font-bold text-blue-400 animate-pulse">
                                     {formatTime(timeLeft)} remaining
                                 </span>
                             )}
                             
                             {task.isStopped && task.status === 'IN_PROGRESS' && (
                                 <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                                     <StopCircle className="w-3 h-3" /> PAUSED
                                 </span>
                             )}

                            {task.description && <p className="text-sm text-slate-400 hidden md:block border-l border-white/10 pl-3 ml-1">{task.description}</p>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {/* User Actions */}
                        {!isAdmin && (
                            <>
                                {task.status === 'PENDING' && !task.isStopped && (
                                    <button onClick={() => onStart(task.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                                        <Play className="w-3 h-3" /> Start
                                    </button>
                                )}
                                {task.status === 'IN_PROGRESS' && !task.isStopped && (
                                     <>
                                        <button onClick={() => onComplete(task.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                                            <CheckCircle2 className="w-3 h-3" /> Submit
                                        </button>
                                        {task.type === 'PRACTICE' && (
                                            <button onClick={() => onStop(task.id)} className="p-2 hover:bg-slate-500/20 text-slate-400 hover:text-white rounded-lg transition-colors" title="Pause Task">
                                                <StopCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                     </>
                                )}
                                {task.isStopped && (
                                    <button onClick={() => onStart(task.id)} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                                        <Play className="w-3 h-3" /> Resume
                                    </button>
                                )}
                            </>
                        )}

                        {/* Admin Actions */}
                        {isAdmin && (
                            <>
                                {task.status === 'IN_PROGRESS' && !task.isStopped && (
                                    <button onClick={() => onStop(task.id)} className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors" title="Pause/Stop Task">
                                        <StopCircle className="w-4 h-4" />
                                    </button>
                                )}
                                {task.isStopped && task.status === 'IN_PROGRESS' && (
                                    <button onClick={() => onStart(task.id)} className="p-2 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors" title="Resume Task">
                                        <Play className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => onDelete(task.id)} className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors" title="Delete Forever">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {expanded && hasChildren && (
                <div>
                   {task.subTasks?.map((sub: any) => (
                       <TaskItem key={sub.id} task={sub} isAdmin={isAdmin} onStart={onStart} onComplete={onComplete} onStop={onStop} onDelete={onDelete} depth={depth + 1} />
                   ))}
                   {task.subSubTasks?.map((sub: any) => (
                       <TaskItem key={sub.id} task={sub} isAdmin={isAdmin} onStart={onStart} onComplete={onComplete} onStop={onStop} onDelete={onDelete} depth={depth + 1} />
                   ))}
                </div>
            )}
        </div>
    )
}
