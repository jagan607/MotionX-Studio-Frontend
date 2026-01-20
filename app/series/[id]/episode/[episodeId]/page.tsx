"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

// --- CUSTOM IMPORTS ---
import { API_BASE_URL } from "@/lib/config";
import { useCredits } from "@/hooks/useCredits";
import { toastError } from "@/lib/toast";
import { Toaster } from "react-hot-toast";
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

/**
 * ROBUST SANITIZATION LOGIC
 * 1. Convert separators (-, _) to spaces first.
 * 2. Remove illegal chars.
 * 3. Trim and underscore spaces.
 * Example: "RED-WATTLED_LAPWING" -> "red wattled lapwing" -> "red_wattled_lapwing"
 */
const sanitizeId = (name: string) => {
    if (!name) return "unknown";
    // 1. Replace hyphens and underscores with spaces to preserve word separation
    let clean = name.replace(/[-_]/g, " ");
    // 2. Remove all special characters except spaces and alphanumerics
    clean = clean.replace(/[^a-zA-Z0-9\s]/g, "");
    // 3. Trim whitespace, lowercase, and underscores spaces
    return clean.trim().toLowerCase().replace(/\s+/g, "_");
};

export default function EpisodeBoard() {

    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };

    // 1. DATA & STATE
    const {
        episodeData,
        scenes,
        castMembers,
        setCastMembers,
        uniqueLocs,
        locations, // Locations fetched here
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

    // FIX: Updates traits based on the correct DB structure (Nested for Char, Flat for Loc)
    const handleUpdateTraits = async (newTraits: any) => {
        if (!assetMgr.selectedAssetId) return;

        try {
            const collectionName = assetMgr.assetType === 'location' ? 'locations' : 'characters';
            const dbDocId = assetMgr.selectedAssetId;
            const docRef = doc(db, "series", seriesId, collectionName, dbDocId);

            let updatePayload: any = {
                updated_at: new Date().toISOString()
            };

            if (assetMgr.assetType === 'location') {
                // Locations: Spread traits to top-level
                updatePayload = { ...updatePayload, ...newTraits };
            } else {
                // Characters: Nest traits back into 'visual_traits' object
                updatePayload = {
                    ...updatePayload,
                    visual_traits: {
                        age: newTraits.age || "",
                        ethnicity: newTraits.ethnicity || "",
                        hair: newTraits.hair || "",
                        clothing: newTraits.clothing || "",
                        vibe: newTraits.vibe || ""
                    }
                };
            }

            // 1. Write to Firestore
            await setDoc(docRef, updatePayload, { merge: true });

            // 2. Update Local State
            if (assetMgr.assetType === 'character') {
                setCastMembers((prev: CharacterProfile[]) => prev.map(member =>
                    member.id === dbDocId
                        ? { ...member, visual_traits: updatePayload.visual_traits }
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
        }
    };

    const handleLinkVoice = async (voiceData: { voice_id: string; voice_name: string }) => {
        if (!assetMgr.selectedAssetId) return;

        try {
            const dbDocId = assetMgr.selectedAssetId;
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
            toastError("Error deleting shot");
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
            toastError("Inpaint failed");
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
            <Toaster position="bottom-right" reverseOrder={false} />

            <EpisodeHeader
                seriesId={seriesId}
                episodeTitle={episodeData?.title}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                castCount={castMembers.length}
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
                    // CRITICAL FIX: Check if 'name' is actually an ID or Name by looking it up in the list
                    onEditAsset={(name, type, prompt) => {
                        const existingChar = castMembers.find(c => c.name === name || c.id === name);
                        const stableId = existingChar ? existingChar.id : sanitizeId(name);
                        assetMgr.openAssetModal(name, type, prompt, stableId);
                    }}
                    styles={styles}
                    onZoom={setZoomMedia}
                />
            )}

            {activeTab === 'locations' && (
                <LocationsTab
                    locations={locations}
                    uniqueLocs={uniqueLocs}
                    locationImages={locationImages}
                    onEditAsset={(name, type, prompt, existingId) => assetMgr.openAssetModal(name, type, prompt, existingId)}
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
                locations={locations} // <--- UPDATED: PASSING LOCATIONS DOWN
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
                const dbDocId = assetMgr.selectedAssetId;

                const selectedAssetData = assetMgr.assetType === 'location'
                    ? locations.find(l => l.id === dbDocId)
                    : castMembers.find(c => c.id === dbDocId);

                return (
                    <AssetModal
                        isOpen={assetMgr.modalOpen}
                        onClose={() => assetMgr.setModalOpen(false)}
                        onUpdateTraits={handleUpdateTraits}
                        onLinkVoice={handleLinkVoice}

                        assetId={assetMgr.selectedAssetId}
                        assetName={selectedAssetData?.name || assetMgr.selectedAsset || 'Unknown Asset'}
                        assetType={assetMgr.assetType}
                        currentData={selectedAssetData}

                        mode={assetMgr.modalMode}
                        setMode={assetMgr.setModalMode}
                        genPrompt={assetMgr.genPrompt}
                        setGenPrompt={assetMgr.setGenPrompt}
                        isProcessing={assetMgr.isProcessing}
                        basePrompt={selectedAssetData?.base_prompt}

                        onUpload={(file) => assetMgr.handleAssetUpload(file, (url) => {
                            if (!dbDocId) return;
                            if (assetMgr.assetType === 'location') {
                                setLocationImages(prev => ({ ...prev, [dbDocId]: url }));
                                setLocations(prev => prev.map(l =>
                                    l.id === dbDocId ? { ...l, image_url: url, source: 'upload' } : l
                                ));
                            } else {
                                setCastMembers((prev: any[]) => prev.map(m =>
                                    m.id === dbDocId ? { ...m, face_sample_url: url, image_url: url, source: 'upload' } : m
                                ));
                            }
                        })}

                        onGenerate={() => assetMgr.handleAssetGenerate((url) => {
                            if (!dbDocId) return;
                            if (assetMgr.assetType === 'location') {
                                setLocationImages(prev => ({ ...prev, [dbDocId]: url }));
                                setLocations(prev => prev.map(l =>
                                    l.id === dbDocId ? { ...l, image_url: url, source: 'ai_gen' } : l
                                ));
                            } else {
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