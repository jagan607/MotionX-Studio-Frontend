"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import { toastError, toastSuccess } from "@/lib/toast";

// --- API & TYPES ---
import {
    api,
    fetchProject,
    fetchProjectAssets,
    fetchEpisodes,
    fetchUserCredits,
    checkJobStatus
} from "@/lib/api";
import { Project, Asset } from "@/lib/types";
import { SceneData } from "@/components/studio/SceneCard";
import {
    collection, query, orderBy, getDocs, writeBatch, doc,
    setDoc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

// --- STUDIO COMPONENTS ---
import { StudioLayout } from "@/app/components/studio/StudioLayout";
import { StudioHeader } from "@/app/components/studio/StudioHeader";
import { ReelSidebar } from "@/app/components/studio/ReelSidebar";
import { SceneBin } from "@/app/components/studio/SceneBin";
import { ProjectSettingsModal } from "@/app/components/studio/ProjectSettingsModal";
import { SceneStoryboardContainer } from "@/app/components/studio/SceneStoryboardContainer";
import { ScriptIngestionModal } from "@/app/components/studio/ScriptIngestionModal";
import { AssetManagerModal } from "@/app/components/studio/AssetManagerModal";
import { ContextSelectorModal, ContextReference } from "@/app/components/script/ContextSelectorModal";
import { useTour } from "@/hooks/useTour";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { STUDIO_TOUR_STEPS } from "@/lib/tourConfigs";

export default function StudioPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Series State
    const [episodes, setEpisodes] = useState<any[]>([]);
    const [activeEpisodeId, setActiveEpisodeId] = useState<string>("");

    // Content State
    const [scenes, setScenes] = useState<SceneData[]>([]);

    // UI State
    const [selectedScene, setSelectedScene] = useState<SceneData | null>(null);
    const [editingScene, setEditingScene] = useState<SceneData | null>(null);

    const [credits, setCredits] = useState<number>(0);

    // AI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExtending, setIsExtending] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const { step: tourStep, nextStep: tourNext, completeTour: tourComplete } = useTour("studio_tour");


    // Dialog State
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
    const [scriptMode, setScriptMode] = useState<'new' | 'edit'>('new');
    const [scriptTargetEpId, setScriptTargetEpId] = useState<string>("");
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

    // Context Selector State
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);
    const [selectedContext, setSelectedContext] = useState<ContextReference[]>([]);

    // Asset DB
    const [assets, setAssets] = useState<{
        characters: Asset[],
        locations: Asset[],
        products: Asset[]
    }>({ characters: [], locations: [], products: [] });

    // Characters & Locations (for DirectorConsole)
    const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);
    const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
    const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

    // --- 1. INITIAL LOAD ---
    useEffect(() => {
        initializeStudio();
    }, [projectId]);

    const initializeStudio = async () => {
        try {
            const [projData, assetData, creditsData] = await Promise.all([
                fetchProject(projectId),
                fetchProjectAssets(projectId),
                fetchUserCredits(auth.currentUser?.uid || "")
            ]);

            setProject(projData);
            setAssets(assetData);
            setCredits(creditsData);

            // Fetch Characters & Locations subcollections
            try {
                const charQuery = query(collection(db, "projects", projectId, "characters"));
                const charSnapshot = await getDocs(charQuery);
                setCharacters(charSnapshot.docs.map(d => ({ id: d.id, name: d.data().name || "Unknown" })));
            } catch (e) { console.error("Failed to load characters", e); }

            try {
                const locRef = collection(db, "projects", projectId, "locations");
                const locSnapshot = await getDocs(locRef);
                const locList = locSnapshot.docs.map(d => ({ id: d.id, name: d.data().name || d.id }));
                // Fallback: if subcollection is empty, use API-fetched assets
                if (locList.length > 0) {
                    setLocations(locList);
                } else if (assetData?.locations?.length > 0) {
                    setLocations(assetData.locations.map((a: any) => ({ id: a.id, name: a.name || a.id })));
                }
            } catch (e) { console.error("Failed to load locations", e); }

            try {
                const prodRef = collection(db, "projects", projectId, "products");
                const prodSnapshot = await getDocs(prodRef);
                setProducts(prodSnapshot.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));
            } catch (e) { console.error("Failed to load products", e); }

            // Handle Movie vs. Series Logic
            if (projData.type === 'micro_drama') {
                try {
                    const epsData = await fetchEpisodes(projectId);
                    let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
                    eps = eps.sort((a: any, b: any) => (a.episode_number || 0) - (b.episode_number || 0));
                    const realEpisodes = eps.filter((e: any) => e.synopsis !== "Initial setup");
                    const finalEpisodes = realEpisodes.length > 0 ? realEpisodes : eps;

                    setEpisodes(finalEpisodes);
                    if (finalEpisodes.length > 0) {
                        setActiveEpisodeId(finalEpisodes[0].id);
                    } else {
                        setActiveEpisodeId("empty");
                        if (eps.length === 0) toast("No episodes found.");
                    }
                } catch (epError) {
                    console.error("Episode Fetch Error:", epError);
                    toast.error("Failed to load episodes");
                }

            } else {
                // Movie / Ad — single episode, but fetch real data for script_preview, runtime etc.
                const mainReelId = projData.default_episode_id || "main";
                try {
                    const epsData = await fetchEpisodes(projectId);
                    let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
                    const targetEp = eps.find((e: any) => e.id === mainReelId) || eps[0];
                    if (targetEp) {
                        setEpisodes([targetEp]);
                        setActiveEpisodeId(targetEp.id);
                    } else {
                        setEpisodes([{ id: mainReelId, title: "Main Picture Reel", episode_number: 1 }]);
                        setActiveEpisodeId(mainReelId);
                    }
                } catch (e) {
                    console.error("Failed to fetch episode for single-unit project", e);
                    setEpisodes([{ id: mainReelId, title: "Main Picture Reel", episode_number: 1 }]);
                    setActiveEpisodeId(mainReelId);
                }
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to load studio configuration");
        } finally {
            setLoading(false);
        }
    };

    // --- 2. FETCH SCENES (Direct Firestore) ---
    useEffect(() => {
        if (!activeEpisodeId || activeEpisodeId === "empty") return;
        loadScenes(activeEpisodeId);
    }, [activeEpisodeId]);

    const loadScenes = async (epId: string) => {
        try {
            const q = query(
                collection(db, "projects", projectId, "episodes", epId, "scenes"),
                orderBy("scene_number", "asc")
            );

            const snapshot = await getDocs(q);

            const sceneList: SceneData[] = snapshot.docs.map(d => {
                const data = d.data();
                const slugline = data.slugline || data.header || data.scene_header || "UNKNOWN SCENE";
                const synopsis = data.synopsis || data.summary || data.action || "";
                return {
                    id: d.id,
                    scene_number: Number(data.scene_number) || 0,
                    slugline,
                    synopsis,
                    time: data.time || "N/A",
                    characters: data.characters || data.cast_ids || [],
                    products: data.products || [],
                    location: data.location || data.location_name || "",
                    status: data.status || 'draft',
                    // DirectorConsole fields
                    header: slugline,
                    summary: synopsis,
                    cast_ids: data.cast_ids || data.characters || [],
                    location_id: data.location_id || "",
                    ...data  // Spread any extra Firestore fields
                };
            });

            sceneList.sort((a, b) => a.scene_number - b.scene_number);
            setScenes(sceneList);
        } catch (e) {
            console.error("Failed to load scenes from Firestore", e);
            toast.error("Could not fetch scenes");
        }
    };

    // --- 3. COMPUTED STATS ---
    const calculateStats = () => ({
        sceneCount: scenes.length,
        assetCount: assets.characters.length + assets.locations.length,
        format: (project as any)?.aspect_ratio || "16:9"
    });

    const stats = calculateStats();
    const activeReelTitle = episodes.find(e => e.id === activeEpisodeId)?.title || "Active Reel";

    // =============================================================
    // SCENE CRUD HANDLERS (Ported from editor/page.tsx)
    // =============================================================

    // REORDER
    const handleSceneReorder = async (newOrder: SceneData[]) => {
        setScenes(newOrder);
        try {
            const batch = writeBatch(db);
            newOrder.forEach((scene, index) => {
                const ref = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", scene.id);
                batch.update(ref, { scene_number: index + 1 });
            });
            await batch.commit();
        } catch (e) {
            console.error("Failed to save scene order", e);
            toast.error("Failed to save order");
        }
    };

    // MANUAL ADD
    const handleManualAdd = async () => {
        try {
            const maxSceneNum = scenes.length > 0
                ? Math.max(...scenes.map(s => s.scene_number))
                : 0;
            const newSceneNum = maxSceneNum + 1;
            const newSceneId = `scene_${uuidv4().slice(0, 8)}`;
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", newSceneId);

            await setDoc(sceneRef, {
                id: newSceneId,
                scene_number: newSceneNum,
                slugline: "INT. UNTITLED SCENE - DAY",
                synopsis: "",
                cast_ids: [],
                characters: [],
                location: "",
                status: "draft",
                created_at: serverTimestamp()
            });

            toast.success("New Scene Created");
            await loadScenes(activeEpisodeId);
        } catch (e) {
            console.error("Manual Add Error:", e);
            toast.error("Failed to create scene");
        }
    };

    // AUTO-EXTEND
    const handleAutoExtend = async () => {
        if (scenes.length === 0) {
            toast.error("Need at least one scene to extend from!");
            return;
        }

        setIsExtending(true);
        try {
            const lastScene = scenes[scenes.length - 1];
            const payload = {
                project_id: projectId,
                episode_id: activeEpisodeId,
                previous_scene: {
                    location: lastScene.header,
                    time_of_day: lastScene.time,
                    visual_action: lastScene.summary,
                    characters: lastScene.cast_ids
                }
            };

            const res = await api.post("/api/v1/script/extend-scene", payload);
            const generatedScene = res.data.scene;

            // [FIX] Try to resolve to an existing Project Asset (Location)
            // AI might return "ART STUDIO", but asset is "INT. ART STUDIO"
            let finalLocationName = generatedScene.location || "";
            let finalLocationId = "";

            if (finalLocationName) {
                const cleanName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
                const searchVal = cleanName(finalLocationName);

                const foundLoc = assets.locations.find(loc => {
                    const lName = cleanName(loc.name || "");
                    const lId = cleanName(loc.id || "");
                    return lName.includes(searchVal) || searchVal.includes(lName) || lId === searchVal;
                });

                if (foundLoc) {
                    finalLocationName = foundLoc.name; // Use canonical name (e.g. "INT. ART STUDIO")
                    finalLocationId = foundLoc.id;
                }
            }

            const maxSceneNum = Math.max(...scenes.map(s => s.scene_number));
            const newSceneNum = maxSceneNum + 1;
            const newSceneId = `scene_${uuidv4().slice(0, 8)}`;
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", newSceneId);

            await setDoc(sceneRef, {
                id: newSceneId,
                scene_number: newSceneNum,
                slugline: generatedScene.slugline || "EXT. NEW SCENE - DAY",
                synopsis: generatedScene.visual_action || generatedScene.synopsis || "",
                time: generatedScene.time_of_day || "DAY",
                cast_ids: generatedScene.characters || [],
                characters: generatedScene.characters || [],
                location: finalLocationName,
                location_id: finalLocationId,
                products: generatedScene.products || [],
                status: "draft",
                created_at: serverTimestamp()
            });

            toast.success("Scene Auto-Extended!");
            await loadScenes(activeEpisodeId);
        } catch (e) {
            console.error("Auto Extend Error:", e);
            toast.error("Failed to extend narrative");
        } finally {
            setIsExtending(false);
        }
    };

    // UPDATE SCENE (from DirectorConsole save)
    const handleUpdateScene = async (sceneId: string, updates: Partial<SceneData>) => {
        try {
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", sceneId);
            await updateDoc(sceneRef, updates);
            // Refresh local state
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
            // Also update editing scene if it's the active one
            if (editingScene?.id === sceneId) {
                setEditingScene(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (e) {
            console.error("Update Scene Error:", e);
            toast.error("Failed to save changes");
        }
    };

    // UPDATE CAST
    const handleUpdateCast = async (sceneId: string, newCast: string[]) => {
        try {
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", sceneId);
            await updateDoc(sceneRef, { cast_ids: newCast, characters: newCast });
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, cast_ids: newCast, characters: newCast } : s));
            if (editingScene?.id === sceneId) {
                setEditingScene(prev => prev ? { ...prev, cast_ids: newCast, characters: newCast } : null);
            }
        } catch (e) {
            console.error("Update Cast Error:", e);
            toast.error("Failed to update cast");
        }
    };

    // DELETE SCENE
    const handleDeleteScene = async (sceneId: string) => {
        try {
            if (editingScene?.id === sceneId) setEditingScene(null);
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", sceneId);
            await deleteDoc(sceneRef);
            setScenes(prev => prev.filter(s => s.id !== sceneId));
            toast.success("Scene Deleted");
        } catch (e) {
            console.error("Delete Scene Error:", e);
            toast.error("Failed to delete scene");
        }
    };

    // AI REWRITE
    const handleRewrite = async (sceneId: string, instruction: string, contextRefs?: any[]) => {
        setIsProcessing(true);
        const currentIndex = scenes.findIndex(s => s.id === sceneId);
        const targetScene = scenes[currentIndex];

        if (!targetScene) { setIsProcessing(false); return; }

        try {
            const prevScene = currentIndex > 0 ? scenes[currentIndex - 1] : null;
            const nextScene = currentIndex < scenes.length - 1 ? scenes[currentIndex + 1] : null;

            const memoryReferences = contextRefs?.map(ref => ({
                source: ref.sourceLabel,
                header: ref.header,
                content: ref.summary
            })) || [];

            const contextPayload = {
                project_genre: (project as any)?.genre,
                project_style: (project as any)?.style,
                previous_scene_summary: prevScene ? prevScene.summary : "Start of Episode",
                next_scene_header: nextScene ? nextScene.header : "End of Episode",
                characters: targetScene.cast_ids || [],
                custom_references: memoryReferences
            };

            const res = await api.post("api/v1/script/rewrite-scene", {
                original_text: targetScene.summary,
                instruction: instruction,
                context: `Scene Heading: ${targetScene.header}`,
                smart_context: contextPayload
            });

            const newText = res.data.new_text;
            const ref = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", sceneId);
            await updateDoc(ref, { synopsis: newText, summary: newText, status: 'draft' });

            // Update local state
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, synopsis: newText, summary: newText } : s));
            if (editingScene?.id === sceneId) {
                setEditingScene(prev => prev ? { ...prev, synopsis: newText, summary: newText } : null);
            }
            toast.success("Scene Updated");
        } catch (e) {
            console.error(e);
            toast.error("AI Rewrite Failed");
        } finally {
            setIsProcessing(false);
        }
    };

    // FETCH REMOTE SCENES (for ContextSelectorModal)
    const fetchRemoteScenes = async (targetEpisodeId: string) => {
        try {
            const q = query(
                collection(db, "projects", projectId, "episodes", targetEpisodeId, "scenes"),
                orderBy("scene_number", "asc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    scene_number: data.scene_number,
                    header: data.slugline || data.header || "UNKNOWN SCENE",
                    summary: data.synopsis || data.summary || "",
                };
            });
        } catch (e) {
            console.error("Context Load Error:", e);
            return [];
        }
    };

    // --- OTHER HANDLERS ---

    // --- SCRIPT & MODAL HANDLERS ---

    const loadEpisodes = async () => {
        try {
            const epsData = await fetchEpisodes(projectId);
            let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
            eps = eps.sort((a: any, b: any) => (a.episode_number || 0) - (b.episode_number || 0));

            if (project?.type === 'micro_drama') {
                const realEpisodes = eps.filter((e: any) => e.synopsis !== "Initial setup");
                const finalEpisodes = realEpisodes.length > 0 ? realEpisodes : eps;
                setEpisodes(finalEpisodes);
            } else {
                // Movie / Ad — use the first (only) episode with full data
                const mainReelId = project?.default_episode_id || "main";
                const targetEp = eps.find((e: any) => e.id === mainReelId) || eps[0];
                if (targetEp) {
                    setEpisodes([targetEp]);
                } else {
                    setEpisodes([{ id: mainReelId, title: "Main Picture Reel", episode_number: 1 }]);
                }
            }
        } catch (e) {
            console.error("Refresh Episodes Error", e);
        }
    };

    const handleNewEpisode = () => {
        setScriptMode('new');
        setScriptTargetEpId("");
        setIsScriptModalOpen(true);
    };

    const handleEditEpisode = (epId: string) => {
        setScriptMode('edit');
        setScriptTargetEpId(epId);
        setIsScriptModalOpen(true);
    };

    const handleScriptSuccess = async () => {
        setIsScriptModalOpen(false);
        toast.success("Script Protocol Complete", { icon: "✨" });

        // Refresh Data
        await loadEpisodes();
        if (activeEpisodeId) await loadScenes(activeEpisodeId);
    };

    const handleUpdateProject = (updatedProject: Project) => {
        setProject(updatedProject);
    };

    // REGENERATE SCENES
    const handleRegenerateScenes = async () => {
        const activeEp = episodes.find(e => e.id === activeEpisodeId);
        if (!activeEp?.script_preview) {
            toastError("No script found for this episode. Use the Script button to add one first.");
            return;
        }

        setIsRegenerating(true);
        try {
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("script_title", activeEp.title || project?.title || "Untitled");
            formData.append("episode_id", activeEpisodeId);
            if (activeEp.runtime) formData.append("runtime", String(activeEp.runtime));

            // Re-send the existing script as a text file
            const blob = new Blob([activeEp.script_preview], { type: "text/plain" });
            formData.append("file", new File([blob], "regenerate.txt"));

            const res = await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const jobId = res.data.job_id;
            toastSuccess("Regenerating scenes...");

            // Poll for completion
            const pollInterval = setInterval(async () => {
                try {
                    const job = await checkJobStatus(jobId);

                    if (job.status === "completed") {
                        clearInterval(pollInterval);
                        toastSuccess("Scenes regenerated successfully!");
                        // Reload scenes and assets
                        await loadScenes(activeEpisodeId);
                        await initializeStudio();
                        setIsRegenerating(false);
                    } else if (job.status === "failed") {
                        clearInterval(pollInterval);
                        toastError(job.error || "Regeneration failed");
                        setIsRegenerating(false);
                    }
                } catch (e) {
                    clearInterval(pollInterval);
                    toastError("Failed to check regeneration status");
                    setIsRegenerating(false);
                }
            }, 1500);
        } catch (e: any) {
            console.error("Regenerate Error:", e);
            toastError(e.response?.data?.detail || "Failed to start regeneration");
            setIsRegenerating(false);
        }
    };

    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center gap-4 text-red-600">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-xs tracking-widest text-neutral-600">Loading Studio...</span>
            </div>
        );
    }

    return (
        <StudioLayout>
            {/* HEADER */}
            <StudioHeader
                projectId={projectId}
                projectTitle={project.title}
                activeEpisodeId={activeEpisodeId}
                onOpenAssets={() => setIsAssetModalOpen(true)}
                onManualAdd={handleManualAdd}
                onAutoExtend={handleAutoExtend}
                isExtending={isExtending}
                onEditScript={() => handleEditEpisode(activeEpisodeId)}
                onRegenerateScenes={handleRegenerateScenes}
                isRegenerating={isRegenerating}
            />

            {/* MAIN CONTENT ROW */}
            <div className="flex-1 flex overflow-hidden relative z-40">

                {/* SIDEBAR */}
                <ReelSidebar
                    episodes={episodes}
                    activeEpisodeId={activeEpisodeId}
                    onSelectEpisode={setActiveEpisodeId}
                    onNewEpisode={handleNewEpisode}
                    onEditEpisode={handleEditEpisode}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    projectType={project.type}
                    metadata={{
                        sceneCount: stats.sceneCount,
                        assetCount: stats.assetCount,
                        format: stats.format
                    }}
                />

                {/* SCENE BIN */}
                <SceneBin
                    scenes={scenes}
                    activeReelTitle={activeReelTitle}
                    projectId={projectId}
                    projectAssets={assets}
                    projectType={project.type as 'movie' | 'ad' | 'music_video'}
                    onOpenStoryboard={setSelectedScene}
                    onReorder={handleSceneReorder}
                    onEditScene={setEditingScene}
                    onDeleteScene={handleDeleteScene}
                    onManualAdd={handleManualAdd}
                    onAutoExtend={handleAutoExtend}
                    isExtending={isExtending}
                    episodeId={activeEpisodeId}
                    editingScene={editingScene}
                    onCloseEdit={() => setEditingScene(null)}
                    availableCharacters={characters}
                    availableLocations={locations}
                    availableProducts={products}
                    episodes={episodes}
                    isProcessing={isProcessing}
                    onUpdateScene={handleUpdateScene}
                    onUpdateCast={handleUpdateCast}
                    onRewrite={handleRewrite}
                    onFetchRemoteScenes={fetchRemoteScenes}
                    // Setup Edit Script Action
                    onEditScript={() => handleEditEpisode(activeEpisodeId)}
                    onOpenAssets={() => setIsAssetModalOpen(true)}
                />
            </div>

            {/* MODALS */}

            <ScriptIngestionModal
                isOpen={isScriptModalOpen}
                onClose={() => setIsScriptModalOpen(false)}
                projectId={projectId}
                projectTitle={project.title}
                projectType={project.type as any}
                mode={scriptMode}
                episodeId={scriptTargetEpId}
                episodes={episodes} // Pass all episodes for dropdown
                onSwitchEpisode={(id) => {
                    if (id === 'new') handleNewEpisode();
                    else handleEditEpisode(id);
                }}
                initialTitle={episodes.find(e => e.id === scriptTargetEpId)?.title}
                initialScript={episodes.find(e => e.id === scriptTargetEpId)?.script_preview}
                initialRuntime={episodes.find(e => e.id === scriptTargetEpId)?.runtime}
                previousEpisode={
                    scriptMode === 'new' && episodes.length > 0
                        ? (() => {
                            const lastEp = episodes[episodes.length - 1];
                            return lastEp ? {
                                id: lastEp.id,
                                episode_number: lastEp.episode_number,
                                title: lastEp.title || `Episode ${lastEp.episode_number}`,
                                script_preview: lastEp.script_preview || ""
                            } : null;
                        })()
                        : null
                }
                onSuccess={handleScriptSuccess}
                contextReferences={selectedContext}
                onOpenContextModal={() => setIsContextModalOpen(true)}
            />

            <AssetManagerModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                projectId={projectId}
                project={project}
                onAssetsUpdated={async () => {
                    // Refresh lightweight asset lists used by DirectorConsole
                    try {
                        const { fetchProjectAssets } = await import('@/lib/api');
                        const assetsData = await fetchProjectAssets(projectId);
                        setAssets({
                            characters: (assetsData.characters || []).map((c: any) => ({ ...c, type: 'character' })),
                            locations: (assetsData.locations || []).map((l: any) => ({ ...l, type: 'location' })),
                            products: (assetsData.products || []).map((p: any) => ({ ...p, type: 'product' })),
                        });
                    } catch (e) { console.error('Failed to refresh assets', e); }
                }}
            />

            <ContextSelectorModal
                isOpen={isContextModalOpen}
                onClose={() => setIsContextModalOpen(false)}
                episodes={episodes}
                onFetchScenes={fetchRemoteScenes}
                initialSelection={selectedContext}
                onConfirm={(newSelection) => setSelectedContext(newSelection)}
            />

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onUpdate={handleUpdateProject}
            />

            {selectedScene && (
                <SceneStoryboardContainer
                    isOpen={!!selectedScene}
                    onClose={() => setSelectedScene(null)}
                    projectId={projectId}
                    episodeId={activeEpisodeId || "main"}
                    scene={selectedScene}
                    projectAssets={assets}
                    seriesTitle={project.title}
                    credits={credits}
                />
            )}

            <TourOverlay step={tourStep} steps={STUDIO_TOUR_STEPS} onNext={tourNext} onComplete={tourComplete} />

        </StudioLayout>
    );
}