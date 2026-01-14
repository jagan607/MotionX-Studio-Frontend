"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, doc, setDoc, getDoc, onSnapshot, writeBatch, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { ArrowLeft, MapPin, X, Users, LayoutTemplate, Camera, Upload, Sparkles, Loader2, Image as ImageIcon, Film, Plus, Wand2, Maximize2, Download } from "lucide-react";
import Link from "next/link";
import { Trash2, GripVertical } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';

import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';
import { API_BASE_URL } from "@/lib/config";
import { LogOut, Zap } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";



const InpaintEditor = ({ src, onSave, onClose, styles, onApply }: any) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(30);
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [outputImage, setOutputImage] = useState<string | null>(null); // NEW: Track output
    const { credits } = useCredits();



    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 800;
        canvas.height = 450;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = "rgba(255, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    const handleGenerateFix = async () => {
        if (!prompt) return alert("Please describe what to change.");
        setIsProcessing(true);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = 800; maskCanvas.height = 450;
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx && canvasRef.current) {
            mCtx.fillStyle = "black"; mCtx.fillRect(0, 0, 800, 450);
            mCtx.globalCompositeOperation = 'screen';
            mCtx.drawImage(canvasRef.current, 0, 0);
            mCtx.fillStyle = "white"; mCtx.globalCompositeOperation = 'source-in';
            mCtx.fillRect(0, 0, 800, 450);
        }
        const maskBase64 = maskCanvas.toDataURL('image/png');

        // We expect onSave to return the new image URL
        const newImageUrl = await onSave(prompt, maskBase64);
        if (newImageUrl) setOutputImage(newImageUrl);
        setIsProcessing(false);
    };

    return (
        <div style={styles.terminalOverlay}>
            <div style={{ ...styles.modal, width: '1200px', maxWidth: '95vw' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={styles.modalTitle}>INPAINT: FIX AREA</h2>
                    <div style={styles.infoBox}>
                        <Zap size={14} color="#FF0000" />
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>CREDITS</p>
                            <p style={{ fontSize: '10px', color: credits && credits > 0 ? '#FFF' : '#FF0000', fontWeight: 'bold' }}>
                                {credits !== null ? credits : '...'}
                            </p>
                        </div>
                    </div>
                    <X size={24} onClick={onClose} style={{ cursor: 'pointer' }} />
                </div>

                {/* DUAL COLUMN LAYOUT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>

                    {/* LEFT: INPUT BOX */}
                    <div>
                        <label style={{ ...styles.label, marginBottom: '10px' }}>INPUT: MASKING AREA</label>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid #333' }}>
                            <img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
                            <canvas
                                ref={canvasRef}
                                onMouseDown={() => setIsDrawing(true)}
                                onMouseUp={() => setIsDrawing(false)}
                                onMouseMove={draw}
                                style={{ position: 'absolute', inset: 0, zIndex: 5, cursor: 'crosshair', width: '100%', height: '100%' }}
                            />
                        </div>
                    </div>

                    {/* RIGHT: OUTPUT BOX */}
                    {/* RIGHT: OUTPUT BOX */}
                    <div>
                        <label style={{ ...styles.label, marginBottom: '10px' }}>OUTPUT: RENDERED FIX</label>
                        <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid #FF0000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                            {isProcessing ? (
                                <div style={{ textAlign: 'center' }}>
                                    <Loader2 className="spin-loader" size={48} color="#FF0000" />
                                    <p style={{ fontSize: '10px', marginTop: '10px', letterSpacing: '2px' }}>RE-RENDERING PIXELS...</p>
                                </div>
                            ) : outputImage ? (
                                <>
                                    <img src={outputImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    {/* APPLY FIX OVERLAY */}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', display: 'flex', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => onApply(outputImage)}
                                            style={{ ...styles.primaryBtn, width: 'auto', padding: '10px 30px', fontSize: '12px', height: '40px', backgroundColor: '#FF0000', color: '#fff' }}
                                        >
                                            APPLY & SAVE TO STORYBOARD
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: '#222', textAlign: 'center' }}>
                                    <ImageIcon size={48} strokeWidth={1} />
                                    <p style={{ fontSize: '10px', marginTop: '10px' }}>READY TO RENDER</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #222', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>BRUSH SIZE: {brushSize}px</label>
                            <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} style={{ width: '100%', accentColor: '#FF0000' }} />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label style={styles.label}>MODIFICATION PROMPT</label>
                            <textarea
                                style={{ ...styles.textareaInput, marginBottom: 0, height: '60px' }}
                                placeholder="Describe the change..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        </div>
                        <button style={{ ...styles.primaryBtn, width: '200px', height: '60px' }} onClick={handleGenerateFix} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="spin-loader" /> : <Sparkles size={18} />}
                            {isProcessing ? "PROCESSING..." : "GENERATE FIX"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- FIXED HELPER COMPONENT: STABLE IMAGE LOADING ---
// Uses CSS stacking instead of conditional rendering to prevent flickering
// --- REFINED SHOT IMAGE COMPONENT ---
const ShotImage = ({
    src,
    videoUrl,
    videoStatus,
    onClickZoom,
    onDownload,
    shotId,
    isSystemLoading,
    onStartInpaint,
    onAnimate
}: any) => {
    const [imageFullyDecoded, setImageFullyDecoded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Status Checks
    const isAnimating = videoStatus === 'animating';
    const isVideoReady = Boolean(videoUrl);

    useEffect(() => { setImageFullyDecoded(false); }, [src]);
    useEffect(() => { if (imgRef.current?.complete) setImageFullyDecoded(true); }, [src]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden' }}>

            {/* --- 1. LOADER OVERLAY --- 
          Shows if:
          - System is generating the initial image
          - Image isn't loaded yet
          - Video is currently animating
      */}
            {(isSystemLoading || !imageFullyDecoded || isAnimating) && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(5,5,5,0.9)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Loader2 className="spin-loader" size={32} color="#FF0000" />

                    {isAnimating && (
                        <div style={{ marginTop: '15px', textAlign: 'center' }}>
                            <p style={{ color: '#FF0000', fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
                                ANIMATING...
                            </p>
                            <p style={{ color: '#666', fontSize: '9px', marginTop: '5px', fontFamily: 'monospace' }}>
                                SEEDANCE 1.5 PRO
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* --- 2. MEDIA CONTENT --- */}
            {isVideoReady ? (
                // VIDEO PLAYER
                <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5 }}
                />
            ) : (
                // STATIC IMAGE
                src && (
                    <img
                        ref={imgRef}
                        src={src}
                        alt={`Shot ${shotId}`}
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5,
                            opacity: imageFullyDecoded ? 1 : 0, transition: 'opacity 0.3s ease-in'
                        }}
                        onLoad={() => setImageFullyDecoded(true)}
                    />
                )
            )}

            {/* --- 3. CONTROLS OVERLAY --- */}
            {/* Only show controls if not currently animating/loading */}
            {!isAnimating && imageFullyDecoded && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 20 }}>

                    {/* ANIMATE BUTTON (Hidden if video already exists) */}
                    {!isVideoReady && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAnimate(); }}
                            style={{
                                padding: '6px 12px', backgroundColor: '#FF0000', color: 'white', border: 'none',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}
                            title="Generate Video with Seedance"
                        >
                            <Film size={12} fill="white" /> ANIMATE
                        </button>
                    )}

                    <button onClick={onClickZoom} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}><Maximize2 size={14} /></button>
                    <button onClick={onDownload} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}><Download size={14} /></button>
                    <button onClick={() => onStartInpaint(src)} style={{ padding: '6px', backgroundColor: 'rgba(255,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}><Wand2 size={14} /></button>
                </div>
            )}

            <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
        </div>
    );
};

const SortableShotCard = ({ shot, index, styles, onDelete, children }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 101 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={{ ...styles.shotCard, ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Drag Handle using Vertical Grip */}
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#444' }}>
                        <GripVertical size={16} />
                    </div>
                    <span style={{ color: '#FF0000', fontWeight: 'bold', fontSize: '12px' }}>SHOT {index + 1}</span>
                </div>
                <button onClick={() => onDelete(shot.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                </button>
            </div>
            {/* The ShotImage and other controls go here via children */}
            {children}
        </div>
    );
};


export default function EpisodeBoard() {
    const params = useParams();
    const seriesId = params?.id as string;
    const episodeId = params?.episodeId as string;

    const { credits } = useCredits();

    const [scenes, setScenes] = useState<any[]>([]);
    const [episodeData, setEpisodeData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('scenes');

    // Assets
    const [uniqueChars, setUniqueChars] = useState<string[]>([]);
    const [uniqueLocs, setUniqueLocs] = useState<string[]>([]);
    const [characterImages, setCharacterImages] = useState<Record<string, string>>({});
    const [locationImages, setLocationImages] = useState<Record<string, string>>({});

    // Storyboard State
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [shots, setShots] = useState<any[]>([]);
    const [loadingShots, setLoadingShots] = useState<Set<string>>(new Set());

    // AI Director State
    const [isAutoDirecting, setIsAutoDirecting] = useState(false);
    const [terminalLog, setTerminalLog] = useState<string[]>([]);
    const [aspectRatio, setAspectRatio] = useState("9:16");

    // Zoom / Modal State
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
    const [assetType, setAssetType] = useState<'character' | 'location'>('character');
    const [modalMode, setModalMode] = useState<'upload' | 'generate'>('upload');
    const [genPrompt, setGenPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // const [inpaintImage, setInpaintImage] = useState<string | null>(null);
    // const [showInpaintEditor, setShowInpaintEditor] = useState(false);

    const [inpaintData, setInpaintData] = useState<{ src: string, shotId: string } | null>(null);

    const handleStartInpaint = (imageUrl: string, shotId: string) => {
        setInpaintData({ src: imageUrl, shotId: shotId });
    };

    useEffect(() => { if (seriesId && episodeId) fetchData(); }, [seriesId, episodeId]);

    const handleInpaintSave = async (prompt: string, maskBase64: string) => {
        if (!inpaintData) return null;

        const formData = new FormData();
        formData.append("series_id", seriesId);
        formData.append("shot_id", inpaintData.shotId);
        formData.append("prompt", prompt);
        formData.append("original_image_url", inpaintData.src);
        formData.append("mask_image_base64", maskBase64);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Failed to get ID token");

            const res = await fetch(`${API_BASE_URL}/api/v1/shot/inpaint_shot`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${idToken}`,
                },
                body: formData
            });
            const data = await res.json();
            if (data.status === "success") {
                return data.image_url; // Return the new URL to the editor
            }
        } catch (e) {
            alert("Inpainting failed");
        }
        return null;
    };



    useEffect(() => {
        if (!activeSceneId) return;
        const q = collection(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const shotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            shotData.sort((a, b) => a.id.localeCompare(b.id));
            setShots(shotData);
        });
        return () => unsubscribe();
    }, [activeSceneId]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDeleteShot = async (shotId: string) => {
        if (!window.confirm("Delete this shot?")) return;
        const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId!, "shots", shotId);
        await deleteDoc(ref); // Make sure to import deleteDoc from firebase/firestore
    };

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = shots.findIndex((s) => s.id === active.id);
            const newIndex = shots.findIndex((s) => s.id === over.id);

            const newOrder = arrayMove(shots, oldIndex, newIndex);
            setShots(newOrder);

            // PERSISTENCE: In a real app, you'd update a 'position' field in Firestore
            // For now, the visual order is updated.
        }
    };


    async function fetchData() {
        try {
            const epDoc = await getDoc(doc(db, "series", seriesId, "episodes", episodeId));
            if (epDoc.exists()) setEpisodeData(epDoc.data());

            const querySnapshot = await getDocs(collection(db, "series", seriesId, "episodes", episodeId, "scenes"));
            const scenesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            scenesData.sort((a: any, b: any) => a.scene_number - b.scene_number);
            setScenes(scenesData);

            const chars = new Set<string>();
            const locs = new Set<string>();
            scenesData.forEach((s: any) => {
                s.characters?.forEach((c: string) => chars.add(c));
                if (s.location) locs.add(s.location);
            });
            setUniqueChars(Array.from(chars));
            setUniqueLocs(Array.from(locs));
            console.log("Unique chars:", Array.from(chars));
            console.log("Unique locs:", Array.from(locs));

            const charSnapshot = await getDocs(collection(db, "series", seriesId, "characters"));
            const charMap: Record<string, string> = {};
            charSnapshot.forEach(doc => charMap[doc.id] = doc.data().image_url);
            setCharacterImages(charMap);

            const locSnapshot = await getDocs(collection(db, "series", seriesId, "locations"));
            const locMap: Record<string, string> = {};
            locSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.name) {
                    locMap[data.name] = data.image_url;
                }
            });
            setLocationImages(locMap);
            console.log("loca images:", locMap);
        } catch (e) { console.error(e); }
    }

    // --- HELPERS ---
    const addLoadingShot = (id: string) => setLoadingShots(prev => new Set(prev).add(id));
    const removeLoadingShot = (id: string) => setLoadingShots(prev => { const next = new Set(prev); next.delete(id); return next; });

    // --- AUTO DIRECTOR ---
    const handleAutoDirect = async () => {
        if (!activeSceneId) return;
        setIsAutoDirecting(true);
        setTerminalLog(["> INITIALIZING AI DIRECTOR..."]);

        const currentScene = scenes.find(s => s.id === activeSceneId);

        const formData = new FormData();
        formData.append("series_id", seriesId);
        formData.append("episode_id", episodeId);
        formData.append("scene_id", activeSceneId);
        formData.append("scene_action", currentScene.visual_action || "");

        // Use a fallback to a space or specific string if "" is causing 422
        const charString = Array.isArray(currentScene.characters) && currentScene.characters.length > 0
            ? currentScene.characters.join(", ")
            : "None";

        formData.append("characters", charString);
        formData.append("location", currentScene.location || "Unknown");

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/shot/suggest_shots`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });

            const data = await res.json();

            if (res.status === 422) {
                console.error("422 Error Detail:", data.detail);
                setIsAutoDirecting(false);
                return;
            }

            if (res.ok && data.shots) {
                setTerminalLog(prev => [...prev, "> GENERATING SHOT LIST..."]);
                const batch = writeBatch(db);
                const newShotsToRender: any[] = [];

                data.shots.forEach((shot: any, index: number) => {
                    const newShotId = `shot_${String(index + 1).padStart(2, '0')}`;
                    const docRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", newShotId);

                    const shotPayload = {
                        id: newShotId,
                        type: shot.type,
                        prompt: shot.description,
                        characters: shot.characters || [],
                        location: shot.location || currentScene.location || "",
                        status: "draft"
                    };

                    batch.set(docRef, shotPayload);
                    newShotsToRender.push(shotPayload);
                });

                await batch.commit();
                setIsAutoDirecting(false);

                // This triggers the actual image generation and GCS upload one-by-one
                generateAllShots(newShotsToRender);
            }
        } catch (e) {
            console.error(e);
            setIsAutoDirecting(false);
        }
    };

    // --- SEQUENTIAL GENERATION ---
    const generateAllShots = async (shotList: any[]) => {
        for (const shot of shotList) {
            handleRenderShot(shot);
            await new Promise(r => setTimeout(r, 1500)); // Staggered delay
        }
    };

    const handleApplyInpaint = async (newImageUrl: string) => {
        if (!inpaintData) return;

        try {
            const shotRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId!, "shots", inpaintData.shotId);

            // Update Firestore with the refined image
            await setDoc(shotRef, {
                image_url: newImageUrl,
                status: "rendered" // Ensure it stays in rendered state
            }, { merge: true });

            // Close the editor
            setInpaintData(null);
        } catch (e) {
            alert("Failed to apply fix to storyboard.");
        }
    };

    const handleRenderShot = async (shot: any) => {
        addLoadingShot(shot.id);
        const currentScene = scenes.find(s => s.id === activeSceneId);
        const formData = new FormData();
        formData.append("series_id", seriesId || "");
        formData.append("episode_id", episodeId || "");
        formData.append("scene_id", activeSceneId || "");
        formData.append("shot_id", shot.id || "");
        formData.append("shot_prompt", shot.prompt || "Cinematic shot");
        formData.append("shot_type", shot.type || "Wide Shot");
        formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : "");
        formData.append("location", shot.location || currentScene?.location || "");
        formData.append("aspect_ratio", aspectRatio || "16:9");

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Failed to get ID token");

            await fetch(`${API_BASE_URL}/api/v1/shot/generate_shot`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${idToken}`,
                },
                body: formData
            });
        } catch (e) { console.error(e); }
        finally {
            removeLoadingShot(shot.id);
        }
    };

    // --- OTHER HANDLERS ---
    const handleOpenStoryboard = (sceneId: string) => { setActiveSceneId(sceneId); setShots([]); };
    const handleDownload = async (url: string, filename: string) => {
        try { const response = await fetch(url); const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); } catch (e) { alert("Download failed"); }
    };
    const handleAddShot = async () => {
        if (!activeSceneId) return;
        const newShotId = `shot_${String(shots.length + 1).padStart(2, '0')}`;
        const currentScene = scenes.find(s => s.id === activeSceneId);
        await setDoc(doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", newShotId), { type: "Wide Shot", prompt: currentScene?.visual_action || "", characters: [], location: currentScene?.location || "", status: "draft" });
    };
    const updateShot = async (shotId: string, field: string, value: any) => { const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId!, "shots", shotId); await setDoc(ref, { [field]: value }, { merge: true }); };
    const openAssetModal = (name: string, type: 'character' | 'location') => { setSelectedAsset(name); setAssetType(type); setModalOpen(true); setGenPrompt(type === 'character' ? `Cinematic portrait of ${name}...` : `Wide shot of ${name}...`); };
    // 1. Handle Uploading a Reference Image (e.g., Real actor photo or location scout)
    // 1. Handle Uploading a Reference Image
    const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedAsset) return;

        setIsProcessing(true);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Not Authenticated");

            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("file", file);

            // DYNAMICALLY CHOOSE ENDPOINT & FIELD NAME
            // Your backend expects "character_name" or "location_name" specifically
            let endpoint = "";
            if (assetType === 'character') {
                formData.append("character_name", selectedAsset);
                endpoint = `${API_BASE_URL}/api/v1/assets/character/upload`;
            } else {
                formData.append("location_name", selectedAsset);
                endpoint = `${API_BASE_URL}/api/v1/assets/location/upload`;
            }

            console.log('Form data:', formData);

            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${idToken}` // Backend requires Depends(get_current_user)
                },
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.status === "success") {
                // Update the UI immediately without refreshing
                if (assetType === 'character') {
                    setCharacterImages(prev => ({ ...prev, [selectedAsset]: data.image_url }));
                } else {
                    setLocationImages(prev => ({ ...prev, [selectedAsset]: data.image_url }));
                }
                setModalOpen(false);
            } else {
                alert("Upload failed: " + (data.detail || "Unknown Error"));
            }
        } catch (e) {
            console.error(e);
            alert("Server connection failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAnimateShot = async (shot: any) => {
        if (!shot.image_url) return alert("Please generate an image first.");
        setIsProcessing(true);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Not Authenticated");

            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", activeSceneId!);
            formData.append("shot_id", shot.id);
            formData.append("image_url", shot.image_url);
            // Use the shot prompt for video guidance
            formData.append("prompt", shot.prompt || "Cinematic movement, slow motion");

            // Fire and forget (Backend updates Firestore => UI Updates)
            const res = await fetch(`${API_BASE_URL}/api/v1/shot/animate_shot`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                setIsProcessing(false);
                alert("Error: " + err.detail);
            }

        } catch (e) {
            console.error(e);
            setIsProcessing(false);
            alert("Failed to start animation.");
        }
    };
    // 2. Handle AI Generation
    const handleAssetGenerate = async () => {
        if (!genPrompt || !selectedAsset) return alert("Please describe the asset");

        setIsProcessing(true);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Not Authenticated");

            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("prompt", genPrompt);

            // DYNAMICALLY CHOOSE ENDPOINT & FIELD NAME
            let endpoint = "";
            if (assetType === 'character') {
                formData.append("character_name", selectedAsset);
                endpoint = `${API_BASE_URL}/api/v1/assets/character/generate`;
            } else {
                formData.append("location_name", selectedAsset);
                endpoint = `${API_BASE_URL}/api/v1/assets/location/generate`;
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${idToken}`
                },
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.status === "success") {
                if (assetType === 'character') {
                    setCharacterImages(prev => ({ ...prev, [selectedAsset]: data.image_url }));
                } else {
                    setLocationImages(prev => ({ ...prev, [selectedAsset]: data.image_url }));
                }
                setModalOpen(false);
            } else {
                alert("Generation error: " + (data.detail || "Unknown Error"));
            }
        } catch (e) {
            console.error(e);
            alert("Generation failed");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- STYLES ---
    const styles = {
        container: { minHeight: '100vh', backgroundColor: '#050505', color: '#EDEDED', fontFamily: 'Inter, sans-serif', padding: '40px' },
        topNav: { display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'center' },
        backLink: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '11px', fontWeight: 'bold' as const, letterSpacing: '2px', textDecoration: 'none' },
        header: { marginBottom: '40px', borderBottom: '1px solid #222', paddingBottom: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
        titleBlock: { paddingBottom: '30px' },
        title: { fontFamily: 'Anton, sans-serif', fontSize: '48px', textTransform: 'uppercase' as const, color: '#FFF' },
        subtitle: { fontSize: '12px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' as const, marginTop: '10px' },
        tabRow: { display: 'flex', gap: '40px' },
        tabBtn: (isActive: boolean) => ({ paddingBottom: '30px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', color: isActive ? '#FF0000' : '#666', borderBottom: isActive ? '3px solid #FF0000' : '3px solid transparent', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: '8px' }),
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '30px' },
        card: { backgroundColor: '#0A0A0A', border: '1px solid #1F1F1F', padding: '30px', position: 'relative' as const },

        // Asset Cards
        assetCard: { backgroundColor: '#0A0A0A', border: '1px solid #222', padding: '0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', overflow: 'hidden' },
        assetImage: { width: '100%', height: '300px', objectFit: 'cover' as const, backgroundColor: '#111' },
        assetPlaceholder: { width: '100%', height: '300px', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' },
        assetName: { padding: '20px', fontFamily: 'Anton, sans-serif', fontSize: '24px', color: '#FFF', textAlign: 'center' as const, width: '100%', textTransform: 'uppercase' as const },
        genBtn: { width: '100%', padding: '15px', backgroundColor: '#222', color: '#FFF', border: 'none', fontWeight: 'bold' as const, cursor: 'pointer', fontSize: '11px', letterSpacing: '2px', borderTop: '1px solid #333' },

        // Storyboard Layout
        sbOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#050505', zIndex: 100, padding: '40px', overflowY: 'auto' as const },
        sbHeader: { display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '40px' },
        sbGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
        shotCard: { backgroundColor: '#0E0E0E', border: '1px solid #222', padding: '20px' },

        // Image Container - MUST BE RELATIVE
        shotImageContainer: { position: 'relative' as const, width: '100%', height: '180px', marginBottom: '15px', border: '1px solid #222', backgroundColor: '#000', overflow: 'hidden' },

        // Placeholder for when no URL exists yet
        shotImagePlaceholder: { position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', zIndex: 2 },

        // Controls
        label: { fontSize: '10px', fontWeight: 'bold' as const, color: '#666', marginBottom: '5px', display: 'block', letterSpacing: '1px' },
        select: { width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '12px', marginBottom: '15px', outline: 'none' },
        textArea: { width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '12px', marginBottom: '15px', minHeight: '80px', resize: 'none' as const },
        renderBtn: { width: '100%', backgroundColor: '#FF0000', color: 'white', border: 'none', padding: '12px', fontSize: '11px', fontWeight: 'bold' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
        renderBtnLoading: { width: '100%', backgroundColor: '#FFF', color: 'black', border: 'none', padding: '12px', fontSize: '11px', fontWeight: 'bold' as const, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
        charToggle: (active: boolean) => ({ fontSize: '10px', padding: '6px 12px', border: '1px solid #333', backgroundColor: active ? '#FF0000' : 'transparent', color: active ? 'white' : '#666', cursor: 'pointer', marginRight: '5px', marginBottom: '5px' }),

        // Terminal Loader
        terminalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 5, 0.98)', zIndex: 999, display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', padding: '100px' },
        terminalBox: { borderLeft: '2px solid #FF0000', paddingLeft: '30px', color: '#FFF', fontFamily: 'monospace', fontSize: '16px' },
        terminalLine: { marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', letterSpacing: '2px' },

        // Zoom
        zoomOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
        zoomImg: { maxWidth: '90%', maxHeight: '90%', border: '1px solid #333', boxShadow: '0 0 50px rgba(0,0,0,0.8)' },

        // Helpers
        sceneHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '10px' },
        sceneTitle: { color: '#FF0000', fontWeight: 'bold' as const, fontSize: '14px', letterSpacing: '1px' },
        metaTag: { fontSize: '10px', backgroundColor: '#222', padding: '2px 6px', borderRadius: '4px', color: '#888' },
        locRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' as const, marginBottom: '15px', color: '#FFF' },
        actionText: { fontSize: '14px', lineHeight: '1.6', color: '#CCC', marginBottom: '20px', minHeight: '80px' },
        modal: { width: '600px', backgroundColor: '#0A0A0A', border: '1px solid #333', padding: '40px' },
        modalTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '10px', color: 'white' },
        modalSub: { fontSize: '12px', color: '#666', marginBottom: '30px' },
        toggleRow: { display: 'flex', marginBottom: '30px', borderBottom: '1px solid #222' },
        toggleBtn: (active: boolean) => ({ flex: 1, padding: '15px', textAlign: 'center' as const, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '1px', color: active ? 'white' : '#444', borderBottom: active ? '2px solid #FF0000' : 'none' }),
        uploadBox: { border: '1px dashed #333', padding: '50px', textAlign: 'center' as const, color: '#666', cursor: 'pointer', marginBottom: '20px' },
        textareaInput: { width: '100%', backgroundColor: '#111', border: '1px solid #333', padding: '15px', color: '#EEE', fontSize: '14px', marginBottom: '20px', resize: 'none' as const },
        primaryBtn: { width: '100%', padding: '20px', backgroundColor: '#FF0000', color: 'white', border: 'none', fontWeight: 'bold' as const, cursor: 'pointer', letterSpacing: '2px', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' },
        infoBox: { display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid #333', paddingRight: '20px', marginRight: '20px' },

    };

    return (
        <main style={styles.container}>
            <style>{` @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin-loader { animation: spin 1s linear infinite; } `}</style>

            {/* ... (Top Nav, Header, Scenes, Casting, Locations Tabs - KEEP SAME) ... */}
            <div style={styles.topNav}>
                <Link href={`/series/${seriesId}`} style={styles.backLink}><ArrowLeft size={14} /> BACK TO EPISODES</Link>
                <div style={{ fontSize: '12px', color: '#444' }}>MOTION X STUDIO</div>
            </div>
            <div style={styles.header}>
                <div style={styles.titleBlock}><h1 style={styles.title}>{episodeData?.title || 'UNTITLED'}</h1><p style={styles.subtitle}>PHASE 2: ASSET LAB</p></div>
                <div style={styles.tabRow}>
                    <div style={styles.tabBtn(activeTab === 'scenes')} onClick={() => setActiveTab('scenes')}><LayoutTemplate size={16} /> SCENES</div>
                    <div style={styles.tabBtn(activeTab === 'casting')} onClick={() => setActiveTab('casting')}><Users size={16} /> CASTING ({uniqueChars.length})</div>
                    <div style={styles.tabBtn(activeTab === 'locations')} onClick={() => setActiveTab('locations')}><MapPin size={16} /> LOCATIONS ({uniqueLocs.length})</div>
                </div>
            </div>

            {activeTab === 'scenes' && (
                <div style={styles.grid}>
                    {scenes.map(scene => (
                        <div key={scene.id} style={styles.card}>
                            <div style={styles.sceneHeader}><span style={styles.sceneTitle}>SCENE {scene.scene_number}</span><span style={styles.metaTag}>{scene.time_of_day}</span></div>
                            <div style={styles.locRow}><MapPin size={16} color="#666" /> {scene.location}</div>
                            <p style={styles.actionText}>{scene.visual_action}</p>
                            <button onClick={() => handleOpenStoryboard(scene.id)} style={{ width: '100%', padding: '15px', backgroundColor: '#222', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '12px', letterSpacing: '1px' }}>
                                <Film size={16} /> OPEN STORYBOARD
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {activeTab === 'casting' && (
                <div style={styles.grid}>
                    {uniqueChars.map((char, index) => {
                        const imageUrl = characterImages[char];
                        return (
                            <div key={index} style={styles.assetCard}>
                                {imageUrl ? <img src={imageUrl} alt={char} style={styles.assetImage} /> : <div style={styles.assetPlaceholder}><Camera size={40} /></div>}
                                <div style={styles.assetName}>{char}</div>
                                <button style={{ ...styles.genBtn, backgroundColor: imageUrl ? '#222' : '#FF0000' }} onClick={() => openAssetModal(char, 'character')}>{imageUrl ? "REGENERATE" : "GENERATE CHARACTER"}</button>
                            </div>
                        );
                    })}
                </div>
            )}
            {activeTab === 'locations' && (
                <div style={styles.grid}>
                    {uniqueLocs.map((loc, index) => {
                        const imageUrl = locationImages[loc];
                        console.log("Location images:", locationImages);
                        return (
                            <div key={index} style={styles.assetCard}>
                                {imageUrl ? <img src={imageUrl} alt={loc} style={styles.assetImage} /> : <div style={styles.assetPlaceholder}><ImageIcon size={40} /></div>}
                                <div style={styles.assetName}>{loc}</div>
                                <button style={{ ...styles.genBtn, backgroundColor: imageUrl ? '#222' : '#FF0000' }} onClick={() => openAssetModal(loc, 'location')}>{imageUrl ? "REGENERATE SET" : "BUILD SET"}</button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- STORYBOARD OVERLAY --- */}
            {activeSceneId && (
                <div style={styles.sbOverlay}>
                    <div style={styles.sbHeader}>
                        <button onClick={() => setActiveSceneId(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                            <ArrowLeft size={20} /> CLOSE BOARD
                        </button>
                        <div style={{ fontFamily: 'Anton, sans-serif', fontSize: '32px' }}>SCENE STORYBOARD</div>

                        <div style={styles.infoBox}>
                            <Zap size={14} color="#FF0000" />
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>CREDITS</p>
                                <p style={{ fontSize: '10px', color: credits && credits > 0 ? '#FFF' : '#FF0000', fontWeight: 'bold' }}>
                                    {credits !== null ? credits : '...'}
                                </p>
                            </div>
                        </div>

                        <div style={{ marginLeft: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>ASPECT:</span>
                            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} style={{ backgroundColor: '#111', color: 'white', border: '1px solid #333', padding: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                                <option value="16:9">16:9 (Cinema)</option>
                                <option value="21:9">21:9 (Wide)</option>
                                <option value="9:16">9:16 (Vertical)</option>
                            </select>
                        </div>

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                            <button onClick={handleAutoDirect} disabled={isAutoDirecting} style={{ padding: '12px 24px', backgroundColor: '#222', color: '#FFF', fontWeight: 'bold', border: '1px solid #333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px' }}>
                                <Wand2 size={16} /> AUTO-DIRECT
                            </button>
                            <button onClick={handleAddShot} style={{ padding: '12px 24px', backgroundColor: '#FFF', color: 'black', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px' }}>
                                <Plus size={16} /> ADD SHOT
                            </button>
                        </div>
                    </div>
                    {inpaintData && (
                        <InpaintEditor
                            src={inpaintData.src}
                            styles={styles}
                            onClose={() => setInpaintData(null)}
                            onSave={handleInpaintSave}
                            onApply={handleApplyInpaint}
                        />
                    )}

                    {/* --- EMPTY STATE OR GRID --- */}
                    {shots.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '60vh',
                            border: '1px dashed #222',
                            backgroundColor: 'rgba(10, 10, 10, 0.5)',
                            marginTop: '20px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Animated Background Scanline (Optional Cool Effect) */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                boxShadow: '0 0 20px rgba(255, 0, 0, 0.2)',
                                animation: 'scanline 3s linear infinite'
                            }} />
                            <style>{`@keyframes scanline { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }`}</style>

                            {/* Icon & Text */}
                            <Film size={80} style={{ opacity: 0.1, color: '#FFF', marginBottom: '20px' }} />

                            <h3 style={{
                                fontFamily: 'Anton, sans-serif',
                                fontSize: '32px',
                                color: '#333',
                                letterSpacing: '4px',
                                textTransform: 'uppercase'
                            }}>
                                SEQUENCE_BUFFER_EMPTY
                            </h3>

                            <p style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                color: '#555',
                                marginTop: '10px',
                                letterSpacing: '2px'
                            }}>
            // NO VISUAL DATA DETECTED IN THIS SECTOR
                            </p>

                            {/* Big Actions */}
                            <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
                                <button
                                    onClick={handleAutoDirect}
                                    disabled={isAutoDirecting}
                                    style={{
                                        padding: '15px 30px',
                                        backgroundColor: '#FF0000',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        letterSpacing: '2px',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        boxShadow: '0 0 30px rgba(255,0,0,0.2)'
                                    }}
                                >
                                    <Wand2 size={18} /> INITIALIZE AUTO-DIRECTOR
                                </button>

                                <button
                                    onClick={handleAddShot}
                                    style={{
                                        padding: '15px 30px',
                                        backgroundColor: 'transparent',
                                        color: '#666',
                                        border: '1px solid #333',
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        letterSpacing: '2px',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '10px'
                                    }}
                                >
                                    <Plus size={18} /> MANUAL ENTRY
                                </button>
                            </div>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={shots?.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                <div style={styles.sbGrid}>
                                    {shots?.map((shot, index) => {
                                        const isThisShotLoading = loadingShots.has(shot.id);

                                        return (
                                            <SortableShotCard
                                                key={shot.id}
                                                shot={shot}
                                                index={index}
                                                styles={styles}
                                                onDelete={handleDeleteShot}
                                            >
                                                {/* ... (Your existing Shot Card Content) ... */}
                                                <div style={styles.shotImageContainer}>
                                                    {shot?.image_url ? (
                                                        <ShotImage
                                                            src={shot.image_url}
                                                            videoUrl={shot.video_url}
                                                            videoStatus={shot.video_status}
                                                            shotId={shot.id}
                                                            isSystemLoading={loadingShots.has(shot.id)}
                                                            onClickZoom={() => setZoomImage(shot.video_url || shot.image_url)}
                                                            onDownload={() => handleDownload(shot.video_url || shot.image_url, `shot_${index}.mp4`)}
                                                            onStartInpaint={() => handleStartInpaint(shot.image_url, shot.id)}
                                                            onAnimate={() => handleAnimateShot(shot)}
                                                        />
                                                    ) : (
                                                        <div style={styles.shotImagePlaceholder}>
                                                            {isThisShotLoading ? (
                                                                <Loader2 className="spin-loader" size={32} color="#FF0000" />
                                                            ) : (
                                                                <Film size={32} strokeWidth={1} />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <label style={styles.label}>SHOT TYPE</label>
                                                <select style={styles.select} value={shot.type} onChange={(e) => updateShot(shot.id, "type", e.target.value)}>
                                                    <option>Wide Shot</option>
                                                    <option>Medium Shot</option>
                                                    <option>Close Up</option>
                                                    <option>Over the Shoulder</option>
                                                </select>

                                                <label style={styles.label}>CASTING</label>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '15px' }}>
                                                    {uniqueChars.map(char => {
                                                        const isSelected = shot.characters?.includes(char);
                                                        return (
                                                            <button key={char} onClick={() => {
                                                                const current = shot.characters || [];
                                                                const updated = isSelected ? current.filter((c: string) => c !== char) : [...current, char];
                                                                updateShot(shot.id, "characters", updated);
                                                            }} style={styles.charToggle(isSelected)}>{char}</button>
                                                        )
                                                    })}
                                                </div>

                                                <label style={styles.label}>VISUAL ACTION</label>
                                                <textarea style={styles.textArea} value={shot.prompt} onChange={(e) => updateShot(shot.id, "prompt", e.target.value)} />

                                                <button style={isThisShotLoading ? styles.renderBtnLoading : styles.renderBtn} onClick={() => handleRenderShot(shot)} disabled={isThisShotLoading}>
                                                    {isThisShotLoading ? <Loader2 className="spin-loader" size={14} /> : <Sparkles size={14} />}
                                                    {isThisShotLoading ? "GENERATING..." : (shot.image_url ? "REGENERATE SHOT" : "RENDER SHOT")}
                                                </button>
                                            </SortableShotCard>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            )}

            {/* --- TERMINAL LOADER & MODALS (Keep existing) --- */}
            {isAutoDirecting && (<div style={styles.terminalOverlay}><div style={styles.terminalBox}>{terminalLog.map((log, i) => (<div key={i} style={styles.terminalLine}>{log}</div>))}<div style={styles.terminalLine}>_ <span className="spin-loader">|</span></div></div></div>)}
            {zoomImage && (<div style={styles.zoomOverlay} onClick={() => setZoomImage(null)}><img src={zoomImage} style={styles.zoomImg} onClick={(e) => e.stopPropagation()} /><X size={30} style={{ position: 'absolute', top: 30, right: 30, color: 'white', cursor: 'pointer' }} onClick={() => setZoomImage(null)} /></div>)}
            {modalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={styles.modal}>
                        {/* ... (Keep existing asset modal content) ... */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><h2 style={styles.modalTitle}>{selectedAsset}</h2><X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={() => setModalOpen(false)} /></div><p style={styles.modalSub}>ASSET GENERATION</p><div style={styles.toggleRow}><div style={styles.toggleBtn(modalMode === 'upload')} onClick={() => setModalMode('upload')}>UPLOAD REF</div><div style={styles.toggleBtn(modalMode === 'generate')} onClick={() => setModalMode('generate')}>AI GENERATION</div></div>{modalMode === 'upload' && (<><div style={styles.uploadBox} onClick={() => fileInputRef.current?.click()}><Upload size={32} style={{ marginBottom: '15px' }} /><p>CLICK TO UPLOAD REF</p></div><input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAssetUpload} />{isProcessing && <div style={{ textAlign: 'center', color: '#FF0000' }}>UPLOADING...</div>}</>)}{modalMode === 'generate' && (<><textarea style={styles.textareaInput} value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} placeholder="Describe details..." /><button style={styles.primaryBtn} onClick={handleAssetGenerate} disabled={isProcessing}>{isProcessing ? <Loader2 className="spin-loader" /> : <Sparkles size={18} />} {isProcessing ? "DREAMING..." : "GENERATE"}</button></>)}
                    </div>
                </div>
            )}
        </main>
    );
}