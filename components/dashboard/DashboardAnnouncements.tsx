"use client";
import { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Megaphone, Sparkles, Zap, Wrench, X, ChevronLeft, ChevronRight } from "lucide-react";

const TYPES: Record<string, { icon: any; color: string; label: string }> = {
    feature: { icon: Sparkles, color: '#E50914', label: 'Feature' },
    update: { icon: Zap, color: '#3B82F6', label: 'Update' },
    fix: { icon: Wrench, color: '#22C55E', label: 'Fix' },
};

export function useAnnouncements() {
    const [all, setAll] = useState<any[]>([]);
    const [dismissed, setDismissed] = useState<string[]>([]);
    const [showModal, setShowModal] = useState(false);
    const shown = useRef(false);

    useEffect(() => {
        try { const s = localStorage.getItem('dismissed_announcements'); if (s) setDismissed(JSON.parse(s)); } catch {}
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'announcements'), orderBy('created_at', 'desc'), limit(10));
        const unsub = onSnapshot(q, snap => {
            const active = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((a: any) => a.active);
            setAll(active);
            if (!shown.current && active.length > 0) { shown.current = true; setTimeout(() => setShowModal(true), 1500); }
        }, () => {});
        return () => unsub();
    }, []);

    const visible = all.filter(a => !dismissed.includes(a.id));
    const dismiss = (id: string) => { const u = [...dismissed, id]; setDismissed(u); localStorage.setItem('dismissed_announcements', JSON.stringify(u)); };
    const closeModal = () => { setShowModal(false); localStorage.setItem('whats_new_seen', JSON.stringify(all.map(a => a.id))); };

    return { visible, all, dismiss, showModal, closeModal };
}

export function AnnouncementBar({ visible, dismiss }: { visible: any[]; dismiss: (id: string) => void }) {
    const [idx, setIdx] = useState(0);
    const [fading, setFading] = useState(false);

    useEffect(() => {
        if (visible.length <= 1) return;
        const t = setInterval(() => { setFading(true); setTimeout(() => { setIdx(p => (p + 1) % visible.length); setFading(false); }, 300); }, 5000);
        return () => clearInterval(t);
    }, [visible.length]);

    useEffect(() => { if (idx >= visible.length) setIdx(0); }, [visible.length, idx]);

    if (visible.length === 0) return null;
    const a = visible[idx] || visible[0];
    if (!a) return null;
    const c = TYPES[a.type] || TYPES.update;
    const Icon = c.icon;

    return (
        <div className="shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.03]"
                style={{ borderLeftWidth: 2, borderLeftColor: c.color, transition: 'opacity 0.3s, transform 0.3s', opacity: fading ? 0 : 1, transform: fading ? 'translateY(-4px)' : 'translateY(0)' }}>
                <Icon size={11} style={{ color: c.color }} className="shrink-0" />
                <span className="text-[10px] font-semibold text-white/70 truncate flex-1">{a.title}</span>
                {visible.length > 1 && <div className="flex gap-1 shrink-0">{visible.map((_, i) => (
                    <button key={i} onClick={() => setIdx(i)} className={`w-1 h-1 rounded-full transition-all cursor-pointer ${i === idx ? 'bg-white/50 w-2' : 'bg-white/10'}`} />
                ))}</div>}
                <button onClick={() => dismiss(a.id)} className="text-white/15 hover:text-white/40 transition-colors cursor-pointer shrink-0"><X size={10} /></button>
            </div>
        </div>
    );
}

export function WhatsNewModal({ visible, onClose }: { visible: any[]; onClose: () => void }) {
    const [idx, setIdx] = useState(0);
    const [fading, setFading] = useState(false);
    const [vidReady, setVidReady] = useState(false);

    useEffect(() => { setIdx(0); setVidReady(false); }, []);
    useEffect(() => { setVidReady(false); }, [idx]);
    useEffect(() => {
        if (visible.length <= 1) return;
        const t = setInterval(() => { setFading(true); setTimeout(() => { setIdx(p => (p + 1) % visible.length); setFading(false); }, 250); }, 5000);
        return () => clearInterval(t);
    }, [visible.length]);

    const goTo = (i: number) => { if (i === idx) return; setFading(true); setTimeout(() => { setIdx(i); setFading(false); }, 250); };

    if (visible.length === 0) return null;
    const a = visible[idx] || visible[0];
    if (!a) return null;
    const c = TYPES[a.type] || TYPES.update;
    const Icon = c.icon;
    const isVid = a.media_url?.match(/\.(mp4|webm|mov)(\?|$)/i);
    const total = visible.length;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
            <div className="relative z-10 w-full max-w-lg mx-4 bg-[#0a0a0a] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }} />
                <div className="p-7">
                    <div className="flex items-center gap-2.5 mb-1"><Megaphone size={16} className="text-[#E50914]" /><span className="text-[9px] font-mono text-[#E50914] uppercase tracking-[4px] font-bold">What&apos;s New</span></div>
                    <h2 className="font-['Anton'] text-2xl text-white uppercase tracking-wide mb-5">Latest Updates</h2>
                    <div style={{ transition: 'opacity 0.35s, transform 0.35s', opacity: fading ? 0 : 1, transform: fading ? 'translateX(-30px)' : 'translateX(0)' }}>
                        {a.media_url && (
                            <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/[0.04] mb-4 bg-black relative">
                                {isVid ? (<>
                                    {!vidReady && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-10"><Loader2 className="animate-spin text-[#E50914]" size={24} /></div>}
                                    <video key={a.id} src={a.media_url} autoPlay loop muted playsInline preload="metadata" onCanPlay={() => setVidReady(true)} className={`w-full h-full object-cover transition-opacity ${vidReady ? 'opacity-100' : 'opacity-0'}`} />
                                </>) : <img key={a.id} src={a.media_url} alt="" className="w-full h-full object-cover" />}
                            </div>
                        )}
                        <div className="flex items-center gap-2 mb-2"><Icon size={14} style={{ color: c.color }} /><span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: `${c.color}15`, color: c.color }}>{c.label}</span></div>
                        <h3 className="font-['Anton'] text-xl text-white uppercase tracking-wide leading-tight">{a.title}</h3>
                        <p className="text-[11px] text-white/30 mt-2 leading-relaxed">{a.body}</p>
                    </div>
                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/[0.03]">
                        {total > 1 ? (
                            <div className="flex items-center gap-3">
                                <button onClick={() => goTo((idx - 1 + total) % total)} className="w-7 h-7 rounded-full border border-white/[0.06] flex items-center justify-center text-white/20 hover:text-white cursor-pointer"><ChevronLeft size={14} /></button>
                                <div className="flex gap-1.5">{visible.map((_, i) => <button key={i} onClick={() => goTo(i)} className={`rounded-full transition-all cursor-pointer ${i === idx ? 'w-5 h-1.5 bg-[#E50914]' : 'w-1.5 h-1.5 bg-white/10'}`} />)}</div>
                                <button onClick={() => goTo((idx + 1) % total)} className="w-7 h-7 rounded-full border border-white/[0.06] flex items-center justify-center text-white/20 hover:text-white cursor-pointer"><ChevronRight size={14} /></button>
                            </div>
                        ) : <div />}
                        <button onClick={onClose} className="px-7 py-2.5 text-[10px] font-bold uppercase tracking-[3px] rounded-xl cursor-pointer border-none text-white" style={{ background: "linear-gradient(135deg, #E50914, #B30710)", boxShadow: "0 4px 16px rgba(229,9,20,0.3)" }}>Got It</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
