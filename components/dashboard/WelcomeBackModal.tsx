"use client";

import { useEffect, useState } from "react";
import { Megaphone, Sparkles, Zap, Wrench, X, ChevronLeft, ChevronRight } from "lucide-react";

const TYPES: Record<string, { icon: any; color: string; label: string }> = {
    feature: { icon: Sparkles, color: '#E50914', label: 'Feature' },
    update: { icon: Zap, color: '#3B82F6', label: 'Update' },
    fix: { icon: Wrench, color: '#22C55E', label: 'Fix' },
};

const ABSENCE_MS = 3 * 24 * 60 * 60 * 1000;

interface Props { announcements: any[]; }

export default function WelcomeBackModal({ announcements }: Props) {
    const [show, setShow] = useState(false);
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        if (announcements.length === 0) return;
        try {
            const last = localStorage.getItem("motionx_last_dashboard_visit");
            const now = Date.now();
            if (last && now - parseInt(last, 10) > ABSENCE_MS && !sessionStorage.getItem("motionx_wb_shown")) {
                setTimeout(() => setShow(true), 2000);
            }
            localStorage.setItem("motionx_last_dashboard_visit", String(now));
        } catch {}
    }, [announcements.length]);

    const close = () => { setShow(false); sessionStorage.setItem("motionx_wb_shown", "1"); };

    if (!show || announcements.length === 0) return null;
    const a = announcements[idx] || announcements[0];
    if (!a) return null;
    const c = TYPES[a.type] || TYPES.update;
    const Icon = c.icon;
    const isVid = a.media_url?.match(/\.(mp4|webm|mov)(\?|$)/i);
    const total = announcements.length;

    return (
        <div className="fixed inset-0 z-[65] flex items-center justify-center" onClick={close} style={{ animation: "fadeIn 0.3s ease" }}>
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
            <div className="relative z-10 w-full max-w-lg mx-4 bg-[#0a0a0a] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()} style={{ animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #E50914, transparent)" }} />
                <div className="p-7">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#E50914]/10 flex items-center justify-center"><Megaphone size={16} className="text-[#E50914]" /></div>
                            <div><span className="text-[9px] font-mono text-[#E50914] uppercase tracking-[4px] font-bold block">Welcome Back</span><span className="text-[10px] text-white/20">Here&apos;s what you missed</span></div>
                        </div>
                        <button onClick={close} className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/20 hover:text-white cursor-pointer transition-all"><X size={14} /></button>
                    </div>
                    {a.media_url && (<div className="w-full aspect-video rounded-xl overflow-hidden border border-white/[0.04] mb-4 bg-black">{isVid ? <video key={a.id} src={a.media_url} autoPlay loop muted playsInline className="w-full h-full object-cover" /> : <img key={a.id} src={a.media_url} alt="" className="w-full h-full object-cover" />}</div>)}
                    <div className="flex items-center gap-2 mb-2"><Icon size={14} style={{ color: c.color }} /><span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: `${c.color}15`, color: c.color }}>{c.label}</span></div>
                    <h3 className="font-['Anton'] text-xl text-white uppercase tracking-wide leading-tight">{a.title}</h3>
                    {a.body && <p className="text-[11px] text-white/30 mt-2 leading-relaxed">{a.body}</p>}
                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/[0.03]">
                        {total > 1 ? (<div className="flex items-center gap-3"><button onClick={() => setIdx((idx - 1 + total) % total)} className="w-7 h-7 rounded-full border border-white/[0.06] flex items-center justify-center text-white/20 hover:text-white cursor-pointer bg-transparent"><ChevronLeft size={14} /></button><div className="flex gap-1.5">{announcements.map((_: any, i: number) => <button key={i} onClick={() => setIdx(i)} className={`rounded-full transition-all cursor-pointer border-none ${i === idx ? 'w-5 h-1.5 bg-[#E50914]' : 'w-1.5 h-1.5 bg-white/10'}`} />)}</div><button onClick={() => setIdx((idx + 1) % total)} className="w-7 h-7 rounded-full border border-white/[0.06] flex items-center justify-center text-white/20 hover:text-white cursor-pointer bg-transparent"><ChevronRight size={14} /></button></div>) : <div />}
                        <button onClick={close} className="px-7 py-2.5 text-[10px] font-bold uppercase tracking-[3px] rounded-xl cursor-pointer border-none text-white" style={{ background: "linear-gradient(135deg, #E50914, #B30710)", boxShadow: "0 4px 16px rgba(229,9,20,0.3)" }}>Got It</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
