import clsx from 'clsx';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, LayoutDashboard, Play, StopCircle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function TaskItem({ task, isAdmin, onStart, onComplete, onStop, onDelete, depth = 0 }: any) {
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

export function StatsCard({ icon, label, value, subValue, color }: any) {
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
