"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, MapPin, X, Users, LayoutTemplate, Camera, Upload,
    Sparkles, Loader2, Image as ImageIcon, Film, Plus, Wand2, Zap
} from "lucide-react";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy
} from '@dnd-kit/sortable';

// --- CUSTOM IMPORTS ---
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";
import { useCredits } from "@/hooks/useCredits";

import { styles } from "./components/BoardStyles";
import { ShotImage } from "./components/ShotImage";
import { InpaintEditor } from "./components/InpaintEditor";
import { SortableShotCard } from "./components/SortableShotCard";

// --- HOOKS ---
import { useEpisodeData } from "./hooks/useEpisodeData";
import { useAssetManager } from "./hooks/useAssetManager";
import { useShotManager } from "./hooks/useShotManager";

// --- TOURS & MODALS ---
import { TourGuide } from "./components/TourGuide";
import { useEpisodeTour } from "./hooks/useEpisodeTour";
import { StoryboardTour } from "@/components/StoryboardTour";
import { useStoryboardTour } from "@/hooks/useStoryboardTour";
import { DownloadModal } from "./components/DownloadModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

export default function EpisodeBoard() {
    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };

    // 1. DATA & CREDITS
    const {
        episodeData, scenes, uniqueChars, uniqueLocs,
        characterImages, setCharacterImages,
        locationImages, setLocationImages
    } = useEpisodeData(seriesId, episodeId);

    const { credits } = useCredits();

    // 2. TOUR HOOKS
    const { tourStep: epTourStep, nextStep: epNextStep, completeTour: epCompleteTour } = useEpisodeTour();
    const { tourStep: sbTourStep, nextStep: sbNextStep, completeTour: sbCompleteTour } = useStoryboardTour();

    // 3. ASSET MANAGER
    const assetMgr = useAssetManager(seriesId);

    // 4. UI STATE
    const [activeTab, setActiveTab] = useState('scenes');
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

    // --- UPDATED ZOOM STATE: Handles both Image and Video ---
    const [zoomMedia, setZoomMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);

    const [inpaintData, setInpaintData] = useState<{ src: string, shotId: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 5. SHOT MANAGER
    const shotMgr = useShotManager(seriesId, episodeId, activeSceneId);

    // --- DELETE STATE ---
    const [deleteShotId, setDeleteShotId] = useState<string | null>(null);
    const [isDeletingShot, setIsDeletingShot] = useState(false);

    // 6. DnD SENSORS
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const currentScene = scenes.find(s => s.id === activeSceneId);

    // --- DELETE HANDLER ---
    const confirmShotDelete = async () => {
        if (!deleteShotId) return;
        setIsDeletingShot(true);
        try {
            await shotMgr.handleDeleteShot(deleteShotId);
            setDeleteShotId(null);
        } catch (error) {
            console.error("Failed to delete shot", error);
            alert("Error deleting shot");
        } finally {
            setIsDeletingShot(false);
        }
    };

    // --- INPAINT HANDLERS ---
    const handleInpaintSave = async (prompt: string, maskBase64: string) => {
        if (!inpaintData) return null;
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("shot_id", inpaintData.shotId);
            formData.append("prompt", prompt);
            formData.append("original_image_url", inpaintData.src);
            formData.append("mask_image_base64", maskBase64);

            const res = await fetch(`${API_BASE_URL}/api/v1/shot/inpaint_shot`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });
            const data = await res.json();
            return data.status === "success" ? data.image_url : null;
        } catch (e) {
            alert("Inpaint failed");
            return null;
        }
    };

    const handleApplyInpaint = (url: string) => {
        if (inpaintData) {
            shotMgr.updateShot(inpaintData.shotId, "image_url", url);
            shotMgr.updateShot(inpaintData.shotId, "status", "rendered");
            setInpaintData(null);
        }
    };

    // --- DOWNLOAD HANDLERS ---
    const [downloadShot, setDownloadShot] = useState<any>(null);

    const executeDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error("Network response was not ok");

            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (e) {
            console.warn("Direct blob download failed (likely CORS). Switching to fallback...", e);
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadRequest = (shot: any) => {
        if (shot.video_url) setDownloadShot(shot);
        else if (shot.image_url) executeDownload(shot.image_url, `${shot.id}_image.jpg`);
    };

    const handleModalChoice = async (type: 'image' | 'video' | 'both') => {
        if (!downloadShot) return;
        if (type === 'image' || type === 'both') executeDownload(downloadShot.image_url, `${downloadShot.id}_image.jpg`);
        if (type === 'video' || type === 'both') {
            if (type === 'both') await new Promise(r => setTimeout(r, 500));
            executeDownload(downloadShot.video_url, `${downloadShot.id}_video.mp4`);
        }
        setDownloadShot(null);
    };

    return (
        <main style={styles.container}>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin-loader { animation: spin 1s linear infinite; }
            `}</style>

            {/* --- TOP NAV --- */}
            <div style={styles.topNav}>
                <Link href={`/series/${seriesId}`} style={styles.backLink}>
                    <ArrowLeft size={14} /> BACK TO EPISODES
                </Link>
                <div style={{ fontSize: '12px', color: '#444' }}>MOTION X STUDIO</div>
            </div>

            {/* --- HEADER --- */}
            <div style={styles.header}>
                <div style={styles.titleBlock}>
                    <h1 style={styles.title}>{episodeData?.title || 'UNTITLED'}</h1>
                    <p style={styles.subtitle}>PHASE 2: ASSET LAB</p>
                </div>

                {/* ID: TOUR TARGET 1 (EPISODE TOUR) */}
                <div style={styles.tabRow} id="tour-assets-target">
                    <div style={styles.tabBtn(activeTab === 'scenes')} onClick={() => setActiveTab('scenes')}>
                        <LayoutTemplate size={16} /> SCENES
                    </div>
                    <div style={styles.tabBtn(activeTab === 'casting')} onClick={() => setActiveTab('casting')}>
                        <Users size={16} /> CASTING ({uniqueChars.length})
                    </div>
                    <div style={styles.tabBtn(activeTab === 'locations')} onClick={() => setActiveTab('locations')}>
                        <MapPin size={16} /> LOCATIONS ({uniqueLocs.length})
                    </div>
                </div>
            </div>

            {/* --- SCENES TAB --- */}
            {activeTab === 'scenes' && (
                <div style={styles.grid}>
                    {scenes.map((scene, index) => (
                        <div key={scene.id} style={styles.card}>
                            <div style={styles.sceneHeader}>
                                <span style={styles.sceneTitle}>SCENE {scene.scene_number}</span>
                                <span style={styles.metaTag}>{scene.time_of_day}</span>
                            </div>
                            <div style={styles.locRow}>
                                <MapPin size={16} color="#666" /> {scene.location}
                            </div>
                            <p style={styles.actionText}>{scene.visual_action}</p>

                            {/* ID: TOUR TARGET 2 (EPISODE TOUR) */}
                            <button
                                id={index === 0 ? "tour-storyboard-target" : undefined}
                                onClick={() => setActiveSceneId(scene.id)}
                                style={{ width: '100%', padding: '15px', backgroundColor: '#222', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '12px', letterSpacing: '1px' }}
                            >
                                <Film size={16} /> OPEN STORYBOARD
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* --- CASTING TAB --- */}
            {activeTab === 'casting' && (
                <div style={styles.grid}>
                    {uniqueChars.map((char, index) => {
                        const imageUrl = characterImages[char];
                        return (
                            <div key={index} style={styles.assetCard}>
                                {imageUrl ? <img src={imageUrl} alt={char} style={styles.assetImage} /> : <div style={styles.assetPlaceholder}><Camera size={40} /></div>}
                                <div style={styles.assetName}>{char}</div>
                                <button
                                    style={{ ...styles.genBtn, backgroundColor: imageUrl ? '#222' : '#FF0000' }}
                                    onClick={() => assetMgr.openAssetModal(char, 'character')}
                                >
                                    {imageUrl ? "REGENERATE" : "GENERATE CHARACTER"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- LOCATIONS TAB --- */}
            {activeTab === 'locations' && (
                <div style={styles.grid}>
                    {uniqueLocs.map((loc, index) => {
                        const imageUrl = locationImages[loc];
                        return (
                            <div key={index} style={styles.assetCard}>
                                {imageUrl ? <img src={imageUrl} alt={loc} style={styles.assetImage} /> : <div style={styles.assetPlaceholder}><ImageIcon size={40} /></div>}
                                <div style={styles.assetName}>{loc}</div>
                                <button
                                    style={{ ...styles.genBtn, backgroundColor: imageUrl ? '#222' : '#FF0000' }}
                                    onClick={() => assetMgr.openAssetModal(loc, 'location')}
                                >
                                    {imageUrl ? "REGENERATE SET" : "BUILD SET"}
                                </button>
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

                    {inpaintData && (
                        <InpaintEditor
                            src={inpaintData.src}
                            styles={styles}
                            onClose={() => setInpaintData(null)}
                            onSave={handleInpaintSave}
                            onApply={handleApplyInpaint}
                        />
                    )}

                    {/* --- EMPTY STATE HANDLING --- */}
                    {shotMgr.shots.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', border: '1px dashed #222', backgroundColor: 'rgba(10, 10, 10, 0.5)', marginTop: '20px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: 'rgba(255, 0, 0, 0.1)', boxShadow: '0 0 20px rgba(255, 0, 0, 0.2)', animation: 'scanline 3s linear infinite' }} />
                            <style>{`@keyframes scanline { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }`}</style>
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
                            <SortableContext items={shotMgr.shots?.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                <div style={styles.sbGrid}>
                                    {shotMgr.shots.map((shot, index) => (
                                        <SortableShotCard
                                            key={shot.id}
                                            shot={shot}
                                            index={index}
                                            styles={styles}
                                            onDelete={() => setDeleteShotId(shot.id)}
                                        >
                                            <div style={styles.shotImageContainer}>
                                                <ShotImage
                                                    src={shot.image_url}
                                                    videoUrl={shot.video_url}
                                                    videoStatus={shot.video_status}
                                                    shotId={shot.id}
                                                    isSystemLoading={shotMgr.loadingShots.has(shot.id)}
                                                    // --- UPDATED ZOOM HANDLER ---
                                                    onClickZoom={() => {
                                                        if (shot.video_url) setZoomMedia({ url: shot.video_url, type: 'video' });
                                                        else if (shot.image_url) setZoomMedia({ url: shot.image_url, type: 'image' });
                                                    }}
                                                    onDownload={() => handleDownloadRequest(shot)}
                                                    onStartInpaint={() => setInpaintData({ src: shot.image_url, shotId: shot.id })}
                                                    onAnimate={() => shotMgr.handleAnimateShot(shot)}
                                                />
                                            </div>
                                            <label style={styles.label}>SHOT TYPE</label>
                                            <select style={styles.select} value={shot.type} onChange={(e) => shotMgr.updateShot(shot.id, "type", e.target.value)}>
                                                <option>Wide Shot</option><option>Medium Shot</option><option>Close Up</option><option>Over the Shoulder</option>
                                            </select>
                                            <label style={styles.label}>CASTING</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '15px' }}>
                                                {uniqueChars.map(char => (
                                                    <button
                                                        key={char}
                                                        onClick={() => {
                                                            const current = shot.characters || [];
                                                            const updated = current.includes(char) ? current.filter((c: string) => c !== char) : [...current, char];
                                                            shotMgr.updateShot(shot.id, "characters", updated);
                                                        }}
                                                        style={styles.charToggle(shot.characters?.includes(char))}
                                                    >
                                                        {char}
                                                    </button>
                                                ))}
                                            </div>
                                            <label style={styles.label}>VISUAL ACTION</label>
                                            <textarea style={styles.textArea} value={shot.prompt} onChange={(e) => shotMgr.updateShot(shot.id, "prompt", e.target.value)} />
                                            <button
                                                style={shotMgr.loadingShots.has(shot.id) ? styles.renderBtnLoading : styles.renderBtn}
                                                onClick={() => shotMgr.handleRenderShot(shot, currentScene)}
                                                disabled={shotMgr.loadingShots.has(shot.id)}
                                            >
                                                {shotMgr.loadingShots.has(shot.id) ? <Loader2 className="spin-loader" size={14} /> : <Sparkles size={14} />}
                                                {shotMgr.loadingShots.has(shot.id) ? "GENERATING..." : (shot.image_url ? "REGENERATE SHOT" : "RENDER SHOT")}
                                            </button>
                                        </SortableShotCard>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            )}

            {/* --- UTILITY OVERLAYS --- */}
            {shotMgr.isAutoDirecting && (
                <div style={styles.terminalOverlay}>
                    <div style={styles.terminalBox}>
                        {shotMgr.terminalLog.map((log, i) => (<div key={i} style={styles.terminalLine}>{log}</div>))}
                        <div style={styles.terminalLine}>_ <span className="spin-loader">|</span></div>
                    </div>
                </div>
            )}

            {/* --- UPDATED ZOOM OVERLAY: HANDLES VIDEO & IMAGE --- */}
            {zoomMedia && (
                <div style={styles.zoomOverlay} onClick={() => setZoomMedia(null)}>
                    {zoomMedia.type === 'video' ? (
                        <video
                            src={zoomMedia.url}
                            controls
                            autoPlay
                            loop
                            style={{ maxWidth: '90%', maxHeight: '90%', outline: 'none', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <img
                            src={zoomMedia.url}
                            style={styles.zoomImg}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                    <X size={30} style={{ position: 'absolute', top: 30, right: 30, color: 'white', cursor: 'pointer' }} onClick={() => setZoomMedia(null)} />
                </div>
            )}

            {assetMgr.modalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={styles.modal}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={styles.modalTitle}>{assetMgr.selectedAsset}</h2>
                            <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={() => assetMgr.setModalOpen(false)} />
                        </div>
                        <p style={styles.modalSub}>ASSET GENERATION</p>
                        <div style={styles.toggleRow}>
                            <div style={styles.toggleBtn(assetMgr.modalMode === 'upload')} onClick={() => assetMgr.setModalMode('upload')}>UPLOAD REF</div>
                            <div style={styles.toggleBtn(assetMgr.modalMode === 'generate')} onClick={() => assetMgr.setModalMode('generate')}>AI GENERATION</div>
                        </div>
                        {assetMgr.modalMode === 'upload' && (
                            <>
                                <div style={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
                                    <Upload size={32} style={{ marginBottom: '15px' }} />
                                    <p>CLICK TO UPLOAD REF</p>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            assetMgr.handleAssetUpload(e.target.files[0], (url) => {
                                                if (assetMgr.assetType === 'character') setCharacterImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                                                else setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                                            });
                                        }
                                    }}
                                />
                                {assetMgr.isProcessing && <div style={{ textAlign: 'center', color: '#FF0000' }}>UPLOADING...</div>}
                            </>
                        )}
                        {assetMgr.modalMode === 'generate' && (
                            <>
                                <textarea
                                    style={styles.textareaInput}
                                    value={assetMgr.genPrompt}
                                    onChange={(e) => assetMgr.setGenPrompt(e.target.value)}
                                    placeholder="Describe details..."
                                />
                                <button
                                    style={styles.primaryBtn}
                                    onClick={() => assetMgr.handleAssetGenerate((url) => {
                                        if (assetMgr.assetType === 'character') setCharacterImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                                        else setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                                    })}
                                    disabled={assetMgr.isProcessing}
                                >
                                    {assetMgr.isProcessing ? <Loader2 className="spin-loader" /> : <Sparkles size={18} />}
                                    {assetMgr.isProcessing ? "DREAMING..." : "GENERATE"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* --- RENDER TOURS --- */}
            <TourGuide step={epTourStep} onNext={epNextStep} onComplete={epCompleteTour} />

            {activeSceneId && (
                <StoryboardTour step={sbTourStep} onNext={sbNextStep} onComplete={sbCompleteTour} />
            )}

            {/* --- DOWNLOAD MODAL --- */}
            {downloadShot && (
                <DownloadModal
                    shot={downloadShot}
                    onClose={() => setDownloadShot(null)}
                    onDownload={handleModalChoice}
                />
            )}

            {/* --- DELETE CONFIRMATION MODAL --- */}
            {deleteShotId && (
                <DeleteConfirmModal
                    title="DELETE SHOT?"
                    message="This will permanently delete this shot and all its generated assets. This action is irreversible."
                    isDeleting={isDeletingShot}
                    onConfirm={confirmShotDelete}
                    onCancel={() => setDeleteShotId(null)}
                />
            )}
        </main>
    );
}