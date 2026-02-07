"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Zap, Wand2, Plus, Film, Layers, Square, Loader2 } from 'lucide-react';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";

// --- INTERNAL SIBLING IMPORTS ---
import { ShotImage } from "./ShotImage";
import { InpaintEditor } from "./InpaintEditor";
import { SortableShotCard } from "./SortableShotCard";
import { SceneContextStrip } from "./SceneContextStrip";
import { LipSyncModal } from "./LipSyncModal";
import { DownloadModal } from "./DownloadModal";
import { styles } from "./BoardStyles";

// --- GLOBAL UI IMPORTS ---
import { StoryboardTour } from "@/components/StoryboardTour";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

// --- CONTEXT IMPORT ---
import { useMediaViewer } from "@/app/context/MediaViewerContext";

//db
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface StoryboardOverlayProps {
    activeSceneId: string | null;
    currentScene: any;
    credits: number | null;

    // Data Props
    castMembers: any[];
    locations: any[];
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
    onDownload: any; // Kept for logging/analytics if needed
    onDeleteShot: any;

    // Tour Props
    tourStep: number;
    onTourNext: () => void;
    onTourComplete: () => void;

    styles?: any;
}

export const StoryboardOverlay: React.FC<StoryboardOverlayProps> = ({
    activeSceneId, currentScene, onClose, credits, castMembers, locations,
    seriesName, episodeTitle,
    seriesId, episodeId,
    shotMgr, inpaintData, setInpaintData, onSaveInpaint, onApplyInpaint,
    onZoom, onDownload, onDeleteShot,
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

    // --- FETCH ASPECT RATIO ---
    useEffect(() => {
        const fetchProjectSettings = async () => {
            if (!seriesId) return;

            try {
                // Assuming seriesId corresponds to the Project ID in the 'projects' collection
                const projectRef = doc(db, "projects", seriesId);
                const projectSnap = await getDoc(projectRef);

                if (projectSnap.exists()) {
                    const data = projectSnap.data();
                    if (data && data.aspect_ratio) {
                        console.log("Setting dynamic aspect ratio:", data.aspect_ratio);
                        // Update the shot manager with the DB value
                        shotMgr.setAspectRatio(data.aspect_ratio);
                    }
                }
            } catch (error) {
                console.error("Error fetching project aspect ratio:", error);
            }
        };

        fetchProjectSettings();
    }, [seriesId]);

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

            // Cleanup
            window.URL.revokeObjectURL(blobUrl);
            toast.dismiss(toastId);
            toast.success("Download started");
        } catch (e) {
            console.error("Download failed", e);
            toast.dismiss(toastId);
            // Fallback: Open in new tab
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
                toast.error("No image found for this shot.");
            }
        }

        if (type === 'video' || type === 'both') {
            if (shotToDownload.video_url) {
                // Add slight delay if downloading both to prevent browser blocking
                setTimeout(() => {
                    forceDownload(shotToDownload.video_url, `${prefix}_motion.mp4`);
                }, type === 'both' ? 800 : 0);
            } else if (type === 'video') {
                toast.error("No video found for this shot.");
            }
        }

        setShotToDownload(null);
        // Optional: Call parent onDownload for analytics logging
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
            <Toaster position="bottom-right" reverseOrder={false} />

            {/* --- HEADER (Fixed) --- */}
            <div style={styles.sbHeader}>
                {/* LEFT: Navigation & Title */}
                <div style={styles.headerLeft}>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600 }}
                    >
                        <ArrowLeft size={16} /> CLOSE BOARD
                    </button>
                    <h1 style={styles.headerTitle}>SCENE STORYBOARD</h1>
                </div>

                {/* CENTER: Data Cockpit */}
                <div style={styles.headerStats}>
                    <div style={styles.statItem}>
                        <Zap size={16} color="#FF3B30" fill="#FF3B30" />
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                            <span style={{ fontSize: '9px', color: '#555', fontWeight: 700 }}>CREDITS</span>
                            <span style={{ fontSize: '14px', color: '#FFF', fontWeight: 700 }}>{credits ?? '--'}</span>
                        </div>
                    </div>
                    <div style={styles.verticalDivider} />
                    <div style={styles.statItem} id="tour-sb-aspect">
                        <span style={styles.statLabel}>ASPECT:</span>
                        <div style={styles.statValueBox}>
                            {shotMgr.aspectRatio || "16:9"}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Actions */}
                <div style={styles.headerActions}>
                    {shotMgr.shots.length > 0 && (
                        <button
                            onClick={handleSafeGenerateAll}
                            disabled={(shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting || shotMgr.isStopping}
                            style={{
                                ...styles.btnSecondary,
                                opacity: ((shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting || shotMgr.isStopping) ? 0.5 : 1,
                                backgroundColor: shotMgr.isGeneratingAll ? '#2a0a0a' : '#1A1A1A',
                                borderColor: shotMgr.isGeneratingAll ? '#7f1d1d' : '#333',
                                color: shotMgr.isGeneratingAll ? '#f87171' : '#EEE',
                            }}
                        >
                            {shotMgr.isStopping ? <Loader2 size={14} className="animate-spin" /> :
                                shotMgr.isGeneratingAll ? <Square size={14} fill="currentColor" /> :
                                    <Layers size={14} />}
                            {shotMgr.isStopping ? 'STOPPING...' : shotMgr.isGeneratingAll ? 'STOP' : 'GENERATE ALL'}
                        </button>
                    )}

                    <button
                        onClick={() => handleSafeAutoDirect()}
                        disabled={shotMgr.isAutoDirecting || shotMgr.isGeneratingAll || shotMgr.isStopping}
                        style={{ ...styles.btnSecondary, opacity: shotMgr.isAutoDirecting ? 0.5 : 1 }}
                    >
                        <Wand2 size={14} />
                        {shotMgr.isAutoDirecting ? 'DIRECTING...' : 'AUTO-DIRECT'}
                    </button>

                    <button
                        onClick={() => shotMgr.handleAddShot(currentScene)}
                        style={styles.btnPrimary}
                    >
                        <Plus size={16} strokeWidth={3} /> ADD SHOT
                    </button>
                </div>
            </div>

            {/* --- SCROLLABLE CONTENT AREA --- */}
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#050505', display: 'flex', flexDirection: 'column' }}>

                {/* 1. SCENE CONTEXT STRIP (Wrapped with 20px Margin) */}
                <div style={{ margin: '40px 40px 0 40px' }}>
                    <SceneContextStrip
                        seriesName={seriesName}
                        episodeTitle={episodeTitle}
                        sceneNumber={currentScene.scene_number}
                        summary={currentScene.summary || currentScene.description}
                        locationName={sceneLoc}
                        timeOfDay={currentScene.time_of_day || "DAY"}
                        castList={charDisplay}
                        onAutoDirect={(newSummary) => handleSafeAutoDirect(newSummary)}
                        isAutoDirecting={shotMgr.isAutoDirecting}
                    />
                </div>

                {/* 2. MAIN GRID (Padding creates the gap below the strip) */}
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
                <div style={styles.terminalOverlay}>
                    <div style={styles.terminalBox}>
                        {shotMgr.terminalLog.map((log: string, i: number) => (<div key={i} style={styles.terminalLine}>{log}</div>))}
                        <div style={styles.terminalLine}>_ <span className="animate-pulse">|</span></div>
                    </div>
                </div>
            )}

            {/* WARNINGS */}
            {showOverwriteWarning && (
                <DeleteConfirmModal
                    title="OVERWRITE SCENE?"
                    message="Running Auto-Director will PERMANENTLY DELETE all existing shots. This action cannot be undone."
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

            <StoryboardTour step={tourStep} onNext={onTourNext} onComplete={onTourComplete} />
        </div>
    );
};