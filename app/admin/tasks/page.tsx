"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';

interface FirestoreTimestamp {
  toDate: () => Date;
  toMillis: () => number;
}

interface Task {
  id: string;
  task_id: string;
  job_id?: string;
  task_type: string;
  queue_name: string;
  status: string;
  user_email?: string;
  error_details?: string;
  attempt_number?: number;
  metadata?: Record<string, unknown>;
  scheduled_at?: FirestoreTimestamp;
  started_at?: FirestoreTimestamp;
  resolved_at?: FirestoreTimestamp;
}

export default function TaskHistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [emailFilter, setEmailFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const qBase = collection(db, 'task_tracking');
    const conditions: any[] = [];

    if (typeFilter !== 'ALL') conditions.push(where('task_type', '==', typeFilter));
    if (statusFilter !== 'ALL') conditions.push(where('status', '==', statusFilter));
    if (emailFilter.trim() !== '') conditions.push(where('user_email', '==', emailFilter.trim()));

    conditions.push(orderBy('scheduled_at', 'desc'));

    const unsubscribe = onSnapshot(query(qBase, ...conditions), (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
      setTasks(taskData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [statusFilter, typeFilter, emailFilter]);

  const formatIST = (timestamp?: FirestoreTimestamp) => {
    if (!timestamp) return '--';
    return timestamp.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Latency Calculator
  const getDuration = (startTs?: FirestoreTimestamp, endTs?: FirestoreTimestamp) => {
    if (!startTs || !endTs) return null;
    const diffMs = endTs.toMillis() - startTs.toMillis();
    const secs = Math.floor(diffMs / 1000);
    const mins = Math.floor(secs / 60);
    return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
  };

  const getStatusBadge = (status: string, attempt: number) => {
    const isRetry = attempt > 0;
    const retryTag = isRetry ? <span className="ml-2 text-[9px] text-red-500 animate-pulse border border-red-500/50 px-1.5 py-0.5 font-bold tracking-widest">RETRY:{attempt}</span> : null;

    switch (status) {
      case 'SCHEDULED': return <div className="flex items-center gap-1"><span className="text-blue-400 font-mono text-xs border border-blue-400/30 px-2 py-1 bg-blue-400/10">SCHEDULED</span>{retryTag}</div>;
      case 'PROCESSING': return <div className="flex items-center gap-1"><span className="text-yellow-400 font-mono text-xs border border-yellow-400/30 px-2 py-1 bg-yellow-400/10 animate-pulse">PROCESSING</span>{retryTag}</div>;
      case 'COMPLETED': return <div className="flex items-center gap-1"><span className="text-green-500 font-mono text-xs border border-green-500/30 px-2 py-1 bg-green-500/10">COMPLETED</span>{retryTag}</div>;
      case 'FAILED': return <div className="flex items-center gap-1"><span className="text-red-500 font-mono text-xs border border-red-500/30 px-2 py-1 bg-red-500/10">FAILED</span>{retryTag}</div>;
      default: return <span className="text-[#666] font-mono text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

      {/* HEADER & FILTERS */}
      <div className="flex justify-between items-end border-b border-[#222] pb-6">
        <div>
          <h1 className="font-anton text-5xl text-white uppercase tracking-tighter leading-none">
            System <span className="text-red-600">Observability</span>
          </h1>
          <p className="text-[10px] font-mono text-[#666] mt-2 uppercase tracking-widest">
            Live Task Stream // {tasks.length} active records
          </p>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-[9px] text-[#666] font-mono mb-1 uppercase tracking-widest">User Email</label>
            <input
              type="text"
              placeholder="user@domain.com"
              className="bg-[#0a0a0a] border border-[#333] text-[10px] font-mono text-[#888] p-2.5 focus:border-red-600 focus:outline-none w-48 transition-colors"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] text-[#666] font-mono mb-1 uppercase tracking-widest">Task Type</label>
            <select
              className="bg-[#0a0a0a] border border-[#333] text-[10px] font-mono text-[#888] p-2.5 focus:border-red-600 focus:outline-none uppercase tracking-widest"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">ALL</option>
              <option value="script">SCRIPT</option>
              <option value="image">IMAGE</option>
              <option value="video">VIDEO</option>
              <option value="audio">AUDIO</option>
              <option value="adaptation">ADAPTATION</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] text-[#666] font-mono mb-1 uppercase tracking-widest">Status</label>
            <select
              className="bg-[#0a0a0a] border border-[#333] text-[10px] font-mono text-[#888] p-2.5 focus:border-red-600 focus:outline-none uppercase tracking-widest"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">ALL</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      {loading ? (
        <div className="flex items-center justify-center h-64 border border-[#222] bg-[#080808]">
          <span className="text-red-600 font-mono text-sm animate-pulse tracking-widest uppercase">Connecting to stream...</span>
        </div>
      ) : (
        <div className="border border-[#222] bg-[#080808] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222] bg-[#0A0A0A] text-[10px] font-mono text-[#666] uppercase tracking-widest">
                <th className="p-4 font-normal border-r border-[#222]">Identity</th>
                <th className="p-4 font-normal border-r border-[#222]">Context</th>
                <th className="p-4 font-normal border-r border-[#222]">Status &amp; Errors</th>
                <th className="p-4 font-normal">Telemetry (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {tasks.map((task) => {
                const queueTime = getDuration(task.scheduled_at, task.started_at);
                const execTime = getDuration(task.started_at, task.resolved_at);

                return (
                  <tr key={task.id} className="hover:bg-[#0E0E0E] transition-colors group">
                    <td className="p-4 align-top border-r border-[#222]">
                      <div className="font-mono text-sm text-white flex items-center gap-2">
                        {task.task_id?.substring(0, 8)}...
                        <button onClick={() => copyToClipboard(task.task_id)} className="text-[#444] hover:text-white transition-colors" title="Copy Task ID">⎘</button>
                      </div>
                      <div className="text-[10px] text-blue-400 mt-1">{task.user_email || 'SYSTEM'}</div>
                      <div className="font-mono text-[10px] text-[#444] mt-1 flex items-center gap-2">
                        JOB: {task.job_id ? `${task.job_id.substring(0, 8)}...` : 'N/A'}
                        {task.job_id && <button onClick={() => copyToClipboard(task.job_id!)} className="hover:text-white transition-colors" title="Copy Job ID">⎘</button>}
                      </div>
                    </td>

                    <td className="p-4 align-top border-r border-[#222]">
                      <div className="text-sm font-bold text-white uppercase">{task.task_type}</div>
                      <div className="font-mono text-[10px] text-[#555] mt-1 uppercase">{task.queue_name}</div>

                      {/* Metadata Badges */}
                      {task.metadata && Object.keys(task.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(task.metadata).map(([k, v]) => (
                            <span key={k} className="text-[8px] font-mono text-[#888] bg-[#111] border border-[#2A2A2A] px-1.5 py-0.5 uppercase tracking-wider">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="p-4 align-top border-r border-[#222]">
                      <div className="mb-2">{getStatusBadge(task.status, task.attempt_number || 0)}</div>
                      {task.status === 'FAILED' && task.error_details && (
                        <div className="mt-2 text-[10px] font-mono text-red-500 bg-red-950/30 border border-red-900/50 p-2 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap" title={task.error_details}>
                          {task.error_details}
                        </div>
                      )}
                    </td>

                    <td className="p-4 align-top font-mono text-[10px] text-[#555] space-y-1">
                      <div>SCHED: {formatIST(task.scheduled_at)}</div>
                      {task.started_at && <div>START: {formatIST(task.started_at)}</div>}

                      {/* Latency Metrics */}
                      {(queueTime || execTime) && (
                        <div className="pt-2 mt-2 border-t border-[#1A1A1A]">
                          {queueTime && (
                            <div>
                              <span className="text-[#555]">QUEUE LATENCY:</span>{' '}
                              <span className={queueTime.includes('m') ? 'text-yellow-500' : 'text-white'}>{queueTime}</span>
                            </div>
                          )}
                          {execTime && (
                            <div>
                              <span className="text-[#555]">EXEC LATENCY:</span>{' '}
                              <span className="text-white">{execTime}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#444] font-mono text-xs uppercase tracking-widest">
                    No tasks match current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
