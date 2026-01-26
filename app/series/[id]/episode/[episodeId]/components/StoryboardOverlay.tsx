"use client";

import React, { useState } from 'react';
import { ArrowLeft, Zap, Wand2, Plus, Film, Layers, Square, Loader2 } from 'lucide-react';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy
} from '@dnd-kit/sortable';

// --- CUSTOM IMPORTS ---
import { ShotImage } from "./ShotImage";
import { InpaintEditor } from "./InpaintEditor";
import { SortableShotCard } from "./SortableShotCard";
import { SceneContextStrip } from "./SceneContextStrip";
import { StoryboardTour } from "@/components/StoryboardTour";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { useMediaViewer } from "@/app/context/MediaViewerContext";
import { Toaster } from "react-hot-toast";
import { LipSyncModal } from "./LipSyncModal";

interface StoryboardOverlayProps {
    activeSceneId: string | null;
    currentScene: any;
    credits: number | null;
    styles: any;
    castMembers: any[];
    locations: any[];
    seriesName: string;
    episodeTitle: string;

    shotMgr: {
        shots: any[];
        aspectRatio: string;
        setAspectRatio: (val: string) => void;
        handleAutoDirect: (scene: any, overrideSummary?: string) => void;
        handleGenerateAll: (scene: any) => void;
        handleAddShot: (scene: any) => void;
        handleDragEnd: (event: any) => void;
        loadingShots: Set<string>;
        handleRenderShot: (shot: any, scene: any, referenceFile?: File | null) => void;
        updateShot: (id: string, field: string, value: any) => void;
        handleAnimateShot: (shot: any, provider?: string) => void; // UPDATED INTERFACE
        terminalLog: string[];
        isAutoDirecting: boolean;
        wipeSceneData: () => Promise<void>;
        wipeShotImagesOnly: () => Promise<void>;
        isGeneratingAll: boolean;
        isStopping: boolean;
        stopGeneration: () => void;
        handleFinalizeShot: (shot: any) => void;
        handleGenerateVoiceover: (text: string, voiceId: string) => Promise<string | null>;
        handleLipSyncShot: (shot: any, audioUrl: string | null, audioFile: File | null) => Promise<void>;
    };

    inpaintData: { src: string, shotId: string } | null;
    setInpaintData: (data: { src: string, shotId: string } | null) => void;
    onSaveInpaint: (prompt: string, maskBase64: string) => Promise<string | null>;
    onApplyInpaint: (url: string) => void;

    onClose: () => void;
    onZoom: (media: { url: string, type: 'image' | 'video' }) => void;
    onDownload: (shot: any) => void;
    onDeleteShot: (shotId: string) => void;

    tourStep: number;
    onTourNext: () => void;
    onTourComplete: () => void;
}

export const StoryboardOverlay: React.FC<StoryboardOverlayProps> = ({
    activeSceneId, currentScene, onClose, credits, styles, castMembers, locations,
    seriesName, episodeTitle,
    shotMgr, inpaintData, setInpaintData, onSaveInpaint, onApplyInpaint,
    onZoom, onDownload, onDeleteShot,
    tourStep, onTourNext, onTourComplete
}) => {

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const { openViewer } = useMediaViewer();

    // --- SAFETY STATE ---
    const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
    const [showGenerateWarning, setShowGenerateWarning] = useState(false);

    const [pendingSummary, setPendingSummary] = useState<string | undefined>(undefined);
    const [isWiping, setIsWiping] = useState(false);

    const [lipSyncShot, setLipSyncShot] = useState<{ id: string, videoUrl: string } | null>(null);

    if (!activeSceneId) return null;

    // --- LOGIC 1: AUTO-DIRECT SAFETY ---
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
            console.error("Overwrite failed:", error);
        } finally {
            setIsWiping(false);
            setShowOverwriteWarning(false);
            setPendingSummary(undefined);
        }
    };

    // --- LOGIC 2: GENERATE ALL SAFETY ---
    const handleSafeGenerateAll = () => {
        // Prevent action if stopping
        if (shotMgr.isStopping) return;

        // If currently generating, stop it
        if (shotMgr.isGeneratingAll) {
            shotMgr.stopGeneration();
            return;
        }

        // Check for existing media
        const hasMedia = shotMgr.shots.some(s => s.image_url || s.video_url);

        if (hasMedia) {
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
            console.error("Generate reset failed:", error);
        } finally {
            setIsWiping(false);
            setShowGenerateWarning(false);
        }
    };

    // --- LOGIC 3: MEDIA VIEWER HANDLER (Full Context) ---
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

    // --- DATA RESOLVER ---
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
            {/* --- 1. HEADER --- */}
            <div style={styles.sbHeader}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 'bold' }}>
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

                <div style={{ marginLeft: '40px', display: 'flex', alignItems: 'center', gap: '10px' }} id="tour-sb-aspect">
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>ASPECT:</span>
                    <select value={shotMgr.aspectRatio} onChange={(e) => shotMgr.setAspectRatio(e.target.value)} style={{ backgroundColor: '#111', color: 'white', border: '1px solid #333', padding: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                        <option value="16:9">16:9 (Cinema)</option>
                        <option value="21:9">21:9 (Wide)</option>
                        <option value="9:16">9:16 (Vertical)</option>
                    </select>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                    {/* DYNAMIC GENERATE ALL / STOP BUTTON */}
                    {shotMgr.shots.length > 0 && (
                        <button
                            onClick={handleSafeGenerateAll}
                            disabled={
                                (shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || // Individual loading
                                shotMgr.isAutoDirecting ||                                     // Auto-Directing
                                shotMgr.isStopping                                             // Stopping in progress
                            }
                            style={{
                                padding: '12px 24px',
                                backgroundColor: shotMgr.isGeneratingAll ? '#450a0a' : '#222',
                                color: shotMgr.isGeneratingAll ? '#f87171' : '#FFF',
                                fontWeight: 'bold',
                                border: shotMgr.isGeneratingAll ? '1px solid #7f1d1d' : '1px solid #333',
                                cursor: (shotMgr.isStopping || (shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                letterSpacing: '1px',
                                opacity: ((shotMgr.loadingShots.size > 0 && !shotMgr.isGeneratingAll) || shotMgr.isAutoDirecting || shotMgr.isStopping) ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                                minWidth: '180px', // Prevent layout jump
                                justifyContent: 'center'
                            }}
                        >
                            {/* LOGIC: Show Stop if Generating, Show 'Stopping' if Stopping, else Generate */}
                            {shotMgr.isStopping ? (
                                <>
                                    <Loader2 size={14} className="force-spin" /> STOPPING...
                                </>
                            ) : shotMgr.isGeneratingAll ? (
                                <>
                                    <Square size={14} fill="currentColor" /> STOP GENERATING
                                </>
                            ) : (
                                <>
                                    <Layers size={16} /> GENERATE ALL FRAMES
                                </>
                            )}
                        </button>
                    )}

                    <button
                        id="tour-sb-autodirect"
                        onClick={() => handleSafeAutoDirect()}
                        disabled={shotMgr.isAutoDirecting || shotMgr.isGeneratingAll || shotMgr.isStopping}
                        style={{ padding: '12px 24px', backgroundColor: '#222', color: '#FFF', fontWeight: 'bold', border: '1px solid #333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px' }}
                    >
                        <Wand2 size={16} /> AUTO-DIRECT
                    </button>
                    <button onClick={() => shotMgr.handleAddShot(currentScene)} style={{ padding: '12px 24px', backgroundColor: '#FFF', color: 'black', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px' }}>
                        <Plus size={16} /> ADD SHOT
                    </button>
                </div>
            </div>

            {/* --- 2. MODULAR SCENE CONTEXT STRIP --- */}
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

            {/* --- 3. INPAINT EDITOR OVERLAY --- */}
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
                        const shot = shotMgr.shots.find(s => s.id === lipSyncShot.id);
                        if (shot) return shotMgr.handleLipSyncShot(shot, audioUrl, audioFile);
                        return Promise.resolve();
                    }}
                />
            )}

            {/* --- 4. MAIN CONTENT AREA --- */}
            {shotMgr.shots.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', border: '1px dashed #222', backgroundColor: 'rgba(10, 10, 10, 0.5)', margin: '20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: 'rgba(255, 0, 0, 0.1)', boxShadow: '0 0 20px rgba(255, 0, 0, 0.2)', animation: 'scanline 3s linear infinite' }} />
                    <Film size={80} style={{ opacity: 0.1, color: '#FFF', marginBottom: '20px' }} />
                    <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '32px', color: '#333', letterSpacing: '4px', textTransform: 'uppercase' }}>SEQUENCE_BUFFER_EMPTY</h3>
                    <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#555', marginTop: '10px', letterSpacing: '2px' }}>// NO VISUAL DATA DETECTED IN THIS SECTOR</p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
                        <button
                            onClick={() => handleSafeAutoDirect()}
                            disabled={shotMgr.isAutoDirecting}
                            style={{ padding: '15px 30px', backgroundColor: '#FF0000', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 0 30px rgba(255,0,0,0.2)' }}
                        >
                            <Wand2 size={18} /> INITIALIZE AUTO-DIRECTOR
                        </button>
                        <button onClick={() => shotMgr.handleAddShot(currentScene)} style={{ padding: '15px 30px', backgroundColor: 'transparent', color: '#666', border: '1px solid #333', fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Plus size={18} /> MANUAL ENTRY
                        </button>
                    </div>
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={shotMgr.handleDragEnd}>
                    <SortableContext items={shotMgr.shots?.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
                        <div style={styles.sbGrid}>
                            {shotMgr.shots.map((shot: any, index: number) => (
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
                                    onRender={(referenceFile?: File | null) => shotMgr.handleRenderShot(shot, currentScene, referenceFile)}

                                    // --- PASS THE PROVIDER ---
                                    onAnimate={(provider) => shotMgr.handleAnimateShot(shot, provider)}

                                    isRendering={shotMgr.loadingShots.has(shot.id)}
                                    onFinalize={() => shotMgr.handleFinalizeShot(shot)}
                                    onExpand={() => handleOpenViewer(index)}
                                >
                                    {/* PREVIEW CONTENT */}
                                    <div style={styles.shotImageContainer}>
                                        <ShotImage
                                            src={shot.image_url}
                                            videoUrl={shot.lipsync_url || shot.video_url}
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
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* --- 5. TERMINAL OVERLAY --- */}
            {shotMgr.isAutoDirecting && (
                <div style={styles.terminalOverlay}>
                    <div style={styles.terminalBox}>
                        {shotMgr.terminalLog.map((log: string, i: number) => (<div key={i} style={styles.terminalLine}>{log}</div>))}
                        <div style={styles.terminalLine}>_ <span className="force-spin">|</span></div>
                    </div>
                </div>
            )}

            {/* --- 6. SAFETY MODALS --- */}
            {showOverwriteWarning && (
                <DeleteConfirmModal
                    title="OVERWRITE SCENE?"
                    message="Running Auto-Director will PERMANENTLY DELETE all existing shots and generated media for this scene. This action cannot be undone."
                    isDeleting={isWiping}
                    onConfirm={confirmOverwrite}
                    onCancel={() => {
                        setShowOverwriteWarning(false);
                        setPendingSummary(undefined);
                    }}
                />
            )}

            {showGenerateWarning && (
                <DeleteConfirmModal
                    title="RE-GENERATE FRAMES?"
                    message="Generating all frames will PERMANENTLY DELETE any existing images or videos created for these shots. The shot descriptions will be preserved."
                    isDeleting={isWiping}
                    onConfirm={confirmGenerateAll}
                    onCancel={() => setShowGenerateWarning(false)}
                />
            )}

            <StoryboardTour step={tourStep} onNext={onTourNext} onComplete={onTourComplete} />
        </div>
    );
};