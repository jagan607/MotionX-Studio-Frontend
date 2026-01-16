"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore"; // Firestore imports
import { db } from "@/lib/firebase";

// --- CUSTOM IMPORTS ---
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";
import { useCredits } from "@/hooks/useCredits";
import { styles } from "./components/BoardStyles";

// --- MODULAR COMPONENTS ---
import { EpisodeHeader } from "./components/EpisodeHeader";
import { ScenesTab } from "./components/ScenesTab";
import { CastingTab } from "./components/CastingTab";
import { LocationsTab } from "./components/LocationsTab";
import { StoryboardOverlay } from "./components/StoryboardOverlay";
import { AssetModal } from "./components/AssetModal";
import { ZoomOverlay } from "./components/ZoomOverlay";
import { DownloadModal } from "./components/DownloadModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { TourGuide } from "./components/TourGuide";

// --- HOOKS ---
import { useEpisodeData, CharacterProfile } from "./hooks/useEpisodeData";
import { useAssetManager } from "./hooks/useAssetManager";
import { useShotManager } from "./hooks/useShotManager";
import { useEpisodeTour } from "./hooks/useEpisodeTour";
import { useStoryboardTour } from "@/hooks/useStoryboardTour";

export default function EpisodeBoard() {
    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };

    // 1. DATA & STATE
    const {
        episodeData, scenes, castMembers, setCastMembers, uniqueLocs,
        locationImages, setLocationImages, loading: dataLoading
    } = useEpisodeData(seriesId, episodeId);

    const { credits } = useCredits();
    const assetMgr = useAssetManager(seriesId);

    const [activeTab, setActiveTab] = useState('scenes');
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [zoomMedia, setZoomMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
    const [inpaintData, setInpaintData] = useState<{ src: string, shotId: string } | null>(null);

    // 2. MANAGERS
    const shotMgr = useShotManager(seriesId, episodeId, activeSceneId);
    const currentScene = scenes.find(s => s.id === activeSceneId);

    // 3. TOURS
    const epTour = useEpisodeTour();
    const sbTour = useStoryboardTour();

    // 4. ACTION HANDLERS
    const [deleteShotId, setDeleteShotId] = useState<string | null>(null);
    const [isDeletingShot, setIsDeletingShot] = useState(false);
    const [downloadShot, setDownloadShot] = useState<any>(null);

    // --- NEW HANDLER: UPDATE TRAITS ---
    const handleUpdateTraits = async (newTraits: any) => {
        if (!assetMgr.selectedAsset) return;

        try {
            // 1. Update Firestore
            const charRef = doc(db, "series", seriesId, "characters", assetMgr.selectedAsset);
            await updateDoc(charRef, {
                visual_traits: newTraits
            });

            // 2. Update Local State (Immediate Reflection)
            setCastMembers((prev: CharacterProfile[]) => prev.map(member =>
                member.id === assetMgr.selectedAsset
                    ? { ...member, visual_traits: newTraits }
                    : member
            ));

        } catch (error) {
            console.error("Failed to update traits:", error);
            alert("Failed to save traits.");
        }
    };

    // --- NEW HANDLER: LINK VOICE ---
    const handleLinkVoice = async (voiceData: { voice_id: string; voice_name: string }) => {
        if (!assetMgr.selectedAsset) return;

        try {
            // 1. Update Firestore
            const charRef = doc(db, "series", seriesId, "characters", assetMgr.selectedAsset);
            await updateDoc(charRef, {
                "voice_config.voice_id": voiceData.voice_id,
                "voice_config.voice_name": voiceData.voice_name,
                "voice_config.provider": "elevenlabs"
            });

            // 2. Update Local State (Immediate Reflection for Traffic Light)
            setCastMembers((prev: CharacterProfile[]) => prev.map(member =>
                member.id === assetMgr.selectedAsset
                    ? {
                        ...member,
                        voice_config: {
                            ...member.voice_config,
                            voice_id: voiceData.voice_id,
                            voice_name: voiceData.voice_name
                        }
                    }
                    : member
            ));

        } catch (error) {
            console.error("Failed to link voice:", error);
            alert("Failed to link voice.");
        }
    };

    const confirmShotDelete = async () => {
        if (!deleteShotId) return;
        setIsDeletingShot(true);
        try {
            await shotMgr.handleDeleteShot(deleteShotId);
            setDeleteShotId(null);
        } catch (error) {
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

    return (
        <main style={styles.container}>

            <EpisodeHeader
                seriesId={seriesId}
                episodeTitle={episodeData?.title}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                castCount={castMembers.length}
                locCount={uniqueLocs.length}
                styles={styles}
            />

            {/* --- MAIN TABS --- */}
            {activeTab === 'scenes' && (
                <ScenesTab
                    scenes={scenes}
                    onOpenStoryboard={setActiveSceneId}
                    styles={styles}
                />
            )}

            {activeTab === 'casting' && (
                <CastingTab
                    castMembers={castMembers}
                    loading={dataLoading}
                    onEditAsset={(id) => assetMgr.openAssetModal(id, 'character')}
                    styles={styles}
                />
            )}

            {activeTab === 'locations' && (
                <LocationsTab
                    uniqueLocs={uniqueLocs}
                    locationImages={locationImages}
                    onEditAsset={(loc) => assetMgr.openAssetModal(loc, 'location')}
                    styles={styles}
                />
            )}

            {/* --- OVERLAYS --- */}

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
                tourStep={sbTour.tourStep}
                onTourNext={sbTour.nextStep}
                onTourComplete={sbTour.completeTour}
            />

            {/* ASSET MODAL with CALLBACKS */}
            {(() => {
                const selectedCharData = assetMgr.assetType === 'character'
                    ? castMembers.find(c => c.id === assetMgr.selectedAsset)
                    : undefined;

                return (
                    <AssetModal
                        isOpen={assetMgr.modalOpen}
                        onClose={() => assetMgr.setModalOpen(false)}

                        // Handlers
                        onUpdateTraits={handleUpdateTraits}
                        onLinkVoice={handleLinkVoice}

                        // Props
                        assetId={assetMgr.selectedAsset}
                        assetName={selectedCharData?.name || assetMgr.selectedAsset || 'Unknown Asset'}
                        assetType={assetMgr.assetType}
                        currentData={selectedCharData}

                        mode={assetMgr.modalMode}
                        setMode={assetMgr.setModalMode}
                        genPrompt={assetMgr.genPrompt}
                        setGenPrompt={assetMgr.setGenPrompt}
                        isProcessing={assetMgr.isProcessing}

                        onUpload={(file) => assetMgr.handleAssetUpload(file, (url) => {
                            if (assetMgr.assetType === 'location') {
                                setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                            } else if (assetMgr.assetType === 'character') {
                                setCastMembers((prev: CharacterProfile[]) => prev.map(m => m.id === assetMgr.selectedAsset ? { ...m, face_sample_url: url, image_url: url } : m));
                            }
                        })}

                        onGenerate={() => assetMgr.handleAssetGenerate((url) => {
                            if (assetMgr.assetType === 'location') {
                                setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                            } else if (assetMgr.assetType === 'character') {
                                setCastMembers((prev: CharacterProfile[]) => prev.map(m => m.id === assetMgr.selectedAsset ? { ...m, face_sample_url: url, image_url: url } : m));
                            }
                        })}

                        styles={styles}
                    />
                );
            })()}

            <ZoomOverlay media={zoomMedia} onClose={() => setZoomMedia(null)} styles={styles} />

            {/* --- UTILITIES --- */}
            <TourGuide step={epTour.tourStep} onNext={epTour.nextStep} onComplete={epTour.completeTour} />

            {downloadShot && (
                <DownloadModal
                    shot={downloadShot}
                    onClose={() => setDownloadShot(null)}
                    onDownload={async (type) => {
                        if (!downloadShot) return;
                        if (type === 'image' || type === 'both') executeDownload(downloadShot.image_url, `${downloadShot.id}_image.jpg`);
                        if (type === 'video' || type === 'both') {
                            if (type === 'both') await new Promise(r => setTimeout(r, 500));
                            executeDownload(downloadShot.video_url, `${downloadShot.id}_video.mp4`);
                        }
                        setDownloadShot(null);
                    }}
                />
            )}

            {deleteShotId && (
                <DeleteConfirmModal
                    title="DELETE SHOT?"
                    message="Irreversible action."
                    isDeleting={isDeletingShot}
                    onConfirm={confirmShotDelete}
                    onCancel={() => setDeleteShotId(null)}
                />
            )}
        </main>
    );
}