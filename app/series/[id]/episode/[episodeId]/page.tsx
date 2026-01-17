"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { doc, setDoc, updateDoc } from "firebase/firestore";
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

// Helper to match Backend ID generation
const sanitizeId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

export default function EpisodeBoard() {

    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };

    // 1. DATA & STATE
    const {
        episodeData,
        scenes,
        castMembers,
        setCastMembers,
        uniqueLocs,      // List of names found in script (Strings)
        locations,       // Full Firestore Documents (Objects with traits)
        setLocations,
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

    const handleUpdateTraits = async (newTraits: any) => {
        if (!assetMgr.selectedAsset) return;

        try {
            const collectionName = assetMgr.assetType === 'location' ? 'locations' : 'characters';
            const dbDocId = sanitizeId(assetMgr.selectedAsset);
            const docRef = doc(db, "series", seriesId, collectionName, dbDocId);

            // 1. Prepare the update payload
            // We spread newTraits so terrain/atmosphere go to top-level, 
            // while visual_traits remains its own array/object.
            const updatePayload = {
                ...newTraits,
                name: assetMgr.selectedAsset,
                updated_at: new Date().toISOString()
            };

            // 2. Write to Firestore
            await setDoc(docRef, updatePayload, { merge: true });

            // 3. Update Local State
            if (assetMgr.assetType === 'character') {
                setCastMembers((prev: CharacterProfile[]) => prev.map(member =>
                    member.id === dbDocId
                        ? { ...member, ...updatePayload, visual_traits: newTraits.visual_traits || member.visual_traits }
                        : member
                ));
            } else {
                setLocations((prev: LocationProfile[]) => prev.map(loc =>
                    loc.id === dbDocId
                        ? { ...loc, ...updatePayload }
                        : loc
                ));
            }

        } catch (error) {
            console.error("Failed to update traits:", error);
            alert("Failed to save traits.");
        }
    };

    // --- HANDLER: LINK VOICE ---
    const handleLinkVoice = async (voiceData: { voice_id: string; voice_name: string }) => {
        if (!assetMgr.selectedAsset) return;

        try {
            const dbDocId = sanitizeId(assetMgr.selectedAsset);

            const charRef = doc(db, "series", seriesId, "characters", dbDocId);
            await updateDoc(charRef, {
                "voice_config.voice_id": voiceData.voice_id,
                "voice_config.voice_name": voiceData.voice_name,
                "voice_config.provider": "elevenlabs"
            });

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

    // --- UTILITY HANDLERS ---
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
                // FIX: Use locations.length (DB records) instead of uniqueLocs (script names)
                locCount={locations.length}
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
                    // UPDATE: Pass the base_prompt to the asset manager
                    onEditAsset={(id, type, prompt) => assetMgr.openAssetModal(id, type, prompt)}
                    styles={styles}
                    onZoom={setZoomMedia}
                />
            )}

            {activeTab === 'locations' && (
                <LocationsTab
                    locations={locations}
                    uniqueLocs={uniqueLocs}
                    locationImages={locationImages}
                    // UPDATE: Pass the base_prompt to the asset manager
                    onEditAsset={(locId, type, prompt) => assetMgr.openAssetModal(locId, type, prompt)}
                    styles={styles}
                    onZoom={setZoomMedia}
                />
            )}

            {/* --- STORYBOARD OVERLAY --- */}
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

            {/* --- ASSET MODAL --- */}
            {(() => {
                // Sanitize the ID to match Firestore keys
                const dbDocId = assetMgr.selectedAsset ? sanitizeId(assetMgr.selectedAsset) : null;

                // Retrieve the most up-to-date data from local state arrays
                const selectedAssetData = assetMgr.assetType === 'location'
                    ? locations.find(l => l.id === dbDocId)
                    : castMembers.find(c => c.id === dbDocId);

                return (
                    <AssetModal
                        isOpen={assetMgr.modalOpen}
                        onClose={() => assetMgr.setModalOpen(false)}
                        onUpdateTraits={handleUpdateTraits}
                        onLinkVoice={handleLinkVoice}

                        // Asset Identity Props
                        assetId={assetMgr.selectedAsset}
                        assetName={selectedAssetData?.name || assetMgr.selectedAsset || 'Unknown Asset'}
                        assetType={assetMgr.assetType}
                        currentData={selectedAssetData}

                        // Generation State & Logic
                        mode={assetMgr.modalMode}
                        setMode={assetMgr.setModalMode}
                        genPrompt={assetMgr.genPrompt}
                        setGenPrompt={assetMgr.setGenPrompt}
                        isProcessing={assetMgr.isProcessing} // Tied to specific Asset ID
                        basePrompt={selectedAssetData?.base_prompt} // Analysis-driven fallback

                        // --- UPLOAD HANDLER ---
                        onUpload={(file) => assetMgr.handleAssetUpload(file, (url) => {
                            if (!dbDocId) return;

                            if (assetMgr.assetType === 'location') {
                                // Update location image cache and main array
                                setLocationImages(prev => ({ ...prev, [dbDocId]: url }));
                                setLocations(prev => prev.map(l =>
                                    l.id === dbDocId ? { ...l, image_url: url, source: 'upload' } : l
                                ));
                            } else {
                                // Update character array immediately
                                setCastMembers((prev: any[]) => prev.map(m =>
                                    m.id === dbDocId ? { ...m, face_sample_url: url, image_url: url, source: 'upload' } : m
                                ));
                            }
                        })}

                        // --- GENERATE HANDLER ---
                        onGenerate={() => assetMgr.handleAssetGenerate((url) => {
                            if (!dbDocId) return;

                            if (assetMgr.assetType === 'location') {
                                // Update location image cache and main array
                                setLocationImages(prev => ({ ...prev, [dbDocId]: url }));
                                setLocations(prev => prev.map(l =>
                                    l.id === dbDocId ? { ...l, image_url: url, source: 'ai_gen' } : l
                                ));
                            } else {
                                // Update character array to reflect the new AI visual
                                setCastMembers((prev: any[]) => prev.map(m =>
                                    m.id === dbDocId ? { ...m, face_sample_url: url, image_url: url, source: 'ai_gen' } : m
                                ));
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