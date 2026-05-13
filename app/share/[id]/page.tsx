"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Pause, Film, Camera, MapPin, Sun, MessageSquare, Move, ChevronDown, ChevronUp, Volume2, VolumeX, Sparkles, Video, ImageIcon, Quote, FileText, Palette, Users } from "@/lib/lucide";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";

interface Shot {
    id: string;
    order: number;
    image_url?: string;
    video_url?: string;
    shot_type?: string;
    visual_action?: string;
    dialogue?: string;
    character_name?: string;
    camera_movement?: string;
    prompt?: string;
    video_prompt?: string;
}

interface Scene {
    id: string;
    scene_number: number;
    location?: string;
    time_of_day?: string;
    description?: string;
    shots: Shot[];
}

interface Character {
    id: string;
    name: string;
    description?: string;
    role?: string;
    image_url?: string;
    prompt?: string;
}

interface Location {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
    prompt?: string;
}

interface MoodboardItem {
    title: string;
    option: string;
}

interface ProjectInfo {
    id: string;
    title: string;
    type: string;
    genre: string;
    style: string;
    moodboard?: MoodboardItem[];
    moodboard_image_url?: string;
    moodboard_prompt?: string;
}

export default function SharedProjectPage() {
    const params = useParams();
    const projectId = params.id as string;
    
    const [project, setProject] = useState<ProjectInfo | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [script, setScript] = useState<string>("");
    
    const [loading, setLoading] = useState(true);
    const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
    const [activeShot, setActiveShot] = useState<Shot | null>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [activeTab, setActiveTab] = useState<'moodboard' | 'preprod' | 'storyboard' | 'script'>('moodboard');

    useEffect(() => {
        if (!projectId) return;
        
        const fetchProject = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/project/share/${projectId}`);

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                if (data.error) {
                    console.error("Project error:", data.error);
                    return;
                }

                setProject(data.project);
                setScenes(data.scenes || []);
                setCharacters(data.characters || []);
                setLocations(data.locations || []);
                setScript(data.script || "");

                if (data.scenes?.length > 0) {
                    setExpandedScenes(new Set([data.scenes[0].id]));
                    if (data.scenes[0].shots?.length > 0) {
                        setActiveShot(data.scenes[0].shots[0]);
                    }
                }
            } catch (err) {
                console.error("[SharedProjectPage] Failed:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [projectId]);

    const toggleScene = (id: string) => {
        setExpandedScenes(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (playing) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(() => {});
        }
        setPlaying(!playing);
    };

    const totalShots = scenes.reduce((sum, s) => sum + s.shots.length, 0);
    const totalVideos = scenes.reduce((sum, s) => sum + s.shots.filter(sh => sh.video_url).length, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#111111] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#D40A12] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-[#555] uppercase tracking-[3px]">Loading Experience</span>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-[#111111] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Film size={32} className="text-[#333]" />
                    <span className="text-[10px] text-[#555] uppercase tracking-[3px]">Project Not Found or Private</span>
                    <Link href="/" className="px-4 py-2 mt-4 bg-[#D40A12] text-white text-[10px] font-bold uppercase tracking-[2px] rounded-md hover:bg-[#ff1a25] transition-colors no-underline">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111111] text-white font-sans selection:bg-[#D40A12] selection:text-white">
            {/* ═══ HEADER ═══ */}
            <div className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-2xl border-b border-white/[0.04]">
                <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="flex items-center gap-2 text-white hover:text-[#D40A12] transition-colors group">
                            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#D40A12] to-[#800000] flex items-center justify-center shadow-[0_0_15px_rgba(212,10,18,0.4)] group-hover:shadow-[0_0_25px_rgba(212,10,18,0.6)] transition-shadow">
                                <Film size={14} className="text-white" />
                            </div>
                            <span className="font-bold tracking-widest text-sm hidden sm:block uppercase">MotionX</span>
                        </Link>
                        <div className="h-6 w-[1px] bg-gradient-to-b from-transparent via-white/[0.1] to-transparent"></div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                                    {project?.title || "Untitled Project"}
                                </h1>
                                <span className="bg-[#D40A12]/10 text-[#D40A12] text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-[#D40A12]/20 backdrop-blur-md">
                                    PUBLIC
                                </span>
                            </div>
                            <p className="text-[10px] text-[#777] uppercase tracking-[1px] mt-1 font-medium">
                                {project.genre} · {scenes.length} Scenes · {totalShots} Shots
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/login"
                        className="group relative flex items-center gap-2 px-5 py-2.5 overflow-hidden rounded-full transition-all"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#D40A12] to-[#ff4d4d] opacity-90 group-hover:opacity-100 transition-opacity"></div>
                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
                        <Sparkles size={14} className="relative z-10 text-white" />
                        <span className="relative z-10 text-white text-[11px] font-bold uppercase tracking-[1.5px]">Create Your Own</span>
                    </Link>
                </div>
            </div>

            {/* ═══ TABS ═══ */}
            <div className="border-b border-white/[0.04] bg-[#111111]/90 backdrop-blur-md sticky top-[73px] z-40">
                <div className="max-w-[1800px] mx-auto px-6 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    {[
                        { id: 'moodboard', label: 'Moodboard' },
                        { id: 'preprod', label: 'Characters & Locations' },
                        { id: 'storyboard', label: 'Storyboard' },
                        { id: 'script', label: 'Script' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-4 px-4 text-[11px] font-bold tracking-[1.5px] uppercase transition-all relative whitespace-nowrap ${
                                activeTab === tab.id 
                                ? 'text-white' 
                                : 'text-[#666] hover:text-[#aaa]'
                            }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#D40A12] to-[#ff4d4d] shadow-[0_0_10px_rgba(212,10,18,0.5)] rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ MAIN LAYOUT ═══ */}
            <div className="max-w-[1800px] mx-auto min-h-[calc(100vh-135px)]">

                {/* ─── MOODBOARD TAB ─── */}
                {activeTab === 'moodboard' && (
                    <div className="p-6 lg:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="max-w-5xl mx-auto">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                    <Palette size={18} className="text-[#D40A12]" />
                                </div>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">Cinematic Vision</h2>
                            </div>
                            
                            {project.moodboard && project.moodboard.length > 0 ? (
                                <div className="space-y-12">
                                    {project.moodboard_image_url && (
                                        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl group">
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent opacity-60 z-10"></div>
                                            <img 
                                                src={project.moodboard_image_url} 
                                                alt="Moodboard Concept" 
                                                className="w-full h-auto max-h-[600px] object-cover transition-transform duration-1000 group-hover:scale-105" 
                                            />
                                            {project.moodboard_prompt && (
                                                <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
                                                    <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-xl p-5 shadow-2xl">
                                                        <span className="text-[10px] text-[#D40A12] font-bold tracking-[2px] uppercase mb-3 flex items-center gap-2">
                                                            <Sparkles size={12}/> Generation Prompt
                                                        </span>
                                                        <p className="text-[13px] text-white/90 font-mono leading-relaxed">{project.moodboard_prompt}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {project.moodboard.map((item, idx) => (
                                            <div key={idx} className="group bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <span className="text-[9px] text-[#D40A12] font-bold tracking-[2px] uppercase mb-2 block relative z-10">{item.title}</span>
                                                <span className="text-[14px] text-white font-medium capitalize leading-tight block relative z-10">{item.option}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-32 bg-white/[0.01] rounded-2xl border border-white/[0.03] backdrop-blur-sm">
                                    <Palette size={40} className="mx-auto text-white/[0.1] mb-4" />
                                    <p className="text-[12px] text-[#666] tracking-[2px] uppercase font-semibold">Vision not defined yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── PRE-PROD TAB ─── */}
                {activeTab === 'preprod' && (
                    <div className="p-6 lg:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="max-w-7xl mx-auto space-y-20">
                            {/* Characters */}
                            <section>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                        <Users size={18} className="text-[#D40A12]" />
                                    </div>
                                    <h2 className="text-2xl font-semibold tracking-tight text-white">Cast</h2>
                                </div>
                                {characters.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                        {characters.map(c => (
                                            <div key={c.id} className="flex flex-col bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-all group">
                                                <div className="relative aspect-square overflow-hidden bg-[#1a1a1a]">
                                                    {c.image_url ? (
                                                        <>
                                                            <img src={c.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={c.name} />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent"></div>
                                                        </>
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                                                            <Users size={32} className="mb-2" />
                                                            <span className="text-[10px] uppercase tracking-widest">No Image</span>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                                                        <h3 className="font-bold text-2xl text-white mb-1 tracking-tight">{c.name}</h3>
                                                        {c.role && <p className="text-[11px] text-[#D40A12] font-bold uppercase tracking-[1.5px]">{c.role}</p>}
                                                    </div>
                                                </div>
                                                
                                                <div className="p-6 flex-1 flex flex-col gap-5 bg-[#0A0A0A]">
                                                    {c.description && (
                                                        <p className="text-[13px] text-[#999] leading-relaxed flex-1">
                                                            {c.description}
                                                        </p>
                                                    )}
                                                    
                                                    {c.prompt && (
                                                        <div className="bg-black/50 border border-white/[0.05] rounded-xl p-4 mt-auto">
                                                            <span className="text-[9px] text-[#666] font-bold uppercase tracking-[1.5px] block mb-2 flex items-center gap-1.5">
                                                                <ImageIcon size={10}/> Visual Prompt
                                                            </span>
                                                            <p className="text-[11px] text-[#888] font-mono leading-relaxed whitespace-pre-wrap break-words">{c.prompt}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-white/[0.01] rounded-2xl border border-white/[0.03]">
                                        <p className="text-[11px] text-[#666] tracking-[2px] uppercase">No characters defined.</p>
                                    </div>
                                )}
                            </section>

                            {/* Locations */}
                            <section>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                        <MapPin size={18} className="text-[#3B82F6]" />
                                    </div>
                                    <h2 className="text-2xl font-semibold tracking-tight text-white">Locations</h2>
                                </div>
                                {locations.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {locations.map(l => (
                                            <div key={l.id} className="flex flex-col bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-all group">
                                                <div className="relative aspect-video overflow-hidden bg-[#1a1a1a]">
                                                    {l.image_url ? (
                                                        <>
                                                            <img src={l.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={l.name} />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent"></div>
                                                        </>
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                                                            <MapPin size={32} className="mb-2" />
                                                            <span className="text-[10px] uppercase tracking-widest">No Image</span>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                                                        <h3 className="font-bold text-2xl text-white mb-1 tracking-tight">{l.name}</h3>
                                                    </div>
                                                </div>
                                                
                                                <div className="p-6 flex-1 flex flex-col gap-5 bg-[#0A0A0A]">
                                                    {l.description && (
                                                        <p className="text-[13px] text-[#999] leading-relaxed flex-1">
                                                            {l.description}
                                                        </p>
                                                    )}
                                                    
                                                    {l.prompt && (
                                                        <div className="bg-black/50 border border-white/[0.05] rounded-xl p-4 mt-auto">
                                                            <span className="text-[9px] text-[#666] font-bold uppercase tracking-[1.5px] block mb-2 flex items-center gap-1.5">
                                                                <ImageIcon size={10}/> Visual Prompt
                                                            </span>
                                                            <p className="text-[11px] text-[#888] font-mono leading-relaxed whitespace-pre-wrap break-words">{l.prompt}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-white/[0.01] rounded-2xl border border-white/[0.03]">
                                        <p className="text-[11px] text-[#666] tracking-[2px] uppercase">No locations defined.</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                )}

                {/* ─── STORYBOARD TAB ─── */}
                {activeTab === 'storyboard' && (
                    <div className="flex h-[calc(100vh-135px)] animate-in fade-in duration-500">
                        {/* LEFT: Scene List */}
                        <div className="w-[380px] bg-[#111111] border-r border-white/[0.04] overflow-y-auto shrink-0 custom-scrollbar relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
                            <div className="sticky top-0 bg-[#111111]/95 backdrop-blur px-6 py-5 border-b border-white/[0.04] z-20">
                                <span className="text-[10px] text-[#888] font-bold uppercase tracking-[2px]">Timeline</span>
                            </div>

                            <div className="p-4 space-y-4">
                                {scenes.map((scene) => (
                                    <div key={scene.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden transition-colors">
                                        <button
                                            onClick={() => toggleScene(scene.id)}
                                            className="w-full flex items-center justify-between px-4 py-4 text-left cursor-pointer bg-transparent border-none hover:bg-white/[0.02] transition-colors group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#111] to-[#222] border border-white/[0.1] flex items-center justify-center shadow-inner group-hover:border-white/[0.2] transition-colors">
                                                    <span className="text-[11px] font-bold text-white">{scene.scene_number}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 text-[11px] text-white font-medium mb-1 line-clamp-1">
                                                        {scene.location && (
                                                            <span className="flex items-center gap-1.5">
                                                                <MapPin size={10} className="text-[#D40A12]" />
                                                                {scene.location}
                                                            </span>
                                                        )}
                                                        {scene.time_of_day && (
                                                            <span className="flex items-center gap-1.5 text-[#888]">
                                                                <Sun size={10} />
                                                                {scene.time_of_day}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[9px] text-[#666] font-medium tracking-wide uppercase">{scene.shots.length} sequence{scene.shots.length !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center border border-white/[0.05]">
                                                {expandedScenes.has(scene.id) ? (
                                                    <ChevronUp size={12} className="text-[#888]" />
                                                ) : (
                                                    <ChevronDown size={12} className="text-[#888]" />
                                                )}
                                            </div>
                                        </button>

                                        {/* Shots Grid */}
                                        <div className={`transition-all duration-300 overflow-hidden ${expandedScenes.has(scene.id) ? 'max-h-[2000px] opacity-100 pb-4 px-4' : 'max-h-0 opacity-0'}`}>
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                {scene.shots.map((shot) => (
                                                    <div
                                                        key={shot.id}
                                                        onClick={() => { setActiveShot(shot); setPlaying(false); }}
                                                        className={`aspect-video rounded-lg overflow-hidden cursor-pointer transition-all duration-300 relative group ${
                                                            activeShot?.id === shot.id
                                                                ? 'ring-2 ring-[#D40A12] ring-offset-2 ring-offset-[#111111] shadow-[0_4px_20px_rgba(212,10,18,0.3)]'
                                                                : 'ring-1 ring-white/[0.1] hover:ring-white/[0.3] hover:shadow-lg'
                                                        }`}
                                                    >
                                                        {shot.image_url ? (
                                                            <img
                                                                src={shot.image_url}
                                                                alt=""
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                                                                <Camera size={14} className="text-[#333]" />
                                                            </div>
                                                        )}
                                                        {shot.video_url && (
                                                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/[0.1]">
                                                                <Play size={8} className="text-white ml-0.5" fill="white" />
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-6 pb-2 px-2">
                                                            <span className="text-[8px] text-[#AAA] font-bold uppercase tracking-widest">{shot.shot_type || 'SHOT'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: Shot Viewer */}
                        <div className="flex-1 bg-[#0A0A0A] relative flex flex-col min-w-0">
                            {activeShot ? (
                                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                    {/* Media Area */}
                                    <div className="flex-1 flex items-center justify-center p-8 bg-[url('/noise.png')] relative">
                                        <div className="absolute inset-0 bg-gradient-to-b from-[#111] to-[#111111] opacity-50"></div>
                                        
                                        <div className="relative z-10 w-full max-w-5xl aspect-video rounded-2xl overflow-hidden ring-1 ring-white/[0.1] shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
                                            {activeShot.video_url ? (
                                                <>
                                                    <video
                                                        ref={videoRef}
                                                        key={activeShot.id}
                                                        src={activeShot.video_url}
                                                        poster={activeShot.image_url}
                                                        loop
                                                        muted={muted}
                                                        playsInline
                                                        className="w-full h-full object-contain bg-black"
                                                        onPlay={() => setPlaying(true)}
                                                        onPause={() => setPlaying(false)}
                                                    />
                                                    {/* Custom Controls */}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                                        <button
                                                            onClick={togglePlay}
                                                            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 transition-all border border-white/20 shadow-2xl"
                                                        >
                                                            {playing ? <Pause size={32} /> : <Play size={32} className="ml-2" fill="white" />}
                                                        </button>
                                                    </div>
                                                    <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setMuted(!muted)}
                                                            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-all border border-white/10"
                                                        >
                                                            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                                        </button>
                                                    </div>
                                                </>
                                            ) : activeShot.image_url ? (
                                                <img
                                                    src={activeShot.image_url}
                                                    alt=""
                                                    className="w-full h-full object-contain bg-black"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-[#1a1a1a] flex flex-col items-center justify-center text-[#444]">
                                                    <Camera size={48} className="mb-4 opacity-50" />
                                                    <span className="text-sm font-bold tracking-widest uppercase">No media generated</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Context Panel */}
                                    <div className="w-full lg:w-[450px] bg-[#111111] border-l border-white/[0.04] overflow-y-auto custom-scrollbar shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                                        <div className="p-8 space-y-8">
                                            {/* Action & Dialogue */}
                                            <div className="space-y-6">
                                                <div>
                                                    <h3 className="text-[10px] text-[#D40A12] font-bold uppercase tracking-[2px] mb-3 flex items-center gap-2">
                                                        <Camera size={12} /> Cinematic Direction
                                                    </h3>
                                                    <div className="flex gap-2 mb-4 flex-wrap">
                                                        {activeShot.shot_type && (
                                                            <span className="px-3 py-1 rounded bg-white/[0.05] border border-white/[0.1] text-[11px] font-medium text-white">{activeShot.shot_type}</span>
                                                        )}
                                                        {activeShot.camera_movement && (
                                                            <span className="px-3 py-1 rounded bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[11px] font-medium text-[#3B82F6]">{activeShot.camera_movement}</span>
                                                        )}
                                                    </div>
                                                    {activeShot.visual_action && (
                                                        <p className="text-[14px] text-white/90 leading-relaxed font-medium">
                                                            {activeShot.visual_action}
                                                        </p>
                                                    )}
                                                </div>

                                                {activeShot.dialogue && (
                                                    <div className="bg-white/[0.02] border border-white/[0.05] p-5 rounded-xl relative">
                                                        <Quote size={24} className="absolute top-4 right-4 text-white/[0.05]" />
                                                        <span className="text-[10px] text-[#8B5CF6] font-bold uppercase tracking-[2px] block mb-2">
                                                            {activeShot.character_name || "Dialogue"}
                                                        </span>
                                                        <p className="text-[13px] text-white/80 italic leading-relaxed">
                                                            "{activeShot.dialogue}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Technical Prompts */}
                                            <div className="space-y-4 pt-6 border-t border-white/[0.04]">
                                                <h3 className="text-[10px] text-[#888] font-bold uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                                    <Sparkles size={12} /> AI Generation Prompts
                                                </h3>
                                                
                                                {activeShot.prompt ? (
                                                    <div className="bg-[#0A0A0A] border border-white/[0.05] rounded-xl overflow-hidden group">
                                                        <div className="bg-white/[0.02] px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                                                            <span className="text-[9px] text-[#A8A29E] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                                                <ImageIcon size={10} /> Base Image Prompt
                                                            </span>
                                                        </div>
                                                        <div className="p-4 bg-black/20">
                                                            <p className="text-[11px] text-white/60 font-mono leading-relaxed whitespace-pre-wrap break-words">
                                                                {activeShot.prompt}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {activeShot.video_prompt ? (
                                                    <div className="bg-[#0A0A0A] border border-[#38BDF8]/10 rounded-xl overflow-hidden group">
                                                        <div className="bg-[#38BDF8]/[0.02] px-4 py-2.5 border-b border-[#38BDF8]/10 flex items-center justify-between">
                                                            <span className="text-[9px] text-[#38BDF8] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                                                <Video size={10} /> Motion Generation
                                                            </span>
                                                        </div>
                                                        <div className="p-4 bg-black/20">
                                                            <p className="text-[11px] text-[#38BDF8]/80 font-mono leading-relaxed whitespace-pre-wrap break-words">
                                                                {activeShot.video_prompt}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                
                                                {!activeShot.prompt && !activeShot.video_prompt && (
                                                    <p className="text-[11px] text-[#444] font-medium italic">No generation prompts available for this shot.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('/noise.png')] relative">
                                    <div className="absolute inset-0 bg-gradient-to-b from-[#111] to-[#111111] opacity-50"></div>
                                    <div className="relative z-10 text-center max-w-md">
                                        <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                                            <Film size={32} className="text-[#333]" />
                                        </div>
                                        <h3 className="text-xl font-medium text-white mb-2 tracking-tight">Select a sequence</h3>
                                        <p className="text-sm text-[#666] leading-relaxed">Choose a shot from the timeline on the left to preview the media and explore the generation prompts.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── SCRIPT TAB ─── */}
                {activeTab === 'script' && (
                    <div className="p-6 lg:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                    <FileText size={18} className="text-[#D40A12]" />
                                </div>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">Master Screenplay</h2>
                            </div>
                            
                            {script ? (
                                <div className="relative">
                                    <div className="absolute -inset-1 bg-gradient-to-b from-white/[0.05] to-transparent rounded-3xl blur-md"></div>
                                    <div className="relative bg-[#0A0A0A] p-8 md:p-16 rounded-2xl border border-white/[0.05] shadow-2xl">
                                        <pre className="font-mono text-[13px] md:text-sm leading-[2] text-[#CCC] whitespace-pre-wrap font-medium">
                                            {script}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-32 bg-white/[0.01] rounded-2xl border border-white/[0.03] backdrop-blur-sm">
                                    <FileText size={40} className="mx-auto text-white/[0.1] mb-4" />
                                    <p className="text-[12px] text-[#666] tracking-[2px] uppercase font-semibold">No script available</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
                
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slide-in-from-bottom-4 {
                    from { transform: translateY(1rem); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-in { animation: fade-in 0.5s ease-out forwards; }
                .fade-in { animation-name: fade-in; }
                .slide-in-from-bottom-4 { animation-name: slide-in-from-bottom-4; }
                .duration-500 { animation-duration: 500ms; }
            `}</style>
        </div>
    );
}
