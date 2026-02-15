"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import {
    Loader2, User, Film, Play, X, SplitSquareHorizontal, RefreshCw,
    CheckCircle2, Scan, Sliders, Zap, Wand2, MousePointer2,
    Maximize2, Download, ChevronRight, Save, Aperture, Palette, Brush, RectangleHorizontal, RectangleVertical, Monitor
} from "lucide-react";


// Reuse your existing Inpaint Component
import { InpaintEditor } from "@/app/components/storyboard/InpaintEditor";
import GlobalHeader from "@/components/GlobalHeader";

// --- TYPES ---
interface CastCluster {
    id: string;
    label_id: number;
    original_face_url: string;
    new_face_url?: string;
    status: string;
}

interface Tag {
    label_id: number;
    x: number;
    y: number;
}

interface AdaptationShot {
    id: string;
    image_url: string;
    video_url?: string;
    status: string;
    manual_tags?: Tag[];
    order?: number;
}

// --- MANIFEST TYPES ---
type MoodOption = {
    id: string;
    label: string;
    sub_label: string;
    image_url: string;
};

type MoodAxis = {
    id: string;
    code_prefix: string;
    label: string;
    description: string;
    options: MoodOption[];
};

type Manifest = {
    axes: MoodAxis[];
};

// --- COMPONENT: IMAGE ZOOM MODAL ---
const ImageZoomModal = ({ url, onClose }: { url: string, onClose: () => void }) => {
    if (!url) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 backdrop-blur-sm" onClick={onClose}>
            <button className="absolute top-4 right-4 text-white hover:text-red-500 transition-colors">
                <X size={32} />
            </button>
            <img src={url} className="max-w-full max-h-full object-contain shadow-2xl border border-[#333]" onClick={(e) => e.stopPropagation()} />
        </div>
    );
};

// --- COMPONENT: MOODBOARD SIDEBAR ---
const MoodboardSidebar = ({
    manifest,
    currentLighting,
    currentColor,
    onSelect,
    onClose
}: {
    manifest: Manifest | null,
    currentLighting: string,
    currentColor: string,
    onSelect: (type: 'lighting' | 'color', value: string) => void,
    onClose: () => void
}) => {
    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60] transition-opacity" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-[500px] xl:w-[600px] bg-[#0A0A0A] border-l border-[#333] z-[70] flex flex-col shadow-2xl slide-in-from-right duration-300">
                <div className="h-16 border-b border-[#222] flex items-center justify-between px-6 bg-[#111] shrink-0">
                    <div className="flex items-center gap-3">
                        <Aperture className="text-red-600 animate-spin-slow" size={18} />
                        <span className="text-sm font-bold uppercase tracking-[0.2em] text-white">Visual Matrix</span>
                    </div>
                    <button onClick={onClose} className="hover:text-white text-[#666] transition-colors"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-12 dark-scrollbar">
                    {!manifest ? (
                        <div className="flex flex-col items-center justify-center py-20 text-[#444]"><Loader2 className="animate-spin text-red-600 mb-2" /><span className="text-xs font-mono">LOADING ASSETS...</span></div>
                    ) : (
                        manifest.axes.map((axis) => {
                            const labelLower = axis.label.toLowerCase();
                            let type: 'lighting' | 'color' | null = null;
                            if (axis.code_prefix === "A" || labelLower.includes("light")) type = 'lighting';
                            else if (axis.code_prefix === "B" || labelLower.includes("color") || labelLower.includes("look")) type = 'color';

                            if (!type) return null;
                            const currentVal = type === 'lighting' ? currentLighting : currentColor;

                            return (
                                <div key={axis.id} className="space-y-4">
                                    <div className="flex items-end gap-3 border-b border-[#222] pb-2 sticky top-0 bg-[#0A0A0A] z-10">
                                        <span className="text-sm font-bold uppercase text-white tracking-widest">{axis.label}</span>
                                        <span className="text-[9px] font-mono text-[#444] mb-0.5">// {axis.description}</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {axis.options.map((option) => {
                                            const isSelected = currentVal === option.label;
                                            return (
                                                <button key={option.id} onClick={() => onSelect(type!, option.label)} className={`relative aspect-[16/10] group overflow-hidden transition-all duration-200 rounded-sm border ${isSelected ? 'border-red-600 z-10 opacity-100 ring-1 ring-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'border-transparent opacity-50 hover:opacity-100 hover:border-[#444]'}`}>
                                                    <img src={option.image_url} alt={option.label} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                                    <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent transition-opacity ${isSelected ? 'opacity-80' : 'opacity-60 group-hover:opacity-80'}`} />
                                                    <div className="absolute bottom-0 left-0 w-full p-2 flex justify-between items-end">
                                                        <div className="text-left w-full"><div className={`text-[7px] font-mono mb-0.5 ${isSelected ? 'text-red-500' : 'text-[#888]'}`}>{option.id}</div><div className="text-[9px] font-bold uppercase text-white tracking-wider truncate">{option.label}</div></div>
                                                        {isSelected && <div className="h-1.5 w-1.5 bg-red-600 rounded-full shadow-[0_0_5px_#EF4444] mb-1 mr-1 shrink-0" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
};

// --- COMPONENT: TAGGING PANEL ---
const TaggingPanel = ({ shot, clusters, onClose, onSave }: { shot: AdaptationShot, clusters: CastCluster[], onClose: () => void, onSave: (tags: Tag[]) => void }) => {
    const [tags, setTags] = useState<Tag[]>(shot.manual_tags || []);
    const [selectedTagIndex, setSelectedTagIndex] = useState<number | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const handleImageClick = (e: React.MouseEvent) => {
        if (!imgRef.current) return;
        const rect = imgRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const newTags = [...tags, { label_id: -1, x, y }];
        setTags(newTags);
        setSelectedTagIndex(newTags.length - 1);
    };

    const handleAssign = (labelId: number) => {
        if (selectedTagIndex === null) return;
        const newTags = [...tags];
        newTags[selectedTagIndex].label_id = labelId;
        setTags(newTags);
        setSelectedTagIndex(null);
    };

    const handleRemove = (index: number) => {
        const newTags = tags.filter((_, i) => i !== index);
        setTags(newTags);
        if (selectedTagIndex === index) setSelectedTagIndex(null);
    };

    const handleSave = () => {
        const validTags = tags.filter(t => t.label_id !== -1);
        onSave(validTags);
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60]" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-[500px] bg-[#0A0A0A] border-l border-[#333] z-[70] flex flex-col shadow-2xl slide-in-from-right duration-300">
                <div className="h-16 border-b border-[#222] flex items-center justify-between px-6 bg-[#111]">
                    <h3 className="font-anton uppercase tracking-wide text-lg flex items-center gap-2 text-white">
                        <MousePointer2 size={18} className="text-[#FF0000]" /> Tagging Mode
                    </h3>
                    <button onClick={onClose} className="hover:text-white text-[#666]"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="relative border border-[#333] bg-black group cursor-crosshair">
                        <img ref={imgRef} src={shot.image_url} className="w-full object-contain" onClick={handleImageClick} />
                        {tags.map((tag, i) => (
                            <div
                                key={i}
                                onClick={(e) => { e.stopPropagation(); setSelectedTagIndex(i); }}
                                className={`absolute w-4 h-4 -ml-2 -mt-2 border-2 rounded-full cursor-pointer z-10 transition-all ${selectedTagIndex === i ? 'border-[#FF0000] bg-white scale-125' : 'border-white bg-black/50 hover:scale-110'}`}
                                style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
                            />
                        ))}
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#222] pb-2">{selectedTagIndex !== null ? "Select Actor" : "Assigned Tags"}</h4>
                        {selectedTagIndex !== null ? (
                            <div className="grid grid-cols-2 gap-2">
                                {clusters.map(c => (
                                    <button key={c.id} onClick={() => handleAssign(c.label_id)} className="flex items-center gap-3 p-2 bg-[#111] border border-[#333] hover:border-[#FF0000] hover:bg-[#1a1a1a] rounded-sm transition-all text-left group">
                                        <div className="w-8 h-8 bg-black rounded-sm overflow-hidden shrink-0 border border-white/10">{c.new_face_url ? <img src={c.new_face_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-600" />}</div>
                                        <div className="flex flex-col"><span className="text-[10px] font-bold text-white font-mono group-hover:text-[#FF0000]">CHAR #{c.label_id}</span></div>
                                    </button>
                                ))}
                                <button onClick={() => handleRemove(selectedTagIndex)} className="col-span-2 mt-2 bg-red-900/20 text-red-500 text-xs py-2 rounded border border-red-900/50">DELETE MARKER</button>
                            </div>
                        ) : (
                            <div className="space-y-2">{tags.map((tag, i) => (<div key={i} className="flex justify-between bg-[#111] p-2 rounded border border-[#222]"><span className="text-xs">Marker {i + 1} → #{tag.label_id}</span><button onClick={() => handleRemove(i)}><X size={12} /></button></div>))}</div>
                        )}
                    </div>
                </div>
                <div className="p-6 border-t border-[#222] bg-[#111] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-[#666]">CANCEL</button>
                    <button onClick={handleSave} className="bg-[#FF0000] text-black px-6 py-2 rounded-sm text-xs font-bold">SAVE & CLOSE</button>
                </div>
            </div>
        </>
    );
};

// --- SUB-COMPONENT: SIDE-BY-SIDE CARD ---
const SideBySideCard = ({ shot, index, onDelete, onRegenerate, onOpenTagging, onZoom, onInpaint }: any) => {

    const handleDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="bg-[#111] border border-[#333] p-3 rounded-sm flex flex-col gap-3 group/card hover:border-[#444] transition-colors">
            {/* <GlobalHeader /> */}
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[#222] pb-2">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[#666] bg-[#1a1a1a] px-1.5 py-0.5 rounded">SHOT {String(index + 1).padStart(2, '0')}</span>
                    {shot.manual_tags?.length > 0 && <div className="flex items-center gap-1 text-[9px] text-green-500 font-mono"><CheckCircle2 size={10} /> {shot.manual_tags.length} TAGS</div>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onOpenTagging} className="text-[10px] px-2 py-1 border border-[#333] rounded-sm flex items-center gap-1.5 text-[#888] hover:text-white hover:border-[#666] transition-all bg-black"><MousePointer2 size={10} /> TAG ACTORS</button>
                    <button onClick={onDelete} className="hover:text-red-500 p-1 text-[#444]"><X size={14} /></button>
                </div>
            </div>

            <div className="flex gap-3 h-56">
                {/* Left: Original */}
                <div className="relative flex-1 bg-black border border-[#222] group overflow-hidden">
                    <img src={shot.image_url} className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 left-2 bg-black/60 text-[8px] text-white px-1.5 py-0.5 font-mono backdrop-blur-sm pointer-events-none rounded-sm">ORIGINAL</div>
                </div>

                <div className="w-px bg-[#222] flex items-center justify-center"><div className="w-4 h-4 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-[#444]"><ChevronRight size={10} /></div></div>

                {/* Right: Adaptation */}
                <div className="relative flex-1 bg-black border border-[#222] flex items-center justify-center overflow-hidden group">
                    {shot.status === 'rendering' ? (
                        <div className="flex flex-col items-center gap-3"><Loader2 className="animate-spin text-[#FF0000]" size={24} /><span className="text-[9px] text-[#666] animate-pulse font-mono tracking-widest">GENERATING</span></div>
                    ) : shot.video_url ? (
                        <>
                            <img src={shot.video_url} className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                <button onClick={() => onZoom(shot.video_url)} className="p-2 bg-white text-black rounded-full hover:scale-110 shadow-lg"><Maximize2 size={16} /></button>
                                {/* INPAINT BUTTON */}
                                <button onClick={onInpaint} className="p-2 bg-white text-black rounded-full hover:scale-110 shadow-lg" title="Inpaint / Fix"><Brush size={16} /></button>
                                <button onClick={() => handleDownload(shot.video_url, `shot_${index + 1}.png`)} className="p-2 bg-white text-black rounded-full hover:scale-110 shadow-lg"><Download size={16} /></button>
                            </div>
                        </>
                    ) : (
                        <div className="text-[9px] text-[#333] font-mono flex flex-col items-center gap-2"><div className="w-10 h-10 rounded-full border border-[#222] bg-[#0A0A0A] flex items-center justify-center text-[#222]"><Film size={16} /></div>WAITING</div>
                    )}
                    {shot.status === 'rendered' && <div className="absolute top-2 left-2 bg-[#FF0000] text-black text-[8px] font-bold px-1.5 py-0.5 font-mono rounded-sm shadow-lg">ADAPTATION</div>}

                    <button onClick={onRegenerate} disabled={shot.status === 'rendering'} className="absolute bottom-3 bg-black/60 hover:bg-white text-white hover:text-black backdrop-blur-md px-3 py-1.5 rounded-sm text-[9px] font-bold transition-all flex items-center gap-2 disabled:opacity-0 border border-white/10 hover:border-transparent uppercase tracking-wider"><Wand2 size={10} /> {shot.video_url ? "Regenerate" : "Generate"}</button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN PAGE ---
export default function AdaptationPage() {
    const params = useParams();
    const projectId = params?.id as string;

    const [status, setStatus] = useState<string>("init");
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isStartingRender, setIsStartingRender] = useState(false);
    const [uploadingCast, setUploadingCast] = useState<string | null>(null);
    const [isDeletingCluster, setIsDeletingCluster] = useState<string | null>(null);

    const [activeShotForTagging, setActiveShotForTagging] = useState<AdaptationShot | null>(null);
    const [activeShotForInpaint, setActiveShotForInpaint] = useState<AdaptationShot | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [showMoodboard, setShowMoodboard] = useState(false);

    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [selectedLighting, setSelectedLighting] = useState("Cinematic");
    const [selectedColor, setSelectedColor] = useState("Standard");

    const [clusters, setClusters] = useState<CastCluster[]>([]);
    const [shots, setShots] = useState<AdaptationShot[]>([]);
    const [isLoadingShots, setIsLoadingShots] = useState(true);
    const [aspectRatio, setAspectRatio] = useState("9:16");

    useEffect(() => {
        if (!projectId || projectId === "new") return;
        const u1 = onSnapshot(doc(db, "projects", projectId), async (d) => {
            const data = d.data();
            if (data) {
                setStatus(data.status || "init");
                if (data.adaptation_settings) {
                    if (data.adaptation_settings.lighting) setSelectedLighting(data.adaptation_settings.lighting);
                    if (data.adaptation_settings.color) setSelectedColor(data.adaptation_settings.color);
                }
            }
        });
        const u2 = async () => {
            try {
                const s = await getDoc(doc(db, "configs", "moodboard_manifest"));
                if (s.exists()) setManifest(s.data() as Manifest);
            } catch (e) { }
        }; u2();
        const u3 = onSnapshot(query(collection(db, "projects", projectId, "cast_clusters"), orderBy("label_id")), (s) => setClusters(s.docs.map(d => ({ id: d.id, ...d.data() } as CastCluster))));
        const u4 = onSnapshot(collection(db, "projects", projectId, "episodes", "main", "scenes", "scene_01", "shots"), (s) => {
            const list = s.docs.map(d => ({ id: d.id, ...d.data() } as AdaptationShot));
            list.sort((a, b) => (a.order || 0) - (b.order || 0));
            setShots(list);
            setIsLoadingShots(false);
        });
        return () => { u1(); u3(); u4(); };
    }, [projectId]);

    const updateProjectSettings = async (type: 'lighting' | 'color', value: string) => {
        let newLight = selectedLighting;
        let newColor = selectedColor;
        if (type === 'lighting') { setSelectedLighting(value); newLight = value; }
        if (type === 'color') { setSelectedColor(value); newColor = value; }
        try { await updateDoc(doc(db, "projects", projectId), { adaptation_settings: { lighting: newLight, color: newColor } }); toast.success("Style Updated"); } catch (e) { }
    };

    const handleRegenerate = async (shotId: string, tags?: Tag[]) => {
        const shotData = shots.find(s => s.id === shotId);
        const finalTags = tags || shotData?.manual_tags || [];
        toast("Processing Shot...", { icon: "🎨" });
        try {
            await api.post(`/api/v1/adaptation/project/${projectId}/shot/${shotId}/regenerate`, {
                lighting: selectedLighting,
                color_grade: selectedColor,
                manual_tags: finalTags,
                aspect_ratio: aspectRatio,
            });
        } catch (e: any) {
            if (e.response?.status === 402) toast.error("Insufficient Credits");
            else toast.error("Generation Failed");
        }
    };

    // --- FIX IS HERE ---
    // Removed 'setActiveShotForInpaint(null)' from success path
    const handleInpaintSave = async (prompt: string, maskBase64: string, refImages: File[]) => {
        if (!activeShotForInpaint) return null;
        const shotId = activeShotForInpaint.id;

        const sourceUrl = activeShotForInpaint.video_url || activeShotForInpaint.image_url;

        try {
            const fd = new FormData();
            fd.append("project_id", projectId);
            fd.append("shot_id", shotId);
            fd.append("prompt", prompt);
            fd.append("original_image_url", sourceUrl);
            fd.append("mask_image_base64", maskBase64);

            if (refImages.length > 0) {
                refImages.forEach((file) => {
                    fd.append("reference_images", file);
                });
            }

            const res = await api.post("/api/v1/shot/inpaint_shot", fd, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data.status === "success" && res.data.image_url) {
                await updateDoc(doc(db, "projects", projectId, "episodes", "main", "scenes", "scene_01", "shots", shotId), {
                    video_url: res.data.image_url,
                    status: "rendered"
                });
                toast.success("Edit Generated! Click Apply to Save.");
                // DO NOT CLOSE HERE. Let user see it in editor.
                return res.data.image_url;
            }

            return null;

        } catch (e: any) {
            console.error("Inpaint Error:", e);
            if (e.response?.status === 402) toast.error("Insufficient Credits");
            else toast.error("Inpaint failed");
            return null;
        }
    };

    const handleReset = async () => { try { await updateDoc(doc(db, "projects", projectId), { status: "ready_for_casting" }); } catch (e) { } };
    const handleRetryDetection = async () => { if (!confirm("Re-run?")) return; try { await api.post(`/api/v1/adaptation/analyze/${projectId}`); } catch (e) { } };
    const handleDeleteCluster = async (c: any) => { if (!confirm("Delete?")) return; setIsDeletingCluster(c.id); try { await api.delete(`/api/v1/adaptation/project/${projectId}/cluster/${c.id}`); } catch (e) { } finally { setIsDeletingCluster(null) } };
    const handleUpload = async () => { if (!file) return; setIsUploading(true); const fd = new FormData(); fd.append("file", file); fd.append("title", title); try { await api.post("/api/v1/adaptation/create_adaptation", fd); } catch (e) { } };
    const handleCastUpload = async (cid: string, f: File) => {
        setUploadingCast(cid);
        const fd = new FormData();
        fd.append("file", f);

        try {
            const r = await api.post("/api/v1/adaptation/upload_temp", fd, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            await updateDoc(doc(db, "projects", projectId, "cast_clusters", cid), {
                new_face_url: r.data.url,
                status: "mapped"
            });
        } catch (e) {
            console.error("Upload failed", e);
            toast.error("Upload failed");
        } finally {
            setUploadingCast(null);
        }
    };
    const handleDeleteShot = async (sid: string) => { if (!confirm("Delete?")) return; try { await deleteDoc(doc(db, "projects", projectId, "episodes", "main", "scenes", "scene_01", "shots", sid)); } catch (e) { } };
    const handleStartRender = async () => { setIsStartingRender(true); try { await updateDoc(doc(db, "projects", projectId), { adaptation_settings: { lighting: selectedLighting, color: selectedColor } }); await api.post(`/api/v1/adaptation/start_render/${projectId}`); } catch (e) { } finally { setIsStartingRender(false) } };

    const isProjectRendering = status === 'rendering_adaptation' || status === 'completed';

    if (status.includes("analyzing") || status === "uploading") return <div className="h-screen bg-[#050505] flex justify-center items-center text-white"><Loader2 className="animate-spin text-red-600 mr-2" /> PROCESSING...</div>;
    if (status === "init") return <div className="h-screen bg-[#050505] flex justify-center items-center"><div className="border border-[#333] p-10"><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-white" /><button onClick={handleUpload} disabled={isUploading} className="bg-red-600 text-white p-2 mt-4 w-full">START ENGINE</button></div></div>;

    return (
        <div className="h-screen w-full bg-[#050505] text-white flex flex-col overflow-hidden relative">

            {zoomedImage && <ImageZoomModal url={zoomedImage} onClose={() => setZoomedImage(null)} />}

            {/* INPAINT EDITOR */}
            {activeShotForInpaint && (activeShotForInpaint.video_url || activeShotForInpaint.image_url) && (
                <InpaintEditor
                    src={activeShotForInpaint.video_url || activeShotForInpaint.image_url}
                    onClose={() => setActiveShotForInpaint(null)}
                    styles={{}}
                    // ADD THIS: Closes the modal when user clicks Apply
                    onApply={() => setActiveShotForInpaint(null)}
                    onSave={handleInpaintSave}
                />
            )}

            {activeShotForTagging && (
                <TaggingPanel
                    shot={activeShotForTagging}
                    clusters={clusters}
                    onClose={() => setActiveShotForTagging(null)}
                    onSave={(newTags) => handleRegenerate(activeShotForTagging.id, newTags)}
                />
            )}

            <div className="flex gap-2">
                {[
                    { id: '16:9', label: '16:9', sub: 'Cinema', icon: RectangleHorizontal },
                    { id: '21:9', label: '21:9', sub: 'Wide', icon: Monitor },
                    { id: '9:16', label: '9:16', sub: 'Social', icon: RectangleVertical },
                ].map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => setAspectRatio(opt.id as any)}
                        className={`flex-1 py-3 border rounded-sm flex flex-col items-center justify-center gap-1 transition-all ${aspectRatio === opt.id
                            ? 'border-white bg-[#222] text-white'
                            : 'border-[#222] bg-[#0E0E0E] text-[#555] hover:border-[#444]'
                            }`}
                    >
                        <opt.icon size={14} />
                        <span className="text-[10px] font-bold tracking-wider">{opt.label}</span>
                    </button>
                ))}
            </div>

            {showMoodboard && (
                <MoodboardSidebar
                    manifest={manifest}
                    currentLighting={selectedLighting}
                    currentColor={selectedColor}
                    onSelect={updateProjectSettings}
                    onClose={() => setShowMoodboard(false)}
                />
            )}

            <div className="h-16 border-b border-[#222] flex items-center justify-between px-8 bg-[#0A0A0A] shrink-0">
                <div className="flex items-center gap-3">
                    {isProjectRendering ? <SplitSquareHorizontal className="text-[#FF0000] animate-pulse" size={20} /> : <User className="text-[#FF0000]" size={20} />}
                    <h1 className="font-anton uppercase text-xl tracking-wide">{isProjectRendering ? "Live Production" : "Digital Casting"}</h1>
                </div>
                <div className="flex items-center gap-6">
                    {!status.includes('analyzing') && (
                        <div className="flex items-center gap-3 mr-4 border-r border-[#333] pr-6">
                            <button onClick={() => setShowMoodboard(true)} className="flex items-center gap-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] px-3 py-1.5 rounded-sm transition-all group">
                                <Zap size={12} className="text-[#666] group-hover:text-red-500" />
                                <span className="text-[10px] font-mono text-white uppercase">{selectedLighting}</span>
                            </button>
                            <button onClick={() => setShowMoodboard(true)} className="flex items-center gap-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] px-3 py-1.5 rounded-sm transition-all group">
                                <Palette size={12} className="text-[#666] group-hover:text-red-500" />
                                <span className="text-[10px] font-mono text-white uppercase">{selectedColor}</span>
                            </button>
                        </div>
                    )}
                    {!isProjectRendering && <button onClick={handleRetryDetection} className="flex items-center gap-2 text-[10px] font-mono text-[#666] hover:text-white border border-[#222] hover:border-[#666] px-3 py-1 rounded-sm transition-colors" title="Re-run Face Detection"><Scan size={12} /> RETRY DETECTION</button>}
                    {isProjectRendering && <button onClick={handleReset} className="flex items-center gap-2 text-[10px] font-mono text-[#444] hover:text-[#FF0000] border border-[#222] hover:border-[#FF0000] px-3 py-1 rounded-sm transition-colors" title="Force Reset Status"><RefreshCw size={10} /> RESET STATUS</button>}
                    <div className="flex gap-6 text-xs font-mono text-[#666]"><span>CLUSTERS: <span className="text-white">{clusters.length}</span></span><span>SHOTS: <span className="text-white">{shots.length}</span></span></div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-12 dark-scrollbar">
                <div className={isProjectRendering ? "opacity-30 pointer-events-none filter grayscale transition-all duration-500" : "transition-all duration-500"}>
                    <h3 className="text-xs font-bold text-[#666] uppercase tracking-[2px] mb-4 flex items-center gap-2"><User size={12} /> Character Mapping</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {clusters.map((cluster) => (
                            <div key={cluster.id} className="bg-[#111] border border-[#333] p-4 rounded-sm flex items-center gap-4 relative group hover:border-[#555] transition-colors">
                                <button onClick={() => handleDeleteCluster(cluster)} disabled={isDeletingCluster === cluster.id} className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 hover:scale-110 transition-all z-20 shadow-lg" title="Delete Character"><X size={12} /></button>
                                <div className="w-16 h-16 bg-black border border-[#222] rounded-sm overflow-hidden shrink-0"><img src={cluster.original_face_url} className="w-full h-full object-cover" /></div>
                                <div className="text-[#444] text-xs">→</div>
                                <div className="flex-1 h-16 border border-dashed border-[#333] bg-[#0A0A0A] rounded-sm flex flex-col items-center justify-center relative hover:border-[#FF0000] hover:bg-[#150505] transition-all cursor-pointer overflow-hidden">{uploadingCast === cluster.id ? <Loader2 className="animate-spin text-[#FF0000]" /> : cluster.new_face_url ? <img src={cluster.new_face_url} className="w-full h-full object-cover opacity-80" /> : <div className="text-[8px] font-mono uppercase text-[#666]">Assign Actor</div>}<input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" disabled={!!uploadingCast} onChange={(e) => { if (e.target.files?.[0]) handleCastUpload(cluster.id, e.target.files[0]); }} /></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-bold text-[#666] uppercase tracking-[2px] mb-4 flex items-center gap-2 border-t border-[#222] pt-8"><Film size={12} /> {isProjectRendering ? "Render Output" : "Scene Breakdown"}</h3>
                    {isLoadingShots ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#FF0000]" /></div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {shots.map((shot, i) => (
                                <SideBySideCard
                                    key={shot.id}
                                    shot={shot}
                                    index={i}
                                    clusters={clusters}
                                    onDelete={() => handleDeleteShot(shot.id)}
                                    onRegenerate={() => handleRegenerate(shot.id)}
                                    onOpenTagging={() => setActiveShotForTagging(shot)}
                                    onZoom={setZoomedImage}
                                    onInpaint={() => setActiveShotForInpaint(shot)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* {!isProjectRendering && (
                <div className="p-6 border-t border-[#222] bg-[#0A0A0A] flex justify-end"><button onClick={handleStartRender} disabled={isStartingRender || shots.length === 0} className="bg-[#FF0000] text-black font-anton uppercase px-8 py-3 hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50">{isStartingRender ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} fill="currentColor" />} CONFIRM CAST & RENDER</button></div>
            )} */}
        </div>
    );
}