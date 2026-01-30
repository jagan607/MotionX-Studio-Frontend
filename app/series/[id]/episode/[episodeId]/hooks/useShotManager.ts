// import { useState, useEffect, useRef } from "react";
// import { collection, onSnapshot, doc, setDoc, writeBatch, deleteDoc, getDoc } from "firebase/firestore";
// import { ref, deleteObject, getStorage } from "firebase/storage";
// import { db, auth, storage } from "@/lib/firebase";
// import { API_BASE_URL } from "@/lib/config";
// import { toastError, toastSuccess } from "@/lib/toast";
// import { arrayMove } from "@dnd-kit/sortable";

// export const useShotManager = (seriesId: string, episodeId: string, activeSceneId: string | null, onLowCredits?: () => void) => {
//     const [shots, setShots] = useState<any[]>([]);
//     const [loadingShots, setLoadingShots] = useState<Set<string>>(new Set());

//     // Process States
//     const [isAutoDirecting, setIsAutoDirecting] = useState(false);
//     const [isGeneratingAll, setIsGeneratingAll] = useState(false);
//     const [isStopping, setIsStopping] = useState(false);

//     const [terminalLog, setTerminalLog] = useState<string[]>([]);
//     const [aspectRatio, setAspectRatio] = useState("9:16");

//     // Cancellation Ref
//     const cancelGenerationRef = useRef(false);

//     // State Ref to fix Stale Closures during batch generation
//     const shotsRef = useRef<any[]>([]);
//     useEffect(() => {
//         shotsRef.current = shots;
//     }, [shots]);

//     // --- REAL-TIME LISTENER (SORTED BY ORDER) ---
//     useEffect(() => {
//         if (!activeSceneId) return;
//         const q = collection(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots");
//         const unsubscribe = onSnapshot(q, (snapshot) => {
//             const shotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

//             shotData.sort((a: any, b: any) => {
//                 const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
//                 const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
//                 if (orderA !== orderB) return orderA - orderB;
//                 const timeA = new Date(a.created_at || 0).getTime();
//                 const timeB = new Date(b.created_at || 0).getTime();
//                 return timeA - timeB;
//             });

//             setShots(shotData);
//         });
//         return () => unsubscribe();
//     }, [activeSceneId, seriesId, episodeId]);

//     const addLoadingShot = (id: string) => setLoadingShots(prev => new Set(prev).add(id));
//     const removeLoadingShot = (id: string) => setLoadingShots(prev => { const next = new Set(prev); next.delete(id); return next; });

//     // --- CRUD: ADD SHOT ---
//     const handleAddShot = async (currentScene: any) => {
//         if (!activeSceneId) return;

//         let maxId = 0;
//         shots.forEach(s => {
//             try {
//                 const parts = s.id.split('_');
//                 if (parts.length > 1) {
//                     const num = parseInt(parts[1], 10);
//                     if (!isNaN(num) && num > maxId) maxId = num;
//                 }
//             } catch (e) { }
//         });
//         const newShotId = `shot_${String(maxId + 1).padStart(2, '0')}`;

//         const currentMaxOrder = shots.length > 0 ? Math.max(...shots.map(s => s.order || 0)) : -1;
//         const fallbackAction = currentScene?.description || currentScene?.visual_action || "";
//         const fallbackLoc = currentScene?.location_name || currentScene?.location || "";

//         await setDoc(doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", newShotId), {
//             shot_type: "Wide Shot",
//             visual_action: fallbackAction,
//             video_prompt: "",
//             characters: [],
//             location: fallbackLoc,
//             status: "draft",
//             order: currentMaxOrder + 1,
//             created_at: new Date().toISOString()
//         });
//     };

//     const updateShot = async (shotId: string, field: string, value: any) => {
//         if (!activeSceneId) return;
//         const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", shotId);
//         await setDoc(ref, { [field]: value }, { merge: true });
//     };

//     const handleDeleteShot = async (shotId: string) => {
//         if (!activeSceneId) return;
//         const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", shotId);
//         await deleteDoc(ref);
//     };

//     const handleDragEnd = async (event: any) => {
//         if (!activeSceneId) return;
//         const { active, over } = event;
//         if (!over || active.id === over.id) return;

//         const oldIndex = shots.findIndex((s) => s.id === active.id);
//         const newIndex = shots.findIndex((s) => s.id === over.id);

//         const newShots = arrayMove(shots, oldIndex, newIndex);
//         setShots(newShots);

//         try {
//             const batch = writeBatch(db);
//             newShots.forEach((shot, index) => {
//                 if (shot.order !== index) {
//                     const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", shot.id);
//                     batch.update(ref, { order: index });
//                 }
//             });
//             await batch.commit();
//         } catch (error) {
//             console.error("Failed to reorder shots:", error);
//             toastError("Failed to save new order");
//         }
//     };

//     // --- WIPE LOGIC ---
//     const wipeShotImagesOnly = async () => {
//         if (!activeSceneId || shots.length === 0) return;
//         const shotsWithMedia = shots.filter(s => s.image_url || s.video_url);
//         if (shotsWithMedia.length === 0) return;

//         setTerminalLog(["> CLEARING EXISTING MEDIA..."]);
//         try {
//             const storagePromises: Promise<void>[] = [];
//             const batch = writeBatch(db);

//             shotsWithMedia.forEach((shot) => {
//                 if (shot.image_url) {
//                     try { storagePromises.push(deleteObject(ref(storage, shot.image_url)).catch(e => console.warn(e))); } catch (e) { }
//                 }
//                 if (shot.video_url) {
//                     try { storagePromises.push(deleteObject(ref(storage, shot.video_url)).catch(e => console.warn(e))); } catch (e) { }
//                 }
//                 const shotRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", shot.id);
//                 batch.update(shotRef, { image_url: null, video_url: null, status: "draft" });
//             });

//             await Promise.all(storagePromises);
//             await batch.commit();
//             setTerminalLog(prev => [...prev, "> MEDIA CLEARED."]);
//         } catch (error) {
//             console.error(error);
//             toastError("Failed to clear media");
//         }
//     };

//     const wipeSceneData = async () => {
//         if (!activeSceneId || shots.length === 0) return;
//         setIsAutoDirecting(true);
//         setTerminalLog(["> CLEANING UP OLD ASSETS..."]);

//         try {
//             const storagePromises: Promise<void>[] = [];
//             shots.forEach((shot) => {
//                 if (shot.image_url) try { storagePromises.push(deleteObject(ref(storage, shot.image_url)).catch(e => console.warn(e))); } catch (e) { }
//                 if (shot.video_url) try { storagePromises.push(deleteObject(ref(storage, shot.video_url)).catch(e => console.warn(e))); } catch (e) { }
//             });

//             await Promise.all(storagePromises);
//             const batch = writeBatch(db);
//             shots.forEach((shot) => {
//                 const shotRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", shot.id);
//                 batch.delete(shotRef);
//             });
//             await batch.commit();
//             setShots([]);
//             setTerminalLog(prev => [...prev, "> DATABASE RESET."]);
//         } catch (error) {
//             console.error(error);
//             toastError("Failed to clean up");
//         } finally {
//             setIsAutoDirecting(false);
//         }
//     };

//     // --- AI: AUTO DIRECT ---
//     const handleAutoDirect = async (currentScene: any, overrideSummary?: string) => {
//         if (!activeSceneId) return;
//         setIsAutoDirecting(true);
//         setTerminalLog(["> INITIALIZING AI DIRECTOR..."]);

//         const sceneAction = overrideSummary || currentScene.description || currentScene.summary || "";
//         const sceneLocation = currentScene.header || currentScene.location_id || "Unknown";
//         let sceneChars = Array.isArray(currentScene.characters) ? currentScene.characters.join(", ") : (currentScene.characters || "None");

//         const formData = new FormData();
//         formData.append("series_id", seriesId);
//         formData.append("episode_id", episodeId);
//         formData.append("scene_id", activeSceneId);
//         formData.append("scene_action", sceneAction);
//         formData.append("characters", sceneChars);
//         formData.append("location", sceneLocation);

//         try {
//             const idToken = await auth.currentUser?.getIdToken();
//             const res = await fetch(`${API_BASE_URL}/api/v1/shot/suggest_shots`, {
//                 method: "POST",
//                 headers: { "Authorization": `Bearer ${idToken}` },
//                 body: formData
//             });

//             const data = await res.json();
//             if (res.ok && data.shots) {
//                 setTerminalLog(prev => [...prev, "> GENERATING SHOT LIST..."]);
//                 const batch = writeBatch(db);

//                 data.shots.forEach((shot: any, index: number) => {
//                     const newShotId = `shot_${String(index + 1).padStart(2, '0')}`;
//                     const docRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", newShotId);

//                     let charArray: string[] = [];
//                     if (typeof shot.characters === 'string') {
//                         charArray = shot.characters.split(',').map((c: string) => c.trim()).filter((c: string) => c !== "");
//                     } else if (Array.isArray(shot.characters)) {
//                         charArray = shot.characters;
//                     }

//                     const payload = {
//                         id: newShotId,
//                         shot_type: shot.shot_type,
//                         visual_action: shot.image_prompt || shot.description || "",
//                         video_prompt: shot.video_prompt || "",
//                         characters: charArray,
//                         location: sceneLocation,
//                         status: "draft",
//                         order: index
//                     };
//                     batch.set(docRef, payload);
//                 });

//                 await batch.commit();
//             }
//         } catch (e) {
//             console.error(e);
//         } finally {
//             setIsAutoDirecting(false);
//         }
//     };

//     // --- RENDER & ANIMATE ---
//     const stopGeneration = () => {
//         cancelGenerationRef.current = true;
//         setIsStopping(true);
//     };

//     const handleGenerateAll = async (currentScene: any) => {
//         if (!shots || shots.length === 0) return;
//         setIsGeneratingAll(true);
//         setIsStopping(false);
//         cancelGenerationRef.current = false;

//         const shotIds = shots.map(s => s.id);

//         for (const shotId of shotIds) {
//             if (cancelGenerationRef.current) {
//                 break;
//             }
//             const currentShot = shotsRef.current.find(s => s.id === shotId);
//             if (currentShot) {
//                 // Default to seedream for batch generation or whatever default you prefer
//                 await handleRenderShot(currentShot, currentScene, null, 'gemini');
//                 await new Promise(r => setTimeout(r, 1000));
//             }
//         }
//         setIsGeneratingAll(false);
//         setIsStopping(false);
//         cancelGenerationRef.current = false;
//     };

//     // --- UPDATED: HANDLE RENDER SHOT WITH PROVIDER ---
//     const handleRenderShot = async (
//         shot: any,
//         currentScene: any,
//         referenceFile?: File | null,
//         imageProvider: string = 'gemini' // <--- Added Parameter
//     ) => {
//         addLoadingShot(shot.id);

//         let style = "";
//         try {
//             const seriesRef = doc(db, "series", seriesId);
//             const seriesSnap = await getDoc(seriesRef);
//             if (seriesSnap.exists()) {
//                 style = seriesSnap.data().style || "";
//             }
//         } catch (error) {
//             console.error("Error fetching style:", error);
//         }

//         const formData = new FormData();
//         formData.append("series_id", seriesId);
//         formData.append("episode_id", episodeId);
//         formData.append("scene_id", activeSceneId!);
//         formData.append("shot_id", shot.id);
//         formData.append("shot_prompt", (shot.visual_action + " " + style).trim());
//         formData.append("shot_type", shot.shot_type || "Wide Shot");
//         formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : "");
//         formData.append("location", shot.location || "");
//         formData.append("aspect_ratio", aspectRatio);
//         formData.append("image_provider", imageProvider); // <--- Pass Provider to Backend

//         if (referenceFile) {
//             formData.append("reference_image", referenceFile);
//         }

//         try {
//             const idToken = await auth.currentUser?.getIdToken();

//             const response = await fetch(`${API_BASE_URL}/api/v1/shot/generate_shot`, {
//                 method: "POST",
//                 headers: { "Authorization": `Bearer ${idToken}` },
//                 body: formData
//             });

//             if (!response.ok) {
//                 if (response.status === 402) {
//                     if (onLowCredits) onLowCredits();
//                     return;
//                 }
//                 const errorData = await response.json();
//                 throw new Error(errorData.detail || "Failed to render shot");
//             }

//         } catch (e: any) {
//             console.error("Render error:", e);
//             toastError(e.message);
//         } finally {
//             removeLoadingShot(shot.id);
//         }
//     };

//     const handleFinalizeShot = async (shot: any) => {
//         if (!shot.image_url) return toastError("No image to finalize");

//         addLoadingShot(shot.id);

//         try {
//             const idToken = await auth.currentUser?.getIdToken();
//             const formData = new FormData();

//             formData.append("series_id", seriesId);
//             formData.append("episode_id", episodeId);
//             formData.append("scene_id", activeSceneId!);
//             formData.append("shot_id", shot.id);
//             formData.append("image_url", shot.image_url);

//             const res = await fetch(`${API_BASE_URL}/api/v1/shot/finalize_shot`, {
//                 method: "POST",
//                 headers: { "Authorization": `Bearer ${idToken}` },
//                 body: formData
//             });

//             const data = await res.json();

//             if (data.status === "success") {
//                 toastSuccess("Shot Finalized & Polished");
//             } else {
//                 throw new Error(data.detail || "Finalization failed");
//             }

//         } catch (e: any) {
//             console.error(e);
//             toastError(e.message || "Failed to finalize shot");
//         } finally {
//             removeLoadingShot(shot.id);
//         }
//     };

//     // UPDATE: Accept 'endFrameUrl' as a function argument
//     const handleAnimateShot = async (shot: any, provider: string = 'kling', endFrameUrl?: string | null) => {
//         if (!shot.image_url) return toastError("Generate image first");

//         try {
//             const idToken = await auth.currentUser?.getIdToken();
//             const formData = new FormData();
//             formData.append("series_id", seriesId);
//             formData.append("episode_id", episodeId);
//             formData.append("scene_id", activeSceneId!);
//             formData.append("shot_id", shot.id);
//             formData.append("image_url", shot.image_url);
//             formData.append("prompt", shot.video_prompt || shot.visual_action || "Cinematic movement");
//             formData.append("provider", provider);

//             if (endFrameUrl) {
//                 formData.append("end_frame_url", endFrameUrl);
//             }

//             await fetch(`${API_BASE_URL}/api/v1/shot/animate_shot`, {
//                 method: "POST",
//                 headers: { "Authorization": `Bearer ${idToken}` },
//                 body: formData
//             });

//         } catch (e) {
//             console.error(e);
//             toastError("Animation failed");
//         }
//     };

//     // --- NEW: VOICE GENERATION (ElevenLabs) ---
//     // Added emotion parameter to match frontend update
//     const handleGenerateVoiceover = async (text: string, voiceId: string, emotion: string): Promise<string | null> => {
//         try {
//             const idToken = await auth.currentUser?.getIdToken();
//             const formData = new FormData();
//             formData.append("text", text);
//             formData.append("voice_id", voiceId);
//             formData.append("emotion", emotion); // <--- Pass emotion

//             const res = await fetch(`${API_BASE_URL}/api/v1/shot/generate_voiceover`, {
//                 method: "POST",
//                 headers: { "Authorization": `Bearer ${idToken}` },
//                 body: formData
//             });

//             if (!res.ok) throw new Error("Voice generation failed");
//             const data = await res.json();
//             return data.audio_url;
//         } catch (e) {
//             console.error(e);
//             toastError("Failed to generate voice");
//             return null;
//         }
//     };

//     // --- NEW: LIP SYNC (Sync Labs) ---
//     const handleLipSyncShot = async (shot: any, audioUrl: string | null, audioFile: File | null) => {
//         if (!shot.video_url) return toastError("No video available to sync");

//         if (!activeSceneId) return;

//         const shotRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", shot.id);
//         await setDoc(shotRef, { video_status: "processing" }, { merge: true });

//         try {
//             const idToken = await auth.currentUser?.getIdToken();
//             const formData = new FormData();
//             formData.append("series_id", seriesId);
//             formData.append("episode_id", episodeId);
//             formData.append("scene_id", activeSceneId);
//             formData.append("shot_id", shot.id);
//             formData.append("video_url", shot.video_url);

//             if (audioUrl) formData.append("audio_url", audioUrl);
//             if (audioFile) formData.append("audio_file", audioFile);

//             const res = await fetch(`${API_BASE_URL}/api/v1/shot/lipsync_shot`, {
//                 method: "POST",
//                 headers: { "Authorization": `Bearer ${idToken}` },
//                 body: formData
//             });

//             if (!res.ok) {
//                 const err = await res.json();
//                 throw new Error(err.detail || "Lip Sync failed");
//             }

//             toastSuccess("Lip Sync Queued (Approx 2-5 mins)");

//         } catch (e: any) {
//             console.error(e);
//             toastError(e.message);
//             await setDoc(shotRef, { video_status: "ready" }, { merge: true });
//         }
//     };

//     return {
//         shots, loadingShots, terminalLog, aspectRatio, setAspectRatio,
//         isAutoDirecting, isGeneratingAll, isStopping,
//         handleAddShot, updateShot, handleDeleteShot, handleDragEnd,
//         handleAutoDirect, handleRenderShot, handleAnimateShot,
//         handleGenerateAll, stopGeneration, wipeSceneData, wipeShotImagesOnly,
//         handleFinalizeShot, handleGenerateVoiceover, handleLipSyncShot
//     };
// };