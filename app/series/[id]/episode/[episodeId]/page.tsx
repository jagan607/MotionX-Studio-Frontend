"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

// --- CUSTOM IMPORTS ---
import { API_BASE_URL } from "@/lib/config";
import { useCredits } from "@/hooks/useCredits";
import { toastError, toastSuccess } from "@/lib/toast";
import { Toaster } from "react-hot-toast";
import { Users, MapPin } from "lucide-react";

// --- MODULAR COMPONENTS ---
import { EpisodeHeader } from "./components/EpisodeHeader";
import { ScenesTab } from "./components/ScenesTab";
import { CastingTab } from "./components/CastingTab";
import { LocationsTab } from "./components/LocationsTab";
import { StoryboardOverlay } from "../../../../components/storyboard/StoryboardOverlay";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { AssetModal } from '../../../../../components/AssetModal';
import { LibraryModal } from "./components/LibraryModal";
import CreditModal from "@/app/components/modals/CreditModal"; // <--- 1. NEW IMPORT

// --- HOOKS ---
import { useEpisodeData } from "./hooks/useEpisodeData";
import { useAssetManager } from "./hooks/useAssetManager";
// import { useShotManager } from "./hooks/useShotManager";
import { useTour } from "@/hooks/useTour";
import { EPISODE_TOUR_STEPS, STORYBOARD_TOUR_STEPS } from "@/lib/tourConfigs";
import { useSeriesAssets } from "@/hooks/useSeriesAssets";

// --- TYPES ---
import { CharacterProfile, LocationProfile } from "@/lib/types";

// --- HELPERS ---
const sanitizeId = (name: string) => {
    if (!name) return "unknown";
    let clean = name.replace(/[-_]/g, " ");
    clean = clean.replace(/[^a-zA-Z0-9\s]/g, "");
    return clean.trim().toLowerCase().replace(/\s+/g, "_");
};

export default function EpisodeBoard() {

    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };

    // --- 2. NEW STATE FOR CREDIT MODAL ---
    const [showCreditModal, setShowCreditModal] = useState(false);

    // 1. DATA & STATE
    const {
        episodeData,
        scenes,
        castMembers,
        setCastMembers,
        uniqueLocs,
        locations,
        setLocations,
        locationImages,
        setLocationImages,
        loading: dataLoading
    } = useEpisodeData(seriesId, episodeId);

    // 2. SERIES MASTER LIBRARY (For Importing)
    const { masterCast, masterLocations } = useSeriesAssets(seriesId);
    const [libModalOpen, setLibModalOpen] = useState(false);
    const [libType, setLibType] = useState<'character' | 'location'>('character');

    const { credits } = useCredits();
    const assetMgr = useAssetManager(seriesId);

    const [activeTab, setActiveTab] = useState('scenes');
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [zoomMedia, setZoomMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
    const [inpaintData, setInpaintData] = useState<{ src: string, shotId: string } | null>(null);

    // 3. MANAGERS
    // --- 3. PASS THE MODAL TRIGGER TO SHOT MANAGER ---
    // const shotMgr = useShotManager(
    //     seriesId,
    //     episodeId,
    //     activeSceneId,
    //     () => setShowCreditModal(true) // <--- Logic added here
    // );

    const currentScene = scenes.find(s => s.id === activeSceneId);

    const epTour = useTour("episode_tour");
    const sbTour = useTour("storyboard_tour");

    const [deleteShotId, setDeleteShotId] = useState<string | null>(null);
    const [isDeletingShot, setIsDeletingShot] = useState(false);
    const [downloadShot, setDownloadShot] = useState<any>(null);

    // --- TRAITS UPDATE ---
    const handleUpdateTraits = async (newTraits: any) => {
        if (!assetMgr.selectedAssetId) return;
        try {
            const collectionName = assetMgr.assetType === 'location' ? 'locations' : 'characters';
            const dbDocId = assetMgr.selectedAssetId;
            const docRef = doc(db, "series", seriesId, collectionName, dbDocId);

            let updatePayload: any = { updated_at: new Date().toISOString() };

            if (assetMgr.assetType === 'location') {
                updatePayload = { ...updatePayload, ...newTraits };
            } else {
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

            await setDoc(docRef, updatePayload, { merge: true });

            if (assetMgr.assetType === 'character') {
                setCastMembers((prev: CharacterProfile[]) => prev.map(member =>
                    member.id === dbDocId ? { ...member, visual_traits: updatePayload.visual_traits } : member
                ));
            } else {
                setLocations((prev: LocationProfile[]) => prev.map(loc =>
                    loc.id === dbDocId ? { ...loc, ...updatePayload } : loc
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
                    ? { ...member, voice_config: { ...member.voice_config, voice_id: voiceData.voice_id, voice_name: voiceData.voice_name } }
                    : member
            ));
        } catch (error) {
            console.error("Failed to link voice:", error);
        }
    };

    // --- IMPORT HANDLER ---
    const handleImportAssets = async (selectedIds: string[]) => {
        if (selectedIds.length === 0) return;

        try {
            const epRef = doc(db, "series", seriesId, "episodes", episodeId);

            if (libType === 'character') {
                await updateDoc(epRef, { cast_ids: arrayUnion(...selectedIds) });
                const newMembers = masterCast.filter(m => selectedIds.includes(m.id));
                setCastMembers(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = newMembers.filter(m => !existingIds.has(m.id));
                    return [...prev, ...uniqueNew];
                });
                toastSuccess(`${selectedIds.length} Characters Imported`);
            } else {
                await updateDoc(epRef, { location_ids: arrayUnion(...selectedIds) }).catch(() => { });
                const newLocs = masterLocations.filter(m => selectedIds.includes(m.id));
                setLocations(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = newLocs.filter(m => !existingIds.has(m.id));
                    return [...prev, ...uniqueNew];
                });
                toastSuccess(`${selectedIds.length} Locations Imported`);
            }
        } catch (error) {
            console.error("Import failed:", error);
            toastError("Import Failed");
        }
    };

    // // --- OTHER HANDLERS ---
    // const confirmShotDelete = async () => {
    //     if (!deleteShotId) return;
    //     setIsDeletingShot(true);
    //     try {
    //         await shotMgr.handleDeleteShot(deleteShotId);
    //         setDeleteShotId(null);
    //     } catch (error) {
    //         toastError("Error deleting shot");
    //     } finally {
    //         setIsDeletingShot(false);
    //     }
    // };

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

    // const handleApplyInpaint = (url: string) => {
    //     if (inpaintData) {
    //         shotMgr.updateShot(inpaintData.shotId, "image_url", url);
    //         shotMgr.updateShot(inpaintData.shotId, "status", "rendered");
    //         setInpaintData(null);
    //     }
    // };

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
        <main>
            <TourOverlay step={epTour.step} steps={EPISODE_TOUR_STEPS} onNext={epTour.nextStep} onComplete={epTour.completeTour} />
            <TourOverlay step={sbTour.step} steps={STORYBOARD_TOUR_STEPS} onNext={sbTour.nextStep} onComplete={sbTour.completeTour} />
        </main>
    );
}