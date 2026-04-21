import { Suspense } from 'react';
import { adminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { Megaphone, Plus, Trash2, ToggleLeft, ToggleRight, Sparkles, Wrench, Zap, Image as ImageIcon, Film, Mail } from 'lucide-react';
import { AnnouncementForm } from './AnnouncementForm';
import { EmailBlastForm } from './EmailBlastForm';

// --- SERVER ACTIONS ---

async function createAnnouncement(formData: FormData) {
    "use server";
    const title = formData.get('title') as string;
    const body = formData.get('body') as string;
    const type = formData.get('type') as string;
    const media_url = (formData.get('media_url') as string)?.trim() || null;

    if (!title || !body) return;

    await adminDb.collection('announcements').add({
        title,
        body,
        type: type || 'update',
        media_url,
        active: true,
        created_at: new Date(),
    });

    revalidatePath('/admin/announcements');
}

async function toggleAnnouncement(formData: FormData) {
    "use server";
    const id = formData.get('id') as string;
    const currentActive = formData.get('active') === 'true';

    await adminDb.collection('announcements').doc(id).update({
        active: !currentActive,
    });

    revalidatePath('/admin/announcements');
}

async function deleteAnnouncement(formData: FormData) {
    "use server";
    const id = formData.get('id') as string;

    await adminDb.collection('announcements').doc(id).delete();

    revalidatePath('/admin/announcements');
}

// --- HELPERS ---

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    feature: { icon: Sparkles, color: '#E50914', label: 'Feature' },
    update: { icon: Zap, color: '#3B82F6', label: 'Update' },
    fix: { icon: Wrench, color: '#22C55E', label: 'Fix' },
};

// --- SKELETON ---
function AnnouncementsListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#080808] border border-[#222] p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#111] animate-pulse shrink-0" style={{ animationDelay: `${i * 120}ms` }} />
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-14 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 120 + 30}ms` }} />
                            <div className="h-2.5 w-20 bg-[#0D0D0D] rounded animate-pulse" style={{ animationDelay: `${i * 120 + 60}ms` }} />
                        </div>
                        <div className="h-5 w-48 bg-[#111] rounded animate-pulse" style={{ animationDelay: `${i * 120 + 40}ms` }} />
                        <div className="h-3 w-3/4 bg-[#0D0D0D] rounded animate-pulse" style={{ animationDelay: `${i * 120 + 80}ms` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// --- ASYNC SERVER COMPONENT ---
async function AnnouncementsListSection() {
    const snap = await adminDb.collection('announcements').orderBy('created_at', 'desc').get();
    const announcements = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString?.() || new Date().toISOString(),
    }));

    return (
        <>
            {/* Count badge for header */}
            <div className="text-[10px] font-mono text-[#444] text-right -mt-2 mb-4">{announcements.length} total</div>

            {/* EXISTING ANNOUNCEMENTS */}
            <div className="space-y-3">
                {announcements.length === 0 ? (
                    <div className="text-center py-16 text-[#333]">
                        <Megaphone size={40} className="mx-auto mb-4 opacity-30" />
                        <p className="text-[11px] uppercase tracking-widest font-semibold">No announcements yet</p>
                    </div>
                ) : (
                    announcements.map((a: any) => {
                        const config = TYPE_CONFIG[a.type] || TYPE_CONFIG.update;
                        const Icon = config.icon;
                        const date = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                        return (
                            <div key={a.id} className={`bg-[#080808] border p-5 flex items-start gap-4 group transition-all ${a.active ? 'border-[#222] hover:border-[#333]' : 'border-[#1a1a1a] opacity-50'}`}>
                                {/* Media Preview */}
                                {a.media_url && (
                                    <div className="w-20 h-14 rounded overflow-hidden shrink-0 border border-[#222] bg-[#111]">
                                        {a.media_url.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                                            <video src={a.media_url} muted playsInline className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={a.media_url} alt="" className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                )}

                                {/* Type Icon (only when no media) */}
                                {!a.media_url && (
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${config.color}15` }}>
                                        <Icon size={18} style={{ color: config.color }} />
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: `${config.color}20`, color: config.color }}>
                                            {config.label}
                                        </span>
                                        <span className="text-[9px] text-[#444] font-mono">{date}</span>
                                        {!a.active && <span className="text-[8px] text-[#666] font-mono uppercase tracking-widest">Inactive</span>}
                                    </div>
                                    <h4 className="font-anton text-lg text-white uppercase tracking-wide">{a.title}</h4>
                                    <p className="text-[12px] text-[#777] mt-1 line-clamp-2">{a.body}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <form action={toggleAnnouncement}>
                                        <input type="hidden" name="id" value={a.id} />
                                        <input type="hidden" name="active" value={String(a.active)} />
                                        <button type="submit" className="p-2 hover:bg-[#222] rounded transition-colors cursor-pointer" title={a.active ? 'Deactivate' : 'Activate'}>
                                            {a.active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-[#444]" />}
                                        </button>
                                    </form>
                                    <form action={deleteAnnouncement}>
                                        <input type="hidden" name="id" value={a.id} />
                                        <button type="submit" className="p-2 hover:bg-red-900/30 rounded transition-colors cursor-pointer" title="Delete">
                                            <Trash2 size={16} className="text-[#666] hover:text-red-500" />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}

// --- MAIN PAGE (shell renders instantly) ---

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">

            {/* HEADER — renders instantly */}
            <div className="flex justify-between items-end border-b border-[#222] pb-6">
                <div>
                    <div className="flex items-center gap-2 text-[#E50914] mb-2">
                        <Megaphone size={18} />
                        <span className="text-[10px] font-mono tracking-widest uppercase">Broadcast System</span>
                    </div>
                    <h1 className="font-anton text-5xl text-white uppercase tracking-tighter leading-none">Announcements</h1>
                </div>
            </div>

            {/* CREATE FORM — Client Component with Upload (renders instantly) */}
            <div className="bg-[#080808] border border-[#222] p-6">
                <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
                    <Plus className="text-[#E50914]" size={16} />
                    <h3 className="font-anton text-lg text-white uppercase tracking-wide">New Announcement</h3>
                </div>
                <AnnouncementForm onPublish={createAnnouncement} />
            </div>

            {/* ANNOUNCEMENTS LIST — Streamed via Suspense */}
            <Suspense fallback={<AnnouncementsListSkeleton />}>
                <AnnouncementsListSection />
            </Suspense>

            {/* EMAIL BLAST SECTION (Client component — renders instantly) */}
            <div className="bg-[#080808] border border-[#222] p-6">
                <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
                    <Mail className="text-[#E50914]" size={16} />
                    <h3 className="font-anton text-lg text-white uppercase tracking-wide">Email Blast</h3>
                    <span className="text-[8px] font-mono text-[#444] uppercase tracking-widest ml-auto">Compose &amp; Send</span>
                </div>
                <EmailBlastForm />
            </div>
        </div>
    );
}
