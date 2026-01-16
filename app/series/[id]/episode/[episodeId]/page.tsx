"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { doc, updateDoc, setDoc } from "firebase/firestore"; // Added setDoc
import { db, auth } from "@/lib/firebase";

// --- CUSTOM IMPORTS ---
import { API_BASE_URL } from "@/lib/config";
import { useCredits } from "@/hooks/useCredits";
import { styles } from "./components/BoardStyles";

// --- MODULAR COMPONENTS ---
import { EpisodeHeader } from "./components/EpisodeHeader";
import { ScenesTab } from "./components/ScenesTab";
import { CastingTab } from "./components/CastingTab";
import { LocationsTab } from "./components/LocationsTab";
import { StoryboardOverlay } from "./components/StoryboardOverlay";
import { ZoomOverlay } from "./components/ZoomOverlay";
import { DownloadModal } from "./components/DownloadModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { TourGuide } from "./components/TourGuide";
import { AssetModal } from './components/AssetModal';

// --- HOOKS ---
import { useEpisodeData } from "./hooks/useEpisodeData";
import { useAssetManager } from "./hooks/useAssetManager";
import { useShotManager } from "./hooks/useShotManager";
import { useEpisodeTour } from "./hooks/useEpisodeTour";
import { useStoryboardTour } from "@/hooks/useStoryboardTour";

// --- TYPES ---
import { CharacterProfile, LocationProfile } from "@/lib/types";

export default function EpisodeBoard() {

    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };

    // --- HELPER: MATCH DB ID FORMAT ---
    const sanitizeId = (name: string) => {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
    };

    // 1. DATA & STATE
    const {
        episodeData,
        scenes,
        castMembers,
        setCastMembers,
        uniqueLocs,
        locations,      // <--- NEW: Full Location Objects
        setLocations,   // <--- NEW: Setter
        locationImages,
        setLocationImages,
        loading: dataLoading
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

    // --- HANDLER: UPDATE TRAITS (FIXED) ---
    const handleUpdateTraits = async (newTraits: any) => {
        if (!assetMgr.selectedAsset) return;

        try {
            // A. DETERMINE COLLECTION & ID
            const collectionName = assetMgr.assetType === 'location' ? 'locations' : 'characters';
            const dbDocId = sanitizeId(assetMgr.selectedAsset);

            console.log(`Updating ${collectionName} | ID: ${dbDocId}`);

            // B. UPDATE FIRESTORE (Use setDoc for safety)
            const docRef = doc(db, "series", seriesId, collectionName, dbDocId);
            await setDoc(docRef, {
                visual_traits: newTraits,
                name: assetMgr.selectedAsset // Ensure name exists if creating new
            }, { merge: true });

            // C. UPDATE LOCAL STATE
            if (assetMgr.assetType === 'character') {
                setCastMembers((prev: CharacterProfile[]) => prev.map(member =>
                    member.id === dbDocId ? { ...member, visual_traits: newTraits } : member
                ));
            } else {
                setLocations((prev: LocationProfile[]) => prev.map(loc =>
                    loc.id === dbDocId ? { ...loc, visual_traits: newTraits } : loc
                ));
            }

        } catch (error) {
            console.error("Failed to update traits:", error);
            alert("Failed to save traits.");
        }
    };

    // --- HANDLER: LINK VOICE (FIXED) ---
    const handleLinkVoice = async (voiceData: { voice_id: string; voice_name: string }) => {
        if (!assetMgr.selectedAsset) return;

        try {
            const dbDocId = sanitizeId(assetMgr.selectedAsset); // Sanitize here too

            // 1. Update Firestore
            const charRef = doc(db, "series", seriesId, "characters", dbDocId);
            await updateDoc(charRef, {
                "voice_config.voice_id": voiceData.voice_id,
                "voice_config.voice_name": voiceData.voice_name,
                "voice_config.provider": "elevenlabs"
            });

            // 2. Update Local State
            setCastMembers((prev: CharacterProfile[]) => prev.map(member =>
                member.id === dbDocId
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

    // --- STANDARD HANDLERS ---
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
                const dbDocId = assetMgr.selectedAsset ? sanitizeId(assetMgr.selectedAsset) : null;

                // Select Data based on Type
                const selectedAssetData = assetMgr.assetType === 'location'
                    ? locations.find(l => l.id === dbDocId) // Look in Locations State
                    : castMembers.find(c => c.id === dbDocId); // Look in Characters State

                return (
                    <AssetModal
                        isOpen={assetMgr.modalOpen}
                        onClose={() => assetMgr.setModalOpen(false)}

                        // Handlers
                        onUpdateTraits={handleUpdateTraits}
                        onLinkVoice={handleLinkVoice}

                        // Props
                        assetId={assetMgr.selectedAsset}
                        assetName={selectedAssetData?.name || assetMgr.selectedAsset || 'Unknown Asset'}
                        assetType={assetMgr.assetType}
                        currentData={selectedAssetData}

                        mode={assetMgr.modalMode}
                        setMode={assetMgr.setModalMode}
                        genPrompt={assetMgr.genPrompt}
                        setGenPrompt={assetMgr.setGenPrompt}
                        isProcessing={assetMgr.isProcessing}

                        // Callback Updates
                        onUpload={(file) => assetMgr.handleAssetUpload(file, (url) => {
                            if (assetMgr.assetType === 'location') {
                                setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                                setLocations(prev => prev.map(l => l.id === dbDocId ? { ...l, image_url: url } : l));
                            } else if (assetMgr.assetType === 'character') {
                                setCastMembers((prev: CharacterProfile[]) => prev.map(m => m.id === dbDocId ? { ...m, face_sample_url: url, image_url: url } : m));
                            }
                        })}

                        onGenerate={() => assetMgr.handleAssetGenerate((url) => {
                            if (assetMgr.assetType === 'location') {
                                setLocationImages(prev => ({ ...prev, [assetMgr.selectedAsset!]: url }));
                                setLocations(prev => prev.map(l => l.id === dbDocId ? { ...l, image_url: url } : l));
                            } else if (assetMgr.assetType === 'character') {
                                setCastMembers((prev: CharacterProfile[]) => prev.map(m => m.id === dbDocId ? { ...m, face_sample_url: url, image_url: url } : m));
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