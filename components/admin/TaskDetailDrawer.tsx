"use client";

/**
 * TaskDetailDrawer — Right-edge slide-over panel for deep-diving into a single task.
 *
 * Triggered by clicking a Task ID in the System Observability table.
 * Uses framer-motion for smooth slide + backdrop animation.
 *
 * Sections:
 *   1. Identity (task_id, job_id, user_email — with copy buttons)
 *   2. Enriched Stats (model_name, cost_credits, resolution)
 *   3. Prompt (full text in a mono box)
 *   4. Telemetry (timestamps + latencies)
 *   5. Error Details (FAILED tasks only)
 */

import { AnimatePresence, motion } from "framer-motion";
import { X, Copy, Clock, Cpu, CreditCard, Monitor, FileText, AlertTriangle } from "@/lib/lucide";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { toast } from "react-hot-toast";

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
    model_name?: string;
    cost_credits?: number;
    resolution?: string;
    prompt?: string;
    scheduled_at?: FirestoreTimestamp;
    started_at?: FirestoreTimestamp;
    resolved_at?: FirestoreTimestamp;
}

interface TaskDetailDrawerProps {
    task: Task | null;
    onClose: () => void;
}

export default function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const formatIST = (timestamp?: FirestoreTimestamp) => {
        if (!timestamp) return "--";
        return timestamp.toDate().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "medium",
        });
    };

    const getDuration = (startTs?: FirestoreTimestamp, endTs?: FirestoreTimestamp) => {
        if (!startTs || !endTs) return null;
        const diffMs = endTs.toMillis() - startTs.toMillis();
        const secs = Math.floor(diffMs / 1000);
        const mins = Math.floor(secs / 60);
        return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "SCHEDULED": return "text-blue-400 border-blue-400/30 bg-blue-400/10";
            case "PROCESSING": return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
            case "COMPLETED": return "text-green-500 border-green-500/30 bg-green-500/10";
            case "FAILED": return "text-red-500 border-red-500/30 bg-red-500/10";
            default: return "text-[#666] border-[#333] bg-[#111]";
        }
    };

    return (
        <AnimatePresence>
            {task && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />

                    {/* Drawer Panel */}
                    <motion.div
                        className="fixed top-0 right-0 h-full w-[500px] max-w-[90vw] bg-[#080808] border-l border-[#222] z-[100] flex flex-col shadow-2xl shadow-black/50"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    >
                        {/* ── HEADER ── */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222] shrink-0 bg-[#0A0A0A]">
                            <div>
                                <h2 className="font-anton text-2xl text-white uppercase tracking-tight leading-none">
                                    Task <span className="text-red-600">Intel</span>
                                </h2>
                                <p className="text-[9px] font-mono text-[#555] mt-1 uppercase tracking-widest">
                                    Deep Inspection // {task.task_type}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center border border-[#333] hover:border-red-600 text-[#666] hover:text-white transition-all cursor-pointer"
                                title="Close drawer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* ── SCROLLABLE CONTENT ── */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* ── STATUS BADGE ── */}
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-mono font-bold border px-3 py-1.5 uppercase tracking-widest ${getStatusColor(task.status)}`}>
                                    {task.status}
                                </span>
                                {(task.attempt_number ?? 0) > 0 && (
                                    <span className="text-[9px] text-red-500 animate-pulse border border-red-500/50 px-2 py-1 font-bold font-mono tracking-widest">
                                        RETRY:{task.attempt_number}
                                    </span>
                                )}
                                <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">
                                    {task.queue_name}
                                </span>
                            </div>

                            {/* ── IDENTITY BLOCK ── */}
                            <section>
                                <SectionLabel icon={<Copy size={10} />} label="Identity" />
                                <div className="space-y-2 mt-2">
                                    <CopyRow label="TASK ID" value={task.task_id} onCopy={copyToClipboard} />
                                    <CopyRow label="JOB ID" value={task.job_id || "N/A"} onCopy={task.job_id ? copyToClipboard : undefined} />
                                    <CopyRow label="USER" value={task.user_email || "SYSTEM"} onCopy={task.user_email ? copyToClipboard : undefined} />
                                </div>
                            </section>

                            {/* ── ENRICHED STATS GRID ── */}
                            <section>
                                <SectionLabel icon={<Cpu size={10} />} label="Generation Intel" />
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <StatCard
                                        label="Model"
                                        value={task.model_name ?? null}
                                        icon={<Cpu size={12} />}
                                        color="purple"
                                    />
                                    <StatCard
                                        label="Cost"
                                        value={task.cost_credits != null ? `${task.cost_credits}` : null}
                                        icon={<CreditCard size={12} />}
                                        color="amber"
                                    />
                                    <StatCard
                                        label="Resolution"
                                        value={task.resolution ?? null}
                                        icon={<Monitor size={12} />}
                                        color="cyan"
                                    />
                                </div>
                            </section>

                            {/* ── PROMPT BLOCK ── */}
                            <section>
                                <SectionLabel icon={<FileText size={10} />} label="Prompt" />
                                <div className="mt-2 bg-[#0C0C0C] border border-[#1A1A1A] rounded-md p-4 relative group">
                                    {task.prompt ? (
                                        <>
                                            <pre className="text-[11px] font-mono text-[#CCC] whitespace-pre-wrap leading-relaxed break-words max-h-60 overflow-y-auto">
                                                {task.prompt}
                                            </pre>
                                            <button
                                                onClick={() => copyToClipboard(task.prompt!)}
                                                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-[#444] hover:text-white opacity-0 group-hover:opacity-100 transition-all bg-[#111] border border-[#2A2A2A] cursor-pointer"
                                                title="Copy prompt"
                                            >
                                                <Copy size={10} />
                                            </button>
                                        </>
                                    ) : (
                                        <p className="text-[10px] font-mono text-[#444] uppercase tracking-widest text-center py-4">
                                            No prompt recorded
                                        </p>
                                    )}
                                </div>
                            </section>

                            {/* ── METADATA (raw) ── */}
                            {task.metadata && Object.keys(task.metadata).length > 0 && (
                                <section>
                                    <SectionLabel icon={<Cpu size={10} />} label="Raw Metadata" />
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {Object.entries(task.metadata).map(([k, v]) => (
                                            <span key={k} className="text-[8px] font-mono text-[#888] bg-[#111] border border-[#2A2A2A] px-1.5 py-0.5 uppercase tracking-wider">
                                                {k}: {String(v)}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* ── TELEMETRY ── */}
                            <section>
                                <SectionLabel icon={<Clock size={10} />} label="Telemetry (IST)" />
                                <div className="space-y-1.5 mt-2">
                                    <TelemetryRow label="SCHEDULED" value={formatIST(task.scheduled_at)} />
                                    <TelemetryRow label="STARTED" value={formatIST(task.started_at)} />
                                    <TelemetryRow label="RESOLVED" value={formatIST(task.resolved_at)} />

                                    {/* Latency Metrics */}
                                    {(() => {
                                        const queueTime = getDuration(task.scheduled_at, task.started_at);
                                        const execTime = getDuration(task.started_at, task.resolved_at);
                                        if (!queueTime && !execTime) return null;
                                        return (
                                            <div className="pt-2 mt-2 border-t border-[#1A1A1A] space-y-1.5">
                                                {queueTime && (
                                                    <div className="flex justify-between text-[10px] font-mono">
                                                        <span className="text-[#555]">QUEUE LATENCY</span>
                                                        <span className={queueTime.includes("m") ? "text-yellow-500" : "text-white"}>{queueTime}</span>
                                                    </div>
                                                )}
                                                {execTime && (
                                                    <div className="flex justify-between text-[10px] font-mono">
                                                        <span className="text-[#555]">EXEC LATENCY</span>
                                                        <span className="text-white">{execTime}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>

                            {/* ── ERROR DETAILS ── */}
                            {task.status === "FAILED" && task.error_details && (
                                <section>
                                    <SectionLabel icon={<AlertTriangle size={10} />} label="Error Details" color="text-red-500" />
                                    <div className="mt-2 bg-red-950/20 border border-red-900/40 rounded-md p-4">
                                        <pre className="text-[10px] font-mono text-red-400 whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto">
                                            {task.error_details}
                                        </pre>
                                    </div>
                                </section>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}


/* ────────────────────────────────────────────────────────────────
   Sub-components (co-located — only used by this drawer)
   ──────────────────────────────────────────────────────────────── */

function SectionLabel({ icon, label, color = "text-[#666]" }: { icon: React.ReactNode; label: string; color?: string }) {
    return (
        <div className={`flex items-center gap-2 ${color}`}>
            {icon}
            <span className="text-[9px] font-mono uppercase tracking-[3px] font-bold">{label}</span>
        </div>
    );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy?: (v: string) => void }) {
    return (
        <div className="flex items-center justify-between bg-[#0C0C0C] border border-[#1A1A1A] px-3 py-2 group">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[8px] font-mono text-[#555] uppercase tracking-widest shrink-0 w-14">{label}</span>
                <span className="text-[11px] font-mono text-white truncate">{value}</span>
            </div>
            {onCopy && (
                <button
                    onClick={() => onCopy(value)}
                    className="text-[#444] hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0 ml-2"
                    title={`Copy ${label}`}
                >
                    <Copy size={12} />
                </button>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | null; icon: React.ReactNode; color: "purple" | "amber" | "cyan" }) {
    const colorMap = {
        purple: { text: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
        amber:  { text: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/20" },
        cyan:   { text: "text-cyan-400",   bg: "bg-cyan-400/10",   border: "border-cyan-400/20" },
    };
    const c = colorMap[color];

    return (
        <div className={`${c.bg} border ${c.border} p-3 flex flex-col items-center justify-center text-center min-h-[72px]`}>
            <div className={`${c.text} mb-1.5`}>{icon}</div>
            <span className="text-[8px] font-mono text-[#555] uppercase tracking-widest mb-1">{label}</span>
            {value ? (
                <span className={`text-[11px] font-mono font-bold ${c.text} uppercase truncate max-w-full`}>{value}</span>
            ) : (
                <span className="text-[10px] font-mono text-[#333]">N/A</span>
            )}
        </div>
    );
}

function TelemetryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#555]">{label}</span>
            <span className="text-white">{value}</span>
        </div>
    );
}
