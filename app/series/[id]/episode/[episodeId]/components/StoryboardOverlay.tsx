import React, { useState, useEffect } from 'react';
import { ArrowLeft, Zap, Wand2, Plus, Film, Loader2, Layers, MapPin, Clock, Users, Sparkles } from 'lucide-react';
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

    // --- LOCAL STATE FOR EDITABLE SUMMARY ---
    const [localSummary, setLocalSummary] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    // Initialize local state when scene opens
    useEffect(() => {
        if (currentScene) {
            setLocalSummary(currentScene.summary || currentScene.description || "");
        }
    }, [currentScene]);

    if (!activeSceneId) return null;

    // --- LOGISTICS RESOLVER ---

    // 1. Resolve Location Name from ID
    const rawLoc = currentScene?.location || currentScene?.location_name || currentScene?.location_id;
    const foundLoc = locations.find(l => l.id === rawLoc || l.name === rawLoc);
    const sceneLoc = foundLoc ? foundLoc.name : (rawLoc || "UNKNOWN LOCATION");

    // 2. Resolve Character Names from IDs
    let charDisplay = "NO CAST";
    if (Array.isArray(currentScene?.characters) && currentScene.characters.length > 0) {
        charDisplay = currentScene.characters.map((charKey: string) => {
            const member = castMembers.find(c => c.id === charKey || c.name === charKey);
            return member ? member.name.toUpperCase() : charKey.toUpperCase();
        }).join(", ");
    } else if (typeof currentScene?.characters === 'string') {
        charDisplay = currentScene.characters.toUpperCase();
    }

    const sceneTime = currentScene?.time_of_day || "DAY";

    return (
        <div style={styles.sbOverlay}>
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
                    {/* GENERATE ALL BUTTON */}
                    {shotMgr.shots.length > 0 && (
                        <button
                            onClick={() => shotMgr.handleGenerateAll(currentScene)}
                            disabled={shotMgr.loadingShots.size > 0 || shotMgr.isAutoDirecting}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#222',
                                color: '#FFF',
                                fontWeight: 'bold',
                                border: '1px solid #333',
                                cursor: (shotMgr.loadingShots.size > 0 || shotMgr.isAutoDirecting) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                letterSpacing: '1px',
                                opacity: (shotMgr.loadingShots.size > 0 || shotMgr.isAutoDirecting) ? 0.5 : 1
                            }}
                        >
                            <Layers size={16} />
                            GENERATE ALL FRAMES
                        </button>
                    )}

                    <button
                        id="tour-sb-autodirect"
                        // Main Global Auto-Direct (Uses local summary)
                        onClick={() => shotMgr.handleAutoDirect(currentScene, localSummary)}
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

            {/* --- 2. SCENE CONTEXT STRIP (IMPROVED UI) --- */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start', // Align items to top to handle multi-line text
                gap: '25px',
                padding: '15px 25px',
                backgroundColor: '#111',
                borderBottom: '1px solid #222',
                marginBottom: '20px'
            }}>
                {/* Identity Block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px', paddingTop: '4px' }}>
                    <div style={{ color: '#666', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px' }}>
                        {seriesName.toUpperCase()} / {episodeTitle.toUpperCase()}
                    </div>
                    <div style={{ color: '#FF0000', fontFamily: 'Anton, sans-serif', fontSize: '24px', letterSpacing: '1px', lineHeight: '1' }}>
                        SCENE {currentScene.scene_number}
                    </div>
                </div>

                {/* Editable Summary Container */}
                <div style={{ flex: 1, maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#555', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Scene Summary (Editable)
                    </label>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#050505', // Distinct dark background
                        border: isFocused ? '1px solid #555' : '1px solid #222',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        transition: 'border-color 0.2s'
                    }}>
                        <textarea
                            value={localSummary}
                            onChange={(e) => setLocalSummary(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="Describe scene action here..."
                            rows={2}
                            style={{
                                width: '100%',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#eee',
                                fontSize: '13px',
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'inherit',
                                lineHeight: '1.4'
                            }}
                        />

                        {/* Inline Auto-Direct Action */}
                        <button
                            onClick={() => shotMgr.handleAutoDirect(currentScene, localSummary)}
                            disabled={shotMgr.isAutoDirecting}
                            title="Auto-Direct shots based on this summary"
                            style={{
                                marginLeft: '10px',
                                padding: '8px',
                                backgroundColor: shotMgr.isAutoDirecting ? '#333' : '#222',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                color: shotMgr.isAutoDirecting ? '#666' : '#4CAF50', // Green tint for "Action"
                                cursor: shotMgr.isAutoDirecting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            {shotMgr.isAutoDirecting ? <Loader2 size={16} className="force-spin" /> : <Sparkles size={16} />}
                        </button>
                    </div>
                </div>

                {/* Logistics Tags (Right Aligned) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', paddingTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1a1a1a', padding: '6px 12px', borderRadius: '4px', border: '1px solid #222' }}>
                        <MapPin size={12} color="#666" />
                        <span style={{ fontWeight: 'bold', color: '#ccc', fontSize: '10px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sceneLoc.toUpperCase()}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1a1a1a', padding: '6px 12px', borderRadius: '4px', border: '1px solid #222' }}>
                        <Clock size={12} color="#666" />
                        <span style={{ fontWeight: 'bold', color: '#ccc', fontSize: '10px' }}>{sceneTime.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1a1a1a', padding: '6px 12px', borderRadius: '4px', border: '1px solid #222' }}>
                        <Users size={12} color="#666" />
                        <span style={{ fontWeight: 'bold', color: '#ccc', fontSize: '10px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {charDisplay}
                        </span>
                    </div>
                </div>
            </div>

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

            {/* --- 4. MAIN CONTENT AREA --- */}
            {shotMgr.shots.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', border: '1px dashed #222', backgroundColor: 'rgba(10, 10, 10, 0.5)', margin: '20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: 'rgba(255, 0, 0, 0.1)', boxShadow: '0 0 20px rgba(255, 0, 0, 0.2)', animation: 'scanline 3s linear infinite' }} />
                    <Film size={80} style={{ opacity: 0.1, color: '#FFF', marginBottom: '20px' }} />
                    <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '32px', color: '#333', letterSpacing: '4px', textTransform: 'uppercase' }}>SEQUENCE_BUFFER_EMPTY</h3>
                    <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#555', marginTop: '10px', letterSpacing: '2px' }}>// NO VISUAL DATA DETECTED IN THIS SECTOR</p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
                        <button
                            onClick={() => shotMgr.handleAutoDirect(currentScene, localSummary)}
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
                                    onRender={() => shotMgr.handleRenderShot(shot, currentScene)}
                                    onAnimate={() => shotMgr.handleAnimateShot(shot)}
                                    isRendering={shotMgr.loadingShots.has(shot.id)}
                                >
                                    {/* PREVIEW CONTENT */}
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

            <StoryboardTour step={tourStep} onNext={onTourNext} onComplete={onTourComplete} />
        </div>
    );
};