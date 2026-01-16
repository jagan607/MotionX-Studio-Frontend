"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, LayoutTemplate, Film, ImageIcon, Users } from "lucide-react";

// --- CUSTOM IMPORTS ---
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";
import { useCredits } from "@/hooks/useCredits";
import { styles } from "./components/BoardStyles";

// --- MODULAR COMPONENTS ---
import { StoryboardOverlay } from "./components/StoryboardOverlay";
import { CastingTab } from "./components/CastingTab";
import { AssetModal } from "./components/AssetModal";
import { ZoomOverlay } from "./components/ZoomOverlay";

// --- HOOKS ---
import { useEpisodeData, CharacterProfile } from "./hooks/useEpisodeData"; // Import Type
import { useAssetManager } from "./hooks/useAssetManager";
import { useShotManager } from "./hooks/useShotManager";

// --- TOURS & MODALS ---
import { TourGuide } from "./components/TourGuide";
import { useEpisodeTour } from "./hooks/useEpisodeTour";
import { useStoryboardTour } from "@/hooks/useStoryboardTour";
import { DownloadModal } from "./components/DownloadModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

export default function EpisodeBoard() {
    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };

    // 1. DATA & CREDITS
    const {
        episodeData, scenes, castMembers, setCastMembers, uniqueLocs,
        locationImages, setLocationImages, loading: dataLoading
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
    const [zoomMedia, setZoomMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
    const [inpaintData, setInpaintData] = useState<{ src: string, shotId: string } | null>(null);

    // 5. SHOT MANAGER
    const shotMgr = useShotManager(seriesId, episodeId, activeSceneId);

    // 6. DELETE STATE
    const [deleteShotId, setDeleteShotId] = useState<string | null>(null);
    const [isDeletingShot, setIsDeletingShot] = useState(false);
    const [downloadShot, setDownloadShot] = useState<any>(null);

    const currentScene = scenes.find(s => s.id === activeSceneId);

    // --- HANDLERS ---
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

    // --- DOWNLOAD LOGIC ---
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
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
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

                <div style={styles.tabRow} id="tour-assets-target">
                    <div style={styles.tabBtn(activeTab === 'scenes')} onClick={() => setActiveTab('scenes')}>
                        <LayoutTemplate size={16} /> SCENES
                    </div>
                    <div style={styles.tabBtn(activeTab === 'casting')} onClick={() => setActiveTab('casting')}>
                        <Users size={16} /> CASTING ({castMembers.length})
                    </div>
                    <div style={styles.tabBtn(activeTab === 'locations')} onClick={() => setActiveTab('locations')}>
                        <MapPin size={16} /> LOCATIONS ({uniqueLocs.length})
                    </div>
                </div>
            </div>

            {/* --- TAB CONTENT: SCENES --- */}
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

            {/* --- TAB CONTENT: CASTING (MODULAR) --- */}
            {activeTab === 'casting' && (
                <CastingTab
                    castMembers={castMembers}
                    loading={dataLoading}
                    onEditAsset={(id) => assetMgr.openAssetModal(id, 'character')}
                    styles={styles}
                />
            )}

            {/* --- TAB CONTENT: LOCATIONS --- */}
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

            {/* --- MODULAR OVERLAYS --- */}

            <StoryboardOverlay
                activeSceneId={activeSceneId}
                currentScene={currentScene}
                onClose={() => setActiveSceneId(null)}
                credits={credits}
                styles={styles}
                castMembers={castMembers}
                shotMgr={shotMgr}
                inpaintData={inpaintData}
                setInpaintData={setInpaintData}
                onSaveInpaint={handleInpaintSave}
                onApplyInpaint={handleApplyInpaint}
                onZoom={setZoomMedia}
                onDownload={(shot) => shot.video_url ? setDownloadShot(shot) : executeDownload(shot.image_url, `${shot.id}.jpg`)}
                onDeleteShot={setDeleteShotId}
                tourStep={sbTourStep}
                onTourNext={sbNextStep}
                onTourComplete={sbCompleteTour}
            />

            <AssetModal
                isOpen={assetMgr.modalOpen}
                onClose={() => assetMgr.setModalOpen(false)}
                selectedAsset={assetMgr.selectedAsset}
                mode={assetMgr.modalMode}
                setMode={assetMgr.setModalMode}
                genPrompt={assetMgr.genPrompt}
                setGenPrompt={assetMgr.setGenPrompt}
                isProcessing={assetMgr.isProcessing}

                // CALLBACK 1: ON UPLOAD
                onUpload={(file) => assetMgr.handleAssetUpload(file, (url) => {
                    if (assetMgr.assetType === 'location') {
                        setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                    } else if (assetMgr.assetType === 'character') {
                        // FIX: Explicitly typed to avoid TS7006 error
                        setCastMembers((prevMembers: CharacterProfile[]) => prevMembers.map(member =>
                            member.id === assetMgr.selectedAsset
                                ? { ...member, face_sample_url: url, image_url: url } // Updating both fields for consistency
                                : member
                        ));
                    }
                })}

                // CALLBACK 2: ON GENERATE
                onGenerate={() => assetMgr.handleAssetGenerate((url) => {
                    if (assetMgr.assetType === 'location') {
                        setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                    } else if (assetMgr.assetType === 'character') {
                        // FIX: Explicitly typed to avoid TS7006 error
                        setCastMembers((prevMembers: CharacterProfile[]) => prevMembers.map(member =>
                            member.id === assetMgr.selectedAsset
                                ? { ...member, face_sample_url: url, image_url: url } // Updating both fields for consistency
                                : member
                        ));
                    }
                })}

                styles={styles}
            />

            <ZoomOverlay
                media={zoomMedia}
                onClose={() => setZoomMedia(null)}
                styles={styles}
            />

            {/* --- UTILITIES --- */}
            <TourGuide step={epTourStep} onNext={epNextStep} onComplete={epCompleteTour} />

            {downloadShot && (
                <DownloadModal
                    shot={downloadShot}
                    onClose={() => setDownloadShot(null)}
                    onDownload={handleModalChoice}
                />
            )}

            {deleteShotId && (
                <DeleteConfirmModal
                    title="DELETE SHOT?"
                    message="Irreversible action. Assets will be lost."
                    isDeleting={isDeletingShot}
                    onConfirm={confirmShotDelete}
                    onCancel={() => setDeleteShotId(null)}
                />
            )}
        </main>
    );
}