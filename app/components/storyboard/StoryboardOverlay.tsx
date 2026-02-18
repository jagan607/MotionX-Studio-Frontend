"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Wand2, Plus, Film, Layers, Square, Loader2, FileText, Database } from 'lucide-react';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { toastSuccess, toastError } from "@/lib/toast";

// --- INTERNAL SIBLING IMPORTS ---
import { ShotImage } from "./ShotImage";
import { InpaintEditor } from "./InpaintEditor";
import { SortableShotCard } from "./SortableShotCard";
import { SceneContextStrip } from "./SceneContextStrip";
import { LipSyncModal } from "./LipSyncModal";
import { DownloadModal } from "./DownloadModal";
import { styles } from "./BoardStyles";

// --- GLOBAL UI IMPORTS ---
import { TourOverlay } from "@/components/tour/TourOverlay";
import { STORYBOARD_TOUR_STEPS } from "@/lib/tourConfigs";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import CreditModal from "@/app/components/modals/CreditModal";
import { AssetManagerModal } from "@/app/components/studio/AssetManagerModal";
import { ScriptIngestionModal } from "@/app/components/studio/ScriptIngestionModal";

// --- CONTEXT IMPORT ---
import { useMediaViewer } from "@/app/context/MediaViewerContext";

//db
import { doc, onSnapshot, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- HELPER: TERMINAL SPINNER ---
const TerminalSpinner = () => {
    const [frame, setFrame] = useState(0);
    const frames = ["/", "-", "\\", "|"];

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame(f => (f + 1) % frames.length);
        }, 100);
        return () => clearInterval(timer);
    }, []);

    return <span style={{ color: '#00ff41', fontWeight: 'bold', marginLeft: '8px' }}>{frames[frame]}</span>;
};

interface StoryboardOverlayProps {
    activeSceneId: string | null;
    currentScene: any;
    credits: number | null;

    // Data Props
    castMembers: any[];
    locations: any[];
    products: any[]; // [NEW] Added products prop
    initialScript?: string; // [NEW] Script content (fetched by parent)

    seriesName: string;
    episodeTitle: string;

    // Navigation IDs
    seriesId: string;
    episodeId: string;

    // Managers & Handlers
    shotMgr: any;
    inpaintData: any;
    setInpaintData: any;
    onSaveInpaint: any;
    onApplyInpaint: any;
    onClose: () => void;
    onZoom: any;
    onDownload: any;
    onDeleteShot: any;
    onSceneChange?: (scene: any) => void;

    // Tour Props
    tourStep: number;
    onTourNext: () => void;
    onTourComplete: () => void;

    styles?: any;
}

export const StoryboardOverlay: React.FC<StoryboardOverlayProps> = ({
    activeSceneId, currentScene, onClose, credits, castMembers, locations, products,
    seriesName, episodeTitle, initialScript,
    seriesId, episodeId,
    shotMgr, inpaintData, setInpaintData, onSaveInpaint, onApplyInpaint,
    onZoom, onDownload, onDeleteShot, onSceneChange,
    tourStep, onTourNext, onTourComplete
}) => {

    const router = useRouter();
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const { openViewer } = useMediaViewer();

    // --- STATE ---
    const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
    const [showGenerateWarning, setShowGenerateWarning] = useState(false);
    const [pendingSummary, setPendingSummary] = useState<string | undefined>(undefined);
    const [isWiping, setIsWiping] = useState(false);
    const [lipSyncShot, setLipSyncShot] = useState<{ id: string, videoUrl: string } | null>(null);
    const [shotToDelete, setShotToDelete] = useState<string | null>(null);
    const [isDeletingShot, setIsDeletingShot] = useState(false);
    const [shotToDownload, setShotToDownload] = useState<any>(null);
    const [sceneList, setSceneList] = useState<any[]>([]);

    // UI State
    const [showTopUp, setShowTopUp] = useState(false);
    const [showAssets, setShowAssets] = useState(false);
    const [showScript, setShowScript] = useState(false);

    // Data State (Episode Title Correction)
    const [realEpisodeTitle, setRealEpisodeTitle] = useState(episodeTitle);

    // --- 1. FETCH SCENE LIST ---
    useEffect(() => {
        const fetchScenes = async () => {
            if (!seriesId || !episodeId) return;
            try {
                const scenesRef = collection(db, "projects", seriesId, "episodes", episodeId, "scenes");
                const q = query(scenesRef, orderBy("scene_number", "asc"));
                const snapshot = await getDocs(q);

                const scenes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setSceneList(scenes);
            } catch (error) {
                console.error("Error fetching scene list:", error);
            }
        };

        fetchScenes();
    }, [seriesId, episodeId]);

    // --- 2. FETCH REAL EPISODE TITLE ---
    useEffect(() => {
        const fetchEpisodeData = async () => {
            if (!seriesId || !episodeId || episodeId === 'main') return;

            if (episodeTitle === episodeId || !episodeTitle || episodeTitle.startsWith("EPISODE")) {
                try {
                    const epRef = doc(db, "projects", seriesId, "episodes", episodeId);
                    const epSnap = await getDoc(epRef);
                    if (epSnap.exists()) {
                        const data = epSnap.data();
                        if (data.title) {
                            setRealEpisodeTitle(data.title.toUpperCase());
                        }
                    }
                } catch (error) {
                    console.error("Error fetching episode title:", error);
                }
            } else {
                setRealEpisodeTitle(episodeTitle);
            }
        };
        fetchEpisodeData();
    }, [seriesId, episodeId, episodeTitle]);

    // --- 3. FETCH ASPECT RATIO ---
    useEffect(() => {
        const fetchProjectSettings = async () => {
            if (!seriesId) return;
            try {
                const projectRef = doc(db, "projects", seriesId);
                const projectSnap = await getDoc(projectRef);

                if (projectSnap.exists()) {
                    const data = projectSnap.data();
                    if (data && data.aspect_ratio) {
                        shotMgr.setAspectRatio(data.aspect_ratio);
                    }
                }
            } catch (error) {
                console.error("Error fetching project aspect ratio:", error);
            }
        };
        fetchProjectSettings();
    }, [seriesId]);

    // --- 4. REAL-TIME TERMINAL LOG LISTENER ---
    useEffect(() => {
        if (!shotMgr.isAutoDirecting || !seriesId || !episodeId || !activeSceneId) return;

        const sceneRef = doc(db, "projects", seriesId, "episodes", episodeId, "scenes", activeSceneId);

        const unsubscribe = onSnapshot(sceneRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data?.ai_logs && Array.isArray(data.ai_logs)) {
                    shotMgr.setTerminalLog(data.ai_logs);
                }
            }
        });

        return () => unsubscribe();
    }, [shotMgr.isAutoDirecting, seriesId, episodeId, activeSceneId]);


    if (!activeSceneId) return null;

    // --- DOWNLOAD HELPER ---
    const forceDownload = async (url: string, filename: string) => {
        const toastId = toast.loading("Downloading...");
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

            window.URL.revokeObjectURL(blobUrl);
            toast.dismiss(toastId);
            toastSuccess("Download started");
        } catch (e) {
            console.error("Download failed", e);
            toast.dismiss(toastId);
            window.open(url, '_blank');
        }
    };

    // --- HANDLERS ---
    const handleDownloadSelection = (type: 'image' | 'video' | 'both') => {
        if (!shotToDownload) return;
        const prefix = `shot_${String(shotToDownload.id).slice(-4)}`;

        if (type === 'image' || type === 'both') {
            if (shotToDownload.image_url) {
                forceDownload(shotToDownload.image_url, `${prefix}_frame.jpg`);
            } else {
                toastError("No image found for this shot.");
            }
        }

        if (type === 'video' || type === 'both') {
            if (shotToDownload.video_url) {
                setTimeout(() => {
                    forceDownload(shotToDownload.video_url, `${prefix}_motion.mp4`);
                }, type === 'both' ? 800 : 0);
            } else if (type === 'video') {
                toastError("No video found for this shot.");
            }
        }
        setShotToDownload(null);
        if (onDownload) onDownload(shotToDownload, type);
    };

    const handleSafeAutoDirect = (overrideSummary?: string) => {
        if (shotMgr.shots.length > 0) {
            setPendingSummary(overrideSummary);
            setShowOverwriteWarning(true);
        } else {
            shotMgr.handleAutoDirect(currentScene, overrideSummary);
        }
    };

    const confirmOverwrite = async () => {
        setIsWiping(true);
        try {
            await shotMgr.wipeSceneData();
            await shotMgr.handleAutoDirect(currentScene, pendingSummary);
        } catch (error) {
            console.error("Overwrite failed", error);
        } finally {
            setIsWiping(false);
            setShowOverwriteWarning(false);
            setPendingSummary(undefined);
        }
    };

    const handleSafeGenerateAll = () => {
        if (shotMgr.isStopping) return;
        if (shotMgr.isGeneratingAll) {
            shotMgr.stopGeneration();
            return;
        }
        if (shotMgr.shots.some((s: any) => s.image_url || s.video_url)) {
            setShowGenerateWarning(true);
        } else {
            shotMgr.handleGenerateAll(currentScene);
        }
    };

    const confirmGenerateAll = async () => {
        setIsWiping(true);
        try {
            await shotMgr.wipeShotImagesOnly();
            shotMgr.handleGenerateAll(currentScene);
        } catch (error) {
            console.error("Generate all failed", error);
        } finally {
            setIsWiping(false);
            setShowGenerateWarning(false);
        }
    };

    const confirmDeleteShot = async () => {
        if (!shotToDelete) return;
        setIsDeletingShot(true);
        try {
            await onDeleteShot(shotToDelete);
        } catch (error) {
            console.error("Delete shot failed", error);
        } finally {
            setIsDeletingShot(false);
            setShotToDelete(null);
        }
    };

    const handleOpenViewer = (initialIndex: number) => {
        const mediaItems = shotMgr.shots.map((s: any, i: number) => ({
            id: s.id,
            type: ((s.image_url && s.video_url) ? 'mixed' : (s.video_url ? 'video' : 'image')) as 'image' | 'video' | 'mixed',
            imageUrl: s.image_url,
            videoUrl: s.video_url,
            lipsyncUrl: s.lipsync_url,
            title: `SHOT ${String(i + 1).padStart(2, '0')}`,
            description: s.video_prompt || s.visual_action
        }));
        openViewer(mediaItems, initialIndex);
    };

    // --- DATA MAPPING ---
    const rawLoc = currentScene?.location || currentScene?.location_name || currentScene?.location_id;
    const foundLoc = locations.find(l => l.id === rawLoc || l.name === rawLoc);
    const sceneLoc = foundLoc ? foundLoc.name : (rawLoc || "UNKNOWN");

    let charDisplay = "NO CAST";
    if (Array.isArray(currentScene?.characters) && currentScene.characters.length > 0) {
        charDisplay = currentScene.characters.map((charKey: string) => {
            const member = castMembers.find(c => c.id === charKey || c.name === charKey);
            return member ? member.name : charKey;
        }).join(", ");
    } else if (typeof currentScene?.characters === 'string') {
        charDisplay = currentScene.characters;
    }

    return (
        <div style={styles.sbOverlay}>


            {/* MODALS */}
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

            <AssetManagerModal
                isOpen={showAssets}
                onClose={() => setShowAssets(false)}
                projectId={seriesId}
                project={null}
            />

            <ScriptIngestionModal
                isOpen={showScript}
                onClose={() => setShowScript(false)}
                projectId={seriesId}
                projectTitle={seriesName}
                projectType="micro_drama"
                mode="edit"
                episodeId={episodeId}
                initialScript={initialScript}
                onSuccess={() => setShowScript(false)}
            />

            {/* --- HEADER --- */}
            <div style={styles.sbHeader}>
                {/* LEFT */}
                <div style={styles.headerLeft}>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600 }}
                    >
                        <ArrowLeft size={16} /> CLOSE BOARD
                    </button>
                    <h1 style={styles.headerTitle}>SCENE STORYBOARD</h1>
                </div>

                {/* RIGHT */}
                <div style={styles.headerActions}>

                    {/* SCENE SELECTOR */}
                    <div id="tour-sb-scene-selector" style={{ position: 'relative' }}>
                        <select
                            value={activeSceneId || ""}
                            onChange={(e) => {
                                const selectedScene = sceneList.find(s => s.id === e.target.value);
                                if (selectedScene && onSceneChange) {
                                    onSceneChange(selectedScene);
                                }
                            }}
                            style={{
                                height: '40px', padding: '0 32px 0 16px', backgroundColor: '#1A1A1A', color: '#EEE',
                                border: '1px solid #333', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                minWidth: '240px', maxWidth: '300px', cursor: 'pointer', outline: 'none',
                                textTransform: 'uppercase', appearance: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}
                        >
                            {sceneList.map((scene) => (
                                <option key={scene.id} value={scene.id}>
                                    SCENE {scene.scene_number}: {scene.slugline || "UNTITLED SCENE"}
                                </option>
                            ))}
                        </select>
                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#666' }}>
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>

                    {/* GENERATE ALL */}
                    {shotMgr.shots.length > 0 && (
                        <button
                            id="tour-sb-generate-all"
                            onClick={handleSafeGenerateAll}
                            disabled={(shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting || shotMgr.isStopping}
                            style={{
                                height: '40px', padding: '0 20px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease',
                                opacity: ((shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting || shotMgr.isStopping) ? 0.5 : 1,
                                backgroundColor: shotMgr.isGeneratingAll ? '#2a0a0a' : '#1A1A1A',
                                border: shotMgr.isGeneratingAll ? '1px solid #7f1d1d' : '1px solid #333',
                                color: shotMgr.isGeneratingAll ? '#f87171' : '#EEE',
                            }}
                        >
                            {shotMgr.isStopping ? <Loader2 size={14} className="animate-spin" /> :
                                shotMgr.isGeneratingAll ? <Square size={14} fill="currentColor" /> :
                                    <Layers size={14} />}
                            {shotMgr.isStopping ? 'STOPPING...' : shotMgr.isGeneratingAll ? 'STOP' : 'GENERATE ALL'}
                        </button>
                    )}

                    {/* AUTO DIRECT */}
                    <button
                        id="tour-sb-autodirect"
                        onClick={() => handleSafeAutoDirect()}
                        disabled={shotMgr.isAutoDirecting || shotMgr.isGeneratingAll || shotMgr.isStopping}
                        style={{
                            height: '40px', padding: '0 20px', backgroundColor: '#1A1A1A', color: '#EEE',
                            border: '1px solid #333', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease',
                            opacity: shotMgr.isAutoDirecting ? 0.5 : 1
                        }}
                    >
                        <Wand2 size={14} />
                        {shotMgr.isAutoDirecting ? 'DIRECTING...' : 'AUTO-DIRECT'}
                    </button>

                    {/* ADD SHOT */}
                    <button
                        id="tour-sb-add-shot"
                        onClick={() => { shotMgr.handleAddShot(currentScene); toastSuccess("Shot added"); }}
                        style={{
                            height: '40px', padding: '0 24px', backgroundColor: '#FFF', color: '#000',
                            border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        <Plus size={16} strokeWidth={3} /> ADD SHOT
                    </button>

                    {/* SCRIPT */}
                    <button
                        onClick={() => setShowScript(true)}
                        style={{
                            height: '40px', padding: '0 20px', backgroundColor: '#1A1A1A', color: '#EEE',
                            border: '1px solid #333', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'border-color 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#555'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#333'; }}
                    >
                        <FileText size={14} /> SCRIPT
                    </button>

                    {/* ASSETS */}
                    <button
                        onClick={() => setShowAssets(true)}
                        style={{
                            height: '40px', padding: '0 20px', backgroundColor: '#1A1A1A', color: '#EEE',
                            border: '1px solid #333', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'border-color 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#555'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#333'; }}
                    >
                        <Database size={14} /> ASSETS
                    </button>

                    {/* DIVIDER */}
                    <div style={{ width: '1px', height: '32px', backgroundColor: '#222', margin: '0 16px' }} />

                    {/* CREDITS */}
                    <div id="tour-sb-credits" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginBottom: '2px' }}>
                                <span style={{ display: 'block', fontSize: '8px', color: '#888', fontFamily: 'monospace', textTransform: 'uppercase', lineHeight: 1 }}>CREDITS</span>
                                {credits !== null && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#22c55e' }} className="animate-pulse" />}
                            </div>
                            <div style={{ fontSize: '13px', color: 'white', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em', lineHeight: 1 }}>
                                {credits !== null ? credits.toLocaleString() : <span style={{ color: '#333' }}>---</span>}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowTopUp(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(127, 29, 29, 0.1)',
                                border: '1px solid rgba(220, 38, 38, 0.3)', color: 'white', padding: '8px 16px', fontSize: '9px', fontWeight: 700,
                                textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '2px'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.1)'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)'; }}
                        >
                            <Plus size={10} strokeWidth={4} /> TOP UP
                        </button>
                    </div>

                </div>
            </div>

            {/* --- CONTENT --- */}
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#050505', display: 'flex', flexDirection: 'column' }}>

                <div id="tour-sb-context-strip" style={{ margin: '40px 40px 0 40px' }}>
                    <SceneContextStrip
                        seriesName={seriesName}
                        episodeTitle={realEpisodeTitle}
                        sceneNumber={currentScene.scene_number}
                        summary={currentScene.summary || currentScene.description || currentScene.synopsis}
                        locationName={sceneLoc}
                        timeOfDay={currentScene.time_of_day || "DAY"}
                        castList={charDisplay}
                        aspectRatio={shotMgr.aspectRatio || "16:9"}
                        onAutoDirect={(newSummary) => handleSafeAutoDirect(newSummary)}
                        isAutoDirecting={shotMgr.isAutoDirecting}
                    />
                </div>

                <div style={{ padding: '20px', flex: 1 }}>
                    {shotMgr.shots.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px dashed #222', borderRadius: '8px', minHeight: '400px' }}>
                            <Film size={48} style={{ opacity: 0.2, color: '#FFF', marginBottom: '20px' }} />
                            <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '24px', color: '#333' }}>EMPTY SEQUENCE</h3>
                            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                                <button onClick={() => handleSafeAutoDirect()} disabled={shotMgr.isAutoDirecting} style={{ padding: '12px 24px', backgroundColor: '#111', color: 'white', border: '1px solid #333', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Wand2 size={16} /> AUTO-DIRECT SCENE
                                </button>
                            </div>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={shotMgr.handleDragEnd}>
                            <SortableContext items={shotMgr.shots.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
                                <div style={styles.sbGrid}>
                                    {shotMgr.shots.map((shot: any, index: number) => {
                                        const nextShot = shotMgr.shots[index + 1];
                                        const nextShotImage = nextShot?.image_url;
                                        const prevShot = shotMgr.shots[index - 1];
                                        const isMorphedByPrev = prevShot?.morph_to_next === true;

                                        return (
                                            <SortableShotCard
                                                key={shot.id}
                                                shot={shot}
                                                index={index}
                                                styles={styles}
                                                onDelete={() => setShotToDelete(shot.id)}
                                                castMembers={castMembers}
                                                locations={locations}
                                                // [NEW] Pass products list
                                                products={products}

                                                onUpdateShot={shotMgr.updateShot}
                                                onLipSync={() => setLipSyncShot({ id: shot.id, videoUrl: shot.video_url })}
                                                onRender={(referenceFile, provider) =>
                                                    shotMgr.handleRenderShot(shot, currentScene, referenceFile, provider)
                                                }
                                                onAnimate={(provider, endFrameUrl) =>
                                                    shotMgr.handleAnimateShot(shot, provider, endFrameUrl)
                                                }
                                                isRendering={shotMgr.loadingShots.has(shot.id)}
                                                onFinalize={() => shotMgr.handleFinalizeShot(shot)}
                                                onExpand={() => handleOpenViewer(index)}
                                                nextShotImage={nextShotImage}
                                                isMorphedByPrev={isMorphedByPrev}
                                                onUploadImage={(file) => shotMgr.handleShotImageUpload(shot, file)}
                                                tourId={index === 0 ? "tour-sb-shot-card" : undefined}
                                            >
                                                <div style={styles.shotImageContainer}>
                                                    <ShotImage
                                                        src={shot.image_url}
                                                        videoUrl={shot.video_url}
                                                        lipsyncUrl={shot.lipsync_url}
                                                        videoStatus={shot.video_status}
                                                        shotId={shot.id}
                                                        isSystemLoading={shotMgr.loadingShots.has(shot.id)}
                                                        onClickZoom={() => handleOpenViewer(index)}
                                                        onDownload={() => setShotToDownload(shot)}
                                                        onStartInpaint={() => setInpaintData({ src: shot.image_url, shotId: shot.id })}
                                                        onAnimate={() => shotMgr.handleAnimateShot(shot, 'kling')}
                                                    />
                                                </div>
                                            </SortableShotCard>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* MODALS */}
            {inpaintData && (
                <InpaintEditor
                    src={inpaintData.src}
                    styles={styles}
                    onClose={() => setInpaintData(null)}
                    onSave={onSaveInpaint}
                    onApply={onApplyInpaint}
                />
            )}

            {lipSyncShot && (
                <LipSyncModal
                    videoUrl={lipSyncShot.videoUrl}
                    credits={credits || 0}
                    onClose={() => setLipSyncShot(null)}
                    onGenerateVoice={(text, voiceId, emotion) => {
                        const originalShot = shotMgr.shots.find((s: any) => s.id === lipSyncShot.id);
                        if (!originalShot) return Promise.reject("Shot not found");
                        const shotPayload = { ...originalShot, voiceover_text: text, voice_id: voiceId };
                        return shotMgr.handleGenerateVoiceover(shotPayload);
                    }}
                    onStartSync={(audioUrl, audioFile) => {
                        const shot = shotMgr.shots.find((s: any) => s.id === lipSyncShot.id);
                        if (shot) return shotMgr.handleLipSyncShot(shot, audioUrl, audioFile);
                        return Promise.resolve();
                    }}
                />
            )}

            {shotToDownload && (
                <DownloadModal
                    shot={shotToDownload}
                    onClose={() => setShotToDownload(null)}
                    onDownload={handleDownloadSelection}
                />
            )}

            {/* TERMINAL OVERLAY */}
            {shotMgr.isAutoDirecting && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 9999,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace'
                }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.3, pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', width: '600px', maxWidth: '90%' }}>
                        <div style={{ marginBottom: '40px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                            <h2 style={{ color: '#FFF', fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px', margin: 0 }}>AI DIRECTOR ACTIVE</h2>
                            <p style={{ color: '#666', fontSize: '12px', margin: '5px 0 0 0', letterSpacing: '1px' }}>ANALYZING SCENE CONTEXT & GENERATING SHOT LIST</p>
                        </div>
                        <div style={{ backgroundColor: '#050505', border: '1px solid #222', borderRadius: '4px', padding: '20px', height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 0 50px rgba(0,0,0,0.5)', fontFamily: 'monospace' }}>
                            {shotMgr.terminalLog.map((log: string, i: number) => (
                                <div key={i} style={{ color: log.includes('ERROR') ? '#ff4444' : '#00ff41', fontSize: '12px', display: 'flex', gap: '12px', opacity: 0.8 }}>
                                    <span style={{ color: '#444', minWidth: '80px' }}>[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                    <span>{`> ${log}`}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: 'auto' }}>
                                <span style={{ color: '#444', minWidth: '80px' }}>[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                <span style={{ color: '#00ff41', display: 'flex', alignItems: 'center' }}>{`> PROCESSING`} <TerminalSpinner /></span>
                            </div>
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', color: '#333', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            <span>System: ONLINE</span><span>Model: GEMINI-1.5-PRO</span><span>Queue: PROCESSING</span>
                        </div>
                    </div>
                </div>
            )}

            {/* WARNINGS & DELETE MODALS */}
            {showOverwriteWarning && (
                <DeleteConfirmModal
                    title="OVERWRITE SCENE?"
                    message="Running Auto-Director will PERMANENTLY DELETE all existing shots."
                    isDeleting={isWiping}
                    onConfirm={confirmOverwrite}
                    onCancel={() => { setShowOverwriteWarning(false); setPendingSummary(undefined); }}
                />
            )}

            {showGenerateWarning && (
                <DeleteConfirmModal
                    title="RE-GENERATE FRAMES?"
                    message="Generating all frames will PERMANENTLY DELETE any existing images or videos."
                    isDeleting={isWiping}
                    onConfirm={confirmGenerateAll}
                    onCancel={() => setShowGenerateWarning(false)}
                />
            )}

            {shotToDelete && (
                <DeleteConfirmModal
                    title="DELETE SHOT?"
                    message="This action will permanently delete this shot and any associated images/videos."
                    isDeleting={isDeletingShot}
                    onConfirm={confirmDeleteShot}
                    onCancel={() => setShotToDelete(null)}
                />
            )}

            <TourOverlay step={tourStep} steps={STORYBOARD_TOUR_STEPS} onNext={onTourNext} onComplete={onTourComplete} />
        </div>
    );
};