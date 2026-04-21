/**
 * CLS-safe skeleton fallbacks for admin dashboard Suspense boundaries.
 * Each skeleton matches the exact dimensions of its resolved counterpart.
 */

// --- CHART SKELETON ---
// Matches: OverviewChart parent → h-[300px] w-full bg-[#080808] border border-[#222] p-4
export function ChartSkeleton() {
    return (
        <div className="h-[300px] w-full bg-[#080808] border border-[#222] p-4 relative">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-red-600/30" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-600/30" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-red-600/30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-red-600/30" />

            <div className="font-mono text-[10px] uppercase text-[#666] mb-4 tracking-widest flex justify-between">
                <span>User Acquisition</span>
                <span className="text-red-500/40 animate-pulse">LOADING</span>
            </div>

            {/* Fake chart bars */}
            <div className="flex items-end gap-3 h-[200px] px-4 pt-4">
                {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-red-900/10 border border-red-900/20 animate-pulse rounded-sm"
                        style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}

// --- CMS SKELETON ---
// Matches: CMS section → bg-[#080808] border border-[#222] p-6 with 3 input fields + button
export function CmsSkeleton() {
    return (
        <div className="bg-[#080808] border border-[#222] p-6 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
                <div className="w-[18px] h-[18px] rounded bg-red-900/20 animate-pulse" />
                <div className="h-5 w-40 bg-[#111] rounded animate-pulse" />
            </div>

            <div className="space-y-4">
                {/* 3 input field placeholders */}
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-1">
                        <div className="h-2.5 w-20 bg-[#111] rounded animate-pulse" />
                        <div className="h-11 w-full bg-[#111] border border-[#222] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                    </div>
                ))}

                {/* Button placeholder */}
                <div className="flex justify-end pt-2">
                    <div className="h-9 w-40 bg-[#111] border border-[#222] animate-pulse" />
                </div>
            </div>
        </div>
    );
}

// --- AUDIT STREAM SKELETON ---
// Matches: Audit stream → bg-[#080808] border border-[#222] flex flex-col h-full max-h-[600px]
export function AuditSkeleton() {
    return (
        <div className="bg-[#080808] border border-[#222] flex flex-col h-full max-h-[600px]">
            <div className="p-4 border-b border-[#222] bg-[#0A0A0A] sticky top-0">
                <h3 className="font-anton text-lg uppercase text-white/40 animate-pulse">Audit Stream</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* 10 log entry placeholders matching the real log count */}
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="p-4 border-b border-[#1A1A1A]">
                        <div className="flex justify-between mb-1">
                            <div className="h-4 w-24 bg-red-900/10 border border-red-900/20 animate-pulse rounded-sm" style={{ animationDelay: `${i * 80}ms` }} />
                            <div className="h-3 w-12 bg-[#111] animate-pulse rounded-sm" style={{ animationDelay: `${i * 80 + 40}ms` }} />
                        </div>
                        <div className="h-3 w-3/4 bg-[#111] mt-2 animate-pulse rounded-sm" style={{ animationDelay: `${i * 80 + 60}ms` }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- USERS TABLE SKELETON ---
// Matches: Users page → border border-[#222] bg-[#080808] max-h-[80vh] with 8-column table
export function UsersTableSkeleton() {
    const columns = ['Status', 'Identity', 'Storage', 'Timeline', 'Activity', 'Balance', 'Role', 'Controls'];

    return (
        <div className="border border-[#222] bg-[#080808] max-h-[80vh] overflow-y-auto">
            <table className="w-full text-left">
                <thead className="bg-[#0A0A0A] text-[10px] uppercase font-mono text-[#666] tracking-widest sticky top-0 z-10">
                    <tr>
                        {columns.map((col, i) => (
                            <th key={col} className={`p-4 border-b border-[#222] bg-[#0A0A0A] ${i < columns.length - 1 ? 'border-r' : ''} ${i === columns.length - 1 ? 'text-right' : ''}`}>
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                            <td className="p-4 border-r border-[#222] text-center">
                                <div className="w-1.5 h-1.5 bg-[#222] rounded-full mx-auto animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                            </td>
                            <td className="p-4 border-r border-[#222]">
                                <div className="h-4 w-28 bg-[#111] rounded animate-pulse mb-1" style={{ animationDelay: `${i * 100}ms` }} />
                                <div className="h-2.5 w-36 bg-[#0D0D0D] rounded animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                            </td>
                            <td className="p-4 border-r border-[#222]">
                                <div className="h-4 w-16 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 100 + 20}ms` }} />
                            </td>
                            <td className="p-4 border-r border-[#222]">
                                <div className="h-3 w-24 bg-[#111] rounded animate-pulse mb-1" style={{ animationDelay: `${i * 100 + 30}ms` }} />
                                <div className="h-3 w-24 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 100 + 60}ms` }} />
                            </td>
                            <td className="p-4 border-r border-[#222]">
                                <div className="h-3 w-20 bg-[#111] rounded animate-pulse mb-1" style={{ animationDelay: `${i * 100 + 40}ms` }} />
                                <div className="h-3 w-16 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 100 + 70}ms` }} />
                            </td>
                            <td className="p-4 border-r border-[#222]">
                                <div className="h-6 w-12 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                            </td>
                            <td className="p-4 border-r border-[#222]">
                                <div className="h-5 w-14 bg-[#111] border border-[#222] rounded animate-pulse" style={{ animationDelay: `${i * 100 + 60}ms` }} />
                            </td>
                            <td className="p-4 text-right">
                                <div className="h-8 w-24 bg-[#111] border border-[#222] ml-auto animate-pulse" style={{ animationDelay: `${i * 100 + 70}ms` }} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- FINANCE TABLE SKELETON ---
// Matches: Finance page → 3 stat cards + 5-column transaction table
export function FinanceTableSkeleton() {
    return (
        <div className="space-y-8">
            {/* Chart placeholder */}
            <div className="h-[300px] w-full bg-[#080808] border border-[#222] p-4 animate-pulse" />

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-[#080808] border border-[#222] p-6">
                        <div className="h-2.5 w-24 bg-[#111] rounded animate-pulse mb-3" />
                        <div className="h-10 w-28 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="border border-[#222] bg-[#080808]">
                <table className="w-full text-left">
                    <thead className="bg-[#0A0A0A] text-[10px] uppercase font-mono text-[#666] tracking-widest">
                        <tr>
                            {['Date', 'Transaction ID', 'Type', 'Amount', 'Status'].map((col, i) => (
                                <th key={col} className={`p-4 border-b border-[#222] ${i < 4 ? 'border-r' : ''}`}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i}>
                                <td className="p-4 border-r border-[#222]"><div className="h-3 w-20 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 80}ms` }} /></td>
                                <td className="p-4 border-r border-[#222]"><div className="h-3 w-32 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 80 + 20}ms` }} /></td>
                                <td className="p-4 border-r border-[#222]"><div className="h-5 w-20 bg-[#111] border border-[#222] rounded animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} /></td>
                                <td className="p-4 border-r border-[#222]"><div className="h-3 w-16 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 80 + 60}ms` }} /></td>
                                <td className="p-4"><div className="h-3 w-16 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 80 + 80}ms` }} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// --- KPI SECTION SKELETON ---
// Matches: OperationalKpiGrid / GrowthKpiGrid → section header + 3-col grid of cards
export function KpiSkeleton({ label = 'Loading', icon = 'cpu' }: { label?: string; icon?: string }) {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="flex items-center gap-3 border-b border-[#222] pb-3">
                <div className="w-4 h-4 bg-[#222] rounded" />
                <div className="h-5 w-40 bg-[#1a1a1a] rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-[#0A0A0A] border border-[#222] p-5 h-[160px]">
                        <div className="flex justify-between mb-3">
                            <div className="h-3 w-20 bg-[#1a1a1a] rounded" />
                            <div className="w-3.5 h-3.5 bg-[#1a1a1a] rounded" />
                        </div>
                        <div className="h-10 w-24 bg-[#1a1a1a] rounded mb-2" />
                        <div className="h-2 w-32 bg-[#111] rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
