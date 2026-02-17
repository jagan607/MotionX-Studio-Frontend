import { getDashboardStats } from '@/lib/admin-data';
import { OverviewChart } from '@/components/admin/OverviewChart';
import { LiveStatsGrid } from '@/components/admin/LiveStatsGrid'; // Import the new component
import { Globe, Save } from 'lucide-react';
import { adminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

// --- SERVER ACTION FOR CMS ---
async function updateLandingCopy(formData: FormData) {
    "use server";
    const headline = formData.get('headline') as string;
    const subhead = formData.get('subhead') as string;
    const heroVideoUrl = formData.get('heroVideoUrl') as string;

    await adminDb.collection('site_config').doc('landing_page').set({
        headline,
        subhead,
        heroVideoUrl,
        updatedAt: new Date()
    }, { merge: true });

    revalidatePath('/'); // Revalidate the home page
}

// --- MAIN PAGE ---
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    // We fetch chart data & logs on server
    // (Stats are now handled client-side by LiveStatsGrid)
    const { chartData, recentActivity } = await getDashboardStats();

    // Fetch current CMS config
    const cmsSnap = await adminDb.collection('site_config').doc('landing_page').get();
    const cmsData = cmsSnap.exists ? cmsSnap.data() : { headline: 'Direct Everything', subhead: 'AI CINEMA ENGINE' };

    return (
        <div className="space-y-12 animate-in fade-in duration-500 pb-20">

            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-[#222] pb-6">
                <div>
                    <h1 className="font-anton text-6xl text-white uppercase tracking-tighter leading-none">Command<br />Center</h1>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-mono text-[#666] mb-1">LIVE METRICS // {new Date().toLocaleTimeString()}</div>
                </div>
            </div>

            {/* 1. LIVE STATS GRID (Replaces static cards) */}
            <LiveStatsGrid />

            {/* 2. CHARTS & LOGS SPLIT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left: Chart & CMS (Takes 2 columns) */}
                <div className="lg:col-span-2 space-y-6">
                    <OverviewChart data={chartData} />

                    {/* --- LANDING PAGE CMS --- */}
                    <div className="bg-[#080808] border border-[#222] p-6 relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
                            <Globe className="text-red-600" size={18} />
                            <h3 className="font-anton text-xl text-white uppercase tracking-wide">Landing Page CMS</h3>
                        </div>

                        <form action={updateLandingCopy} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">Hero Headline</label>
                                <input
                                    name="headline"
                                    defaultValue={cmsData?.headline}
                                    className="w-full bg-[#111] border border-[#333] text-white p-3 font-anton text-lg tracking-wide focus:border-red-600 outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">Subheadline</label>
                                <input
                                    name="subhead"
                                    defaultValue={cmsData?.subhead}
                                    className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-red-600 outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">Hero Video URL</label>
                                <input
                                    name="heroVideoUrl"
                                    defaultValue={cmsData?.heroVideoUrl}
                                    placeholder="https://firebasestorage.googleapis.com/..."
                                    className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-red-600 outline-none transition-colors"
                                />
                                <p className="text-[8px] text-[#444] pt-1">* Paste a direct link to your MP4 or Image from Firebase Storage</p>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button type="submit" className="flex items-center gap-2 bg-white text-black hover:bg-red-600 hover:text-white px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all">
                                    <Save size={14} /> Update Live Site
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right: Activity Log */}
                <div className="bg-[#080808] border border-[#222] flex flex-col h-full max-h-[600px]">
                    <div className="p-4 border-b border-[#222] bg-[#0A0A0A] sticky top-0">
                        <h3 className="font-anton text-lg uppercase text-white">Audit Stream</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {recentActivity.map((log: any) => (
                            <div key={log.id} className="p-4 border-b border-[#1A1A1A] hover:bg-[#0E0E0E] transition-colors group">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-[9px] text-red-500 font-mono border border-red-900/30 px-1">{log.action}</span>
                                    <span className="text-[9px] text-[#444] font-mono">{log.time}</span>
                                </div>
                                <p className="text-[10px] text-[#CCC] font-mono mt-1 line-clamp-2">{log.details}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}