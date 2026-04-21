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
