import React from 'react';
import { ArrowLeft, Zap, Wand2, Plus, Film, Loader2, Sparkles } from 'lucide-react';
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
import { StoryboardTour } from "@/components/StoryboardTour";

interface StoryboardOverlayProps {
    activeSceneId: string | null;
    currentScene: any;
    credits: number | null;
    styles: any;
    castMembers: any[];

    shotMgr: {
        shots: any[];
        aspectRatio: string;
        setAspectRatio: (val: string) => void;
        handleAutoDirect: (scene: any) => void;
        handleAddShot: (scene: any) => void;
        handleDragEnd: (event: any) => void;
        loadingShots: Set<string>;
        handleRenderShot: (shot: any, scene: any) => void;
        updateShot: (id: string, field: string, value: any) => void;
        handleAnimateShot: (shot: any) => void;
        terminalLog: string[];
        isAutoDirecting: boolean;
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
    activeSceneId, currentScene, onClose, credits, styles, castMembers,
    shotMgr, inpaintData, setInpaintData, onSaveInpaint, onApplyInpaint,
    onZoom, onDownload, onDeleteShot,
    tourStep, onTourNext, onTourComplete
}) => {

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    if (!activeSceneId) return null;

    return (
        <div style={styles.sbOverlay}>
            {/* --- HEADER --- */}
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
                    <button
                        id="tour-sb-autodirect"
                        onClick={() => shotMgr.handleAutoDirect(currentScene)}
                        disabled={shotMgr.isAutoDirecting}
                        style={{ padding: '12px 24px', backgroundColor: '#222', color: '#FFF', fontWeight: 'bold', border: '1px solid #333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px' }}
                    >
                        <Wand2 size={16} /> AUTO-DIRECT
                    </button>
                    <button onClick={() => shotMgr.handleAddShot(currentScene)} style={{ padding: '12px 24px', backgroundColor: '#FFF', color: 'black', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px' }}>
                        <Plus size={16} /> ADD SHOT
                    </button>
                </div>
            </div>

            {/* --- INPAINT EDITOR OVERLAY --- */}
            {inpaintData && (
                <InpaintEditor
                    src={inpaintData.src}
                    styles={styles}
                    onClose={() => setInpaintData(null)}
                    onSave={onSaveInpaint}
                    onApply={onApplyInpaint}
                />
            )}

            {/* --- MAIN CONTENT AREA --- */}
            {shotMgr.shots.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', border: '1px dashed #222', backgroundColor: 'rgba(10, 10, 10, 0.5)', marginTop: '20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: 'rgba(255, 0, 0, 0.1)', boxShadow: '0 0 20px rgba(255, 0, 0, 0.2)', animation: 'scanline 3s linear infinite' }} />
                    <Film size={80} style={{ opacity: 0.1, color: '#FFF', marginBottom: '20px' }} />
                    <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '32px', color: '#333', letterSpacing: '4px', textTransform: 'uppercase' }}>SEQUENCE_BUFFER_EMPTY</h3>
                    <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#555', marginTop: '10px', letterSpacing: '2px' }}>// NO VISUAL DATA DETECTED IN THIS SECTOR</p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
                        <button onClick={() => shotMgr.handleAutoDirect(currentScene)} disabled={shotMgr.isAutoDirecting} style={{ padding: '15px 30px', backgroundColor: '#FF0000', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 0 30px rgba(255,0,0,0.2)' }}>
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
                                >
                                    <div style={styles.shotImageContainer}>
                                        <ShotImage
                                            src={shot.image_url}
                                            videoUrl={shot.video_url}
                                            videoStatus={shot.video_status}
                                            shotId={shot.id}
                                            isSystemLoading={shotMgr.loadingShots.has(shot.id)}
                                            onClickZoom={() => {
                                                if (shot.video_url) onZoom({ url: shot.video_url, type: 'video' });
                                                else if (shot.image_url) onZoom({ url: shot.image_url, type: 'image' });
                                            }}
                                            onDownload={() => onDownload(shot)}
                                            onStartInpaint={() => setInpaintData({ src: shot.image_url, shotId: shot.id })}
                                            onAnimate={() => shotMgr.handleAnimateShot(shot)}
                                        />
                                    </div>
                                    <label style={styles.label}>SHOT TYPE</label>
                                    <select
                                        style={styles.select}
                                        value={shot.shot_type || "Wide Shot"}
                                        onChange={(e) => shotMgr.updateShot(shot.id, "shot_type", e.target.value)}
                                    >
                                        <option>Wide Shot</option>
                                        <option>Medium Shot</option>
                                        <option>Close Up</option>
                                        <option>Over the Shoulder</option>
                                    </select>

                                    <label style={styles.label}>CASTING</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '15px' }}>
                                        {castMembers.map((char: any) => (
                                            <button
                                                key={char.id}
                                                onClick={() => {
                                                    const current = shot.characters || [];
                                                    const charName = char.name;
                                                    const updated = current.includes(charName)
                                                        ? current.filter((c: string) => c !== charName)
                                                        : [...current, charName];
                                                    shotMgr.updateShot(shot.id, "characters", updated);
                                                }}
                                                style={styles.charToggle(shot.characters?.includes(char.name))}
                                            >
                                                {char.name}
                                            </button>
                                        ))}
                                    </div>

                                    <label style={styles.label}>VISUAL ACTION</label>
                                    {/* Corrected mapping to visual_action */}
                                    <textarea
                                        style={styles.textArea}
                                        value={shot.visual_action || ""}
                                        onChange={(e) => shotMgr.updateShot(shot.id, "visual_action", e.target.value)}
                                        placeholder="Describe the framing and action..."
                                    />

                                    <button
                                        style={shotMgr.loadingShots.has(shot.id) ? styles.renderBtnLoading : styles.renderBtn}
                                        onClick={() => shotMgr.handleRenderShot(shot, currentScene)}
                                        disabled={shotMgr.loadingShots.has(shot.id)}
                                    >
                                        {/* Corrected class to force-spin */}
                                        {shotMgr.loadingShots.has(shot.id) ? (
                                            <Loader2 className="force-spin" size={14} />
                                        ) : (
                                            <Sparkles size={14} />
                                        )}
                                        {shotMgr.loadingShots.has(shot.id) ? "GENERATING..." : (shot.image_url ? "REGENERATE SHOT" : "RENDER SHOT")}
                                    </button>
                                </SortableShotCard>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* --- TERMINAL OVERLAY --- */}
            {shotMgr.isAutoDirecting && (
                <div style={styles.terminalOverlay}>
                    <div style={styles.terminalBox}>
                        {shotMgr.terminalLog.map((log: string, i: number) => (<div key={i} style={styles.terminalLine}>{log}</div>))}
                        <div style={styles.terminalLine}>_ <span className="force-spin">|</span></div>
                    </div>
                </div>
            )}

            <StoryboardTour step={tourStep} onNext={onTourNext} onComplete={onTourComplete} />
        </div>
    );
};