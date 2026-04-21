import { AlertTriangle, Timer, TrendingDown, ArrowUpRight, Gauge, Cpu, Crown, UserMinus } from 'lucide-react';

interface OperationalKpis {
    totalTasks24h: number;
    failedTasks24h: number;
    failureRate: number;
    latencyP50: number;
    latencyByType: Record<string, number>;
    errorBreakdown: Record<string, number>;
}

interface GrowthKpis {
    totalUsers: number;
    paidUsers: number;
    freeUsers: number;
    conversionRate: number;
    churnCount30d: number;
    planBreakdown: Record<string, number>;
}

function formatLatency(seconds: number): string {
    if (seconds === 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function OperationalKpiGrid({ data }: { data: OperationalKpis }) {
    const isHealthy = data.failureRate < 5;
    const topErrors = Object.entries(data.errorBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-[#222] pb-3">
                <Cpu className="text-red-600" size={16} />
                <h3 className="font-anton text-lg text-white uppercase tracking-wide">Operations // 24H</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Failure Rate Gauge */}
                <div className={`bg-[#0A0A0A] border p-5 transition-all ${isHealthy ? 'border-[#222] hover:border-[#444]' : 'border-red-900/40 bg-red-950/5'}`}>
                    <div className="flex justify-between items-start mb-3">
                        <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${isHealthy ? 'text-[#555]' : 'text-red-400'}`}>
                            Failure Rate
                        </span>
                        {isHealthy
                            ? <Gauge size={14} className="text-green-600" />
                            : <AlertTriangle size={14} className="text-red-500 animate-pulse" />
                        }
                    </div>
                    <div className={`font-anton text-4xl mb-1 ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
                        {data.failureRate}%
                    </div>
                    <div className="text-[9px] font-mono text-[#444] uppercase">
                        {data.failedTasks24h} failed / {data.totalTasks24h} total
                    </div>
                    {/* Mini error breakdown */}
                    {topErrors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#1a1a1a] space-y-1">
                            {topErrors.map(([code, count]) => (
                                <div key={code} className="flex justify-between text-[8px] font-mono">
                                    <span className="text-[#666] truncate max-w-[70%]">{code}</span>
                                    <span className="text-red-400">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Median Latency */}
                <div className="bg-[#0A0A0A] border border-[#222] p-5 hover:border-[#444] transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#555]">Median Latency</span>
                        <Timer size={14} className="text-[#333]" />
                    </div>
                    <div className="font-anton text-4xl text-white mb-1">
                        {formatLatency(data.latencyP50)}
                    </div>
                    <div className="text-[9px] font-mono text-[#444] uppercase">P50 All Types</div>
                    {/* Per-type breakdown */}
                    {Object.keys(data.latencyByType).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#1a1a1a] space-y-1">
                            {Object.entries(data.latencyByType).map(([type, p50]) => (
                                <div key={type} className="flex justify-between text-[8px] font-mono">
                                    <span className="text-[#666] capitalize">{type}</span>
                                    <span className="text-white">{formatLatency(p50)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Total Generations */}
                <div className="bg-[#0A0A0A] border border-[#222] p-5 hover:border-[#444] transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#555]">Total Generations</span>
                        <ArrowUpRight size={14} className="text-[#333]" />
                    </div>
                    <div className="font-anton text-4xl text-white mb-1">
                        {data.totalTasks24h}
                    </div>
                    <div className="text-[9px] font-mono text-[#444] uppercase">Tasks Processed (24h)</div>
                </div>
            </div>
        </div>
    );
}

export function GrowthKpiGrid({ data }: { data: GrowthKpis }) {
    const planOrder = ['starter', 'pro', 'agency'];
    const planColors: Record<string, string> = {
        starter: 'text-blue-400',
        pro: 'text-purple-400',
        agency: 'text-amber-400',
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-[#222] pb-3">
                <TrendingDown className="text-red-600" size={16} />
                <h3 className="font-anton text-lg text-white uppercase tracking-wide">Growth & Retention</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Conversion Rate */}
                <div className="bg-[#0A0A0A] border border-[#222] p-5 hover:border-[#444] transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#555]">Free → Paid</span>
                        <Crown size={14} className="text-[#333]" />
                    </div>
                    <div className="font-anton text-4xl text-white mb-1">
                        {data.conversionRate}%
                    </div>
                    <div className="text-[9px] font-mono text-[#444] uppercase">
                        {data.paidUsers} paid / {data.totalUsers} total
                    </div>
                    {/* Plan breakdown */}
                    <div className="mt-3 pt-3 border-t border-[#1a1a1a] space-y-1">
                        {planOrder.map(plan => (
                            <div key={plan} className="flex justify-between text-[8px] font-mono">
                                <span className={`capitalize ${planColors[plan] || 'text-[#666]'}`}>{plan}</span>
                                <span className="text-white">{data.planBreakdown[plan] || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Churn */}
                <div className={`bg-[#0A0A0A] border p-5 transition-all ${data.churnCount30d > 0 ? 'border-amber-900/40 bg-amber-950/5' : 'border-[#222] hover:border-[#444]'}`}>
                    <div className="flex justify-between items-start mb-3">
                        <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${data.churnCount30d > 0 ? 'text-amber-400' : 'text-[#555]'}`}>
                            Churn (30d)
                        </span>
                        <UserMinus size={14} className={data.churnCount30d > 0 ? 'text-amber-500' : 'text-[#333]'} />
                    </div>
                    <div className={`font-anton text-4xl mb-1 ${data.churnCount30d > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {data.churnCount30d}
                    </div>
                    <div className="text-[9px] font-mono text-[#444] uppercase">
                        Subscription Cancellations
                    </div>
                </div>

                {/* User Breakdown */}
                <div className="bg-[#0A0A0A] border border-[#222] p-5 hover:border-[#444] transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#555]">User Mix</span>
                    </div>
                    <div className="font-anton text-4xl text-white mb-1">
                        {data.totalUsers}
                    </div>
                    <div className="text-[9px] font-mono text-[#444] uppercase mb-3">Total Registered</div>
                    {/* Visual bar */}
                    <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden flex">
                        <div
                            className="h-full bg-green-600 transition-all"
                            style={{ width: `${data.conversionRate}%` }}
                            title={`Paid: ${data.paidUsers}`}
                        />
                        <div
                            className="h-full bg-[#333] transition-all"
                            style={{ width: `${100 - data.conversionRate}%` }}
                            title={`Free: ${data.freeUsers}`}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-[8px] font-mono">
                        <span className="text-green-400">{data.paidUsers} Paid</span>
                        <span className="text-[#555]">{data.freeUsers} Free</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
