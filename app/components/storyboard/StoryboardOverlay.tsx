"use client";

import React, { useState } from 'react';
import { ArrowLeft, Zap, Wand2, Plus, Film, Layers, Square, Loader2 } from 'lucide-react';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";

// --- INTERNAL SIBLING IMPORTS (From app/components/storyboard) ---
import { ShotImage } from "./ShotImage";
import { InpaintEditor } from "./InpaintEditor";
import { SortableShotCard } from "./SortableShotCard";
import { SceneContextStrip } from "./SceneContextStrip";
import { LipSyncModal } from "./LipSyncModal";
import { styles } from "./BoardStyles"; // <--- Styles imported from sibling file

// --- GLOBAL UI IMPORTS (From app/components/ui) ---
import { StoryboardTour } from "@/components/StoryboardTour";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

// --- CONTEXT IMPORT ---
// Adjust this path if your context alias is different (e.g. "@/context/...")
import { useMediaViewer } from "@/app/context/MediaViewerContext";

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
    onDownload: any;
    onDeleteShot: any;

    // Tour Props
    tourStep: number;
    onTourNext: () => void;
    onTourComplete: () => void;

    // Optional styles prop override
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

    // Media Viewer Context
    const { openViewer } = useMediaViewer();

    // --- STATE ---
    const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
    const [showGenerateWarning, setShowGenerateWarning] = useState(false);
    const [pendingSummary, setPendingSummary] = useState<string | undefined>(undefined);
    const [isWiping, setIsWiping] = useState(false);
    const [lipSyncShot, setLipSyncShot] = useState<{ id: string, videoUrl: string } | null>(null);

    if (!activeSceneId) return null;

    // --- HANDLERS ---

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

            {/* HEADER */}
            <div style={styles.sbHeader}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                    <ArrowLeft size={20} /> CLOSE BOARD
                </button>
                <div style={{ marginLeft: '20px', fontFamily: 'Anton, sans-serif', fontSize: '24px', letterSpacing: '1px', color: '#fff' }}>
                    SCENE STORYBOARD
                </div>

                <div style={styles.infoBox}>
                    <Zap size={14} color="#FF0000" />
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace', margin: 0 }}>CREDITS</p>
                        <p style={{ fontSize: '10px', color: credits && credits > 0 ? '#FFF' : '#FF0000', fontWeight: 'bold', margin: 0 }}>
                            {credits !== null ? credits : '...'}
                        </p>
                    </div>
                </div>

                <div style={{ marginLeft: '40px', display: 'flex', alignItems: 'center', gap: '10px' }} id="tour-sb-aspect">
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>ASPECT:</span>
                    <select
                        value={shotMgr.aspectRatio}
                        onChange={(e) => shotMgr.setAspectRatio(e.target.value)}
                        style={{ backgroundColor: '#111', color: 'white', border: '1px solid #333', padding: '6px', fontSize: '11px', fontWeight: 'bold' }}
                    >
                        <option value="16:9">16:9 (Cinema)</option>
                        <option value="21:9">21:9 (Wide)</option>
                        <option value="9:16">9:16 (Vertical)</option>
                        <option value="4:3">4:3 (TV)</option>
                    </select>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                    {shotMgr.shots.length > 0 && (
                        <button
                            onClick={handleSafeGenerateAll}
                            disabled={(shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting || shotMgr.isStopping}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: shotMgr.isGeneratingAll ? '#450a0a' : '#222',
                                color: shotMgr.isGeneratingAll ? '#f87171' : '#FFF',
                                fontWeight: 'bold',
                                border: shotMgr.isGeneratingAll ? '1px solid #7f1d1d' : '1px solid #333',
                                cursor: (shotMgr.isStopping || (shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting) ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px',
                                opacity: ((shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting || shotMgr.isStopping) ? 0.5 : 1,
                                transition: 'all 0.2s ease', minWidth: '160px', justifyContent: 'center'
                            }}
                        >
                            {shotMgr.isStopping ? <><Loader2 size={14} className="animate-spin" /> STOPPING...</> : shotMgr.isGeneratingAll ? <><Square size={14} fill="currentColor" /> STOP</> : <><Layers size={14} /> GENERATE ALL</>}
                        </button>
                    )}

                    <button
                        onClick={() => handleSafeAutoDirect()}
                        disabled={shotMgr.isAutoDirecting || shotMgr.isGeneratingAll || shotMgr.isStopping}
                        style={{ padding: '10px 20px', backgroundColor: '#222', color: '#FFF', fontWeight: 'bold', border: '1px solid #333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}
                    >
                        <Wand2 size={14} /> AUTO-DIRECT
                    </button>
                    <button
                        onClick={() => shotMgr.handleAddShot(currentScene)}
                        style={{ padding: '10px 20px', backgroundColor: '#FFF', color: 'black', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}
                    >
                        <Plus size={14} /> ADD SHOT
                    </button>
                </div>
            </div>

            {/* SCENE CONTEXT STRIP */}
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
                    onGenerateVoice={shotMgr.handleGenerateVoiceover}
                    onStartSync={(audioUrl, audioFile) => {
                        const shot = shotMgr.shots.find((s: any) => s.id === lipSyncShot.id);
                        if (shot) return shotMgr.handleLipSyncShot(shot, audioUrl, audioFile);
                        return Promise.resolve();
                    }}
                />
            )}

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#050505' }}>
                {shotMgr.shots.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px dashed #222', borderRadius: '8px', minHeight: '400px' }}>
                        <Film size={48} style={{ opacity: 0.2, color: '#FFF', marginBottom: '20px' }} />
                        <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '24px', color: '#333' }}>EMPTY SEQUENCE</h3>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                            <button onClick={() => handleSafeAutoDirect()} disabled={shotMgr.isAutoDirecting} style={{ padding: '12px 24px', backgroundColor: '#FF0000', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                                            onDelete={() => onDeleteShot(shot.id)}
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
                                            // Additional props for Card
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
                                                    onDownload={() => onDownload(shot)}
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

            {/* TERMINAL OVERLAY */}
            {shotMgr.isAutoDirecting && (
                <div style={styles.terminalOverlay}>
                    <div style={styles.terminalBox}>
                        {shotMgr.terminalLog.map((log: string, i: number) => (<div key={i} style={styles.terminalLine}>{log}</div>))}
                        <div style={styles.terminalLine}>_ <span className="animate-pulse">|</span></div>
                    </div>
                </div>
            )}

            {/* MODALS */}
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

            {/* TOUR */}
            <StoryboardTour step={tourStep} onNext={onTourNext} onComplete={onTourComplete} />
        </div>
    );
};