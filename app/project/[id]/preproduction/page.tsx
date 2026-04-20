"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, onSnapshot, collection, query, getDocs, updateDoc, setDoc, deleteDoc, serverTimestamp, orderBy, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    fetchEpisodes, fetchProjectAssets, updateAsset, deleteAsset, triggerAssetGeneration,
    api, checkJobStatus, fetchEpisodeScript,
} from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { v4 as uuidv4 } from 'uuid';
import { Project, Scene, CharacterProfile, LocationProfile, ProductProfile } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { PreProductionHeader } from "./components/PreProductionHeader";
import { AssetManagerModal } from "@/app/components/studio/AssetManagerModal";
import { ScriptIngestionModal } from "@/app/components/studio/ScriptIngestionModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { toast } from "react-hot-toast";
import { AssetModal } from "@/components/AssetModal";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { PREPRODUCTION_TOUR_STEPS } from "@/lib/tourConfigs";
import { useTour } from "@/hooks/useTour";

import { CanvasEngine, CanvasTransform, CanvasJumpTo } from "./components/CanvasEngine";
import { CanvasNode, NodePosition, NodeType } from "./components/CanvasNode";
import { WireLayer } from "./components/ConnectionWire";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { CanvasCommandBar } from "./components/CanvasCommandBar";
import { CanvasMinimap } from "./components/CanvasMinimap";
import { SceneNavigator } from "./components/SceneNavigator";
import { Lightbox } from "./components/Lightbox";
import { ScriptSection } from "./components/ScriptSection";

import { Phase3Skeleton } from "./components/Phase3Skeleton";
import { DirectorConsole } from "@/app/components/script/DirectorConsole";
import { ContextSelectorModal, ContextReference } from "@/app/components/script/ContextSelectorModal";
import { SceneData } from "@/components/studio/SceneCard";
import { ProjectSettingsModal } from "@/app/components/studio/ProjectSettingsModal";

// ─── TYPES ───────────────────────────────────────────────────

interface CanvasNodeData {
    id: string;
    nodeType: NodeType;
    position: NodePosition;
    title: string;
    subtitle?: string;
    imageUrl?: string | null;
    sceneNumber?: number;
    badges?: string[];
    /** Raw data reference for modals */
    raw: any;
    isGenerating?: boolean;
}

// ─── NODE DIMENSION CONSTANTS ────────────────────────────────
const NODE_W: Record<NodeType, number> = { scene: 340, character: 160, location: 260, moodboard: 240, product: 150 };
const NODE_H_EST: Record<NodeType, number> = { scene: 300, character: 300, location: 170, moodboard: 220, product: 200 };

// Section label type for canvas labels
interface SectionLabel {
    id: string;
    text: string;
    position: { x: number; y: number };
}

// ─── SCENE-CENTRIC CLUSTER LAYOUT ────────────────────────────
// Each scene sits at the center of a cluster.
// Its characters orbit above, location(s) to the right.
// Characters are DUPLICATED per scene.

function autoLayoutNodes(
    scenes: Scene[],
    characters: CharacterProfile[],
    locations: LocationProfile[],
    products: ProductProfile[],
    moodboard: any,
    project?: any
): { nodes: CanvasNodeData[]; sectionLabels: SectionLabel[] } {
    const nodes: CanvasNodeData[] = [];
    const sectionLabels: SectionLabel[] = [];
    const sorted = [...scenes].sort((a, b) => a.scene_number - b.scene_number);

    const CLUSTER_W = 1100;
    const WAVE_AMP = 120;
    const GRID_X0 = 100;
    const GRID_Y0 = 200;

    const charMap = new Map(characters.map(c => [c.id, c]));
    const charByName = new Map(characters.map(c => [c.name, c]));
    const locMap = new Map(locations.map(l => [l.id, l]));

    sorted.forEach((scene, idx) => {
        const clusterX = GRID_X0 + idx * CLUSTER_W;
        const clusterY = GRID_Y0 + (idx % 2 === 0 ? 0 : WAVE_AMP);

        sectionLabels.push({
            id: `label-scene-${idx}`,
            text: `SCENE ${String(scene.scene_number).padStart(2, "0")}`,
            position: { x: clusterX, y: clusterY },
        });

        // Characters (top of cluster)
        const sceneChars = (scene.characters || []).map(ref => charMap.get(ref) || charByName.get(ref)).filter(Boolean) as CharacterProfile[];
        sceneChars.forEach((char, ci) => {
            nodes.push({
                id: `char-${scene.id}-${char.id}`,
                nodeType: "character",
                position: { x: clusterX + ci * (NODE_W.character + 30), y: clusterY + 30 },
                title: char.name,
                subtitle: char.visual_traits?.vibe || "",
                imageUrl: char.image_url,
                badges: [],
                raw: char,
            });
        });

        // Scene card (below characters with gap)
        const sceneX = clusterX + 50;
        const sceneY = clusterY + NODE_H_EST.character + 80;
        nodes.push({
            id: `scene-${scene.id}`,
            nodeType: "scene",
            position: { x: sceneX, y: sceneY },
            title: scene.header || `Scene ${scene.scene_number}`,
            subtitle: scene.summary?.slice(0, 140) || (scene as any).synopsis?.slice(0, 140) || "",
            sceneNumber: scene.scene_number,
            badges: (scene.characters || []).slice(0, 3),
            raw: scene,
        });

        // Locations (right of scene)
        const sceneLocs: LocationProfile[] = [];
        if (scene.location_id && locMap.has(scene.location_id)) {
            sceneLocs.push(locMap.get(scene.location_id)!);
        } else {
            // Fallback: fuzzy match only if no explicit location_id
            for (const loc of locations) {
                if (scene.header && loc.name &&
                    scene.header.toLowerCase().includes(loc.name.toLowerCase())) {
                    sceneLocs.push(loc);
                    break; // At most one fuzzy match
                }
            }
        }
        sceneLocs.forEach((loc, li) => {
            nodes.push({
                id: `loc-${scene.id}-${loc.id}`,
                nodeType: "location",
                position: { x: sceneX + NODE_W.scene + 80, y: sceneY + li * (NODE_H_EST.location + 30) },
                title: loc.name,
                subtitle: loc.visual_traits?.atmosphere || "",
                imageUrl: loc.image_url,
                badges: [loc.visual_traits?.lighting].filter(Boolean) as string[],
                raw: loc,
            });
        });
    });

    // Products/Props (below all clusters)
    const prodsY = GRID_Y0 + WAVE_AMP + NODE_H_EST.character + 80 + NODE_H_EST.scene + 200;
    if (products.length > 0) {
        sectionLabels.push({ id: "label-props", text: "PROPS & PRODUCTS", position: { x: GRID_X0, y: prodsY - 10 } });
    }
    products.forEach((prod, i) => {
        nodes.push({
            id: `prod-${prod.id}`,
            nodeType: "product",
            position: { x: GRID_X0 + i * (NODE_W.product + 40), y: prodsY + 30 },
            title: prod.name,
            subtitle: prod.category || "Item",
            imageUrl: prod.image_url,
            badges: [],
            raw: prod,
        });
    });

    // Moodboard (top-left)
    const moodImgUrl = project?.moodboard_image_url
        || (moodboard && typeof moodboard === 'object' && !Array.isArray(moodboard) ? moodboard.moodboard_image_url : null)
        || project?.style_ref_url || null;
    nodes.push({
        id: "moodboard",
        nodeType: "moodboard",
        position: { x: GRID_X0, y: GRID_Y0 - NODE_H_EST.moodboard - 40 },
        title: (moodboard && !Array.isArray(moodboard) ? moodboard.name : null) || "Visual Style",
        subtitle: (moodboard && !Array.isArray(moodboard) ? (moodboard.lighting || moodboard.code) : null) || "",
        imageUrl: moodImgUrl,
        raw: moodboard || {},
    });

    return { nodes, sectionLabels };
}

// ─── BUILD WIRES (within each cluster) ───────────────────────

import { WireData } from "./components/ConnectionWire";

function buildWires(nodes: CanvasNodeData[], scenes: Scene[]): WireData[] {
    const wires: WireData[] = [];

    for (const scene of scenes) {
        const sn = nodes.find(n => n.id === `scene-${scene.id}`);
        if (!sn) continue;

        const sCenterX = sn.position.x + NODE_W.scene / 2;
        const sTopY = sn.position.y;
        const sRightX = sn.position.x + NODE_W.scene;
        const sMidY = sn.position.y + NODE_H_EST.scene / 2;

        // ── Character wires (AMBER) — from char bottom to scene top ──
        for (const charRef of (scene.characters || [])) {
            const cn = nodes.find(n =>
                n.id.startsWith(`char-${scene.id}-`) &&
                (n.raw?.id === charRef || n.raw?.name === charRef)
            );
            if (cn) {
                wires.push({
                    x1: cn.position.x + NODE_W.character / 2,
                    y1: cn.position.y + NODE_H_EST.character,   // char bottom
                    x2: sCenterX,
                    y2: sTopY,                                   // scene top
                    color: "rgba(212, 168, 67, 0.45)",
                });
            }
        }

        // ── Location wires (BLUE) — from scene right to loc left ──
        const clusterLocs = nodes.filter(n =>
            n.id.startsWith(`loc-${scene.id}-`) && n.nodeType === "location"
        );
        for (const ln of clusterLocs) {
            wires.push({
                x1: sRightX,
                y1: sMidY,
                x2: ln.position.x,
                y2: ln.position.y + NODE_H_EST.location / 2,
                color: "rgba(74, 144, 226, 0.45)",
            });
        }
    }

    return wires;
}

// ─── PAGE COMPONENT ──────────────────────────────────────────

export default function PreProductionCanvas() {
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;

    // Data State
    const [project, setProject] = useState<Project | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [characters, setCharacters] = useState<CharacterProfile[]>([]);
    const [locations, setLocations] = useState<LocationProfile[]>([]);
    const [products, setProducts] = useState<ProductProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
    const [episodes, setEpisodes] = useState<any[]>([]);

    // Tour
    const { step: tourStep, nextStep: tourNext, completeTour: tourComplete } = useTour('preproduction_tour');

    // Canvas State
    const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
    const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
    const canvasJumpToRef = useRef<CanvasJumpTo | null>(null);
    const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

    // Modal State
    const [selectedAsset, setSelectedAsset] = useState<{ data: any; type: "character" | "location" | "product" } | null>(null);
    const [lightboxData, setLightboxData] = useState<{ url: string; title: string } | null>(null);
    const [genPrompt, setGenPrompt] = useState("");
    const [editingScene, setEditingScene] = useState<Scene | null>(null);
    const [editHeader, setEditHeader] = useState("");
    const [editSummary, setEditSummary] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Header Modal State
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

    // Scene Draft State
    const [isDraftApproved, setIsDraftApproved] = useState(false);

    // Extraction Error — show toast once per session
    const extractionErrorToastedRef = useRef(false);

    // Scene CRUD State
    const [isExtending, setIsExtending] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // DirectorConsole State
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedContext, setSelectedContext] = useState<ContextReference[]>([]);
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);

    // ─── LOCK BODY SCROLL ───
    useEffect(() => {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
        };
    }, []);

    // ─── LOAD DATA ───
    useEffect(() => {
        if (!projectId) return;
        const unsubs: (() => void)[] = [];

        async function load() {
            try {
                let pDocData: any = null;
                const pDocRef = doc(db, "projects", projectId);
                unsubs.push(onSnapshot(pDocRef, (snap) => {
                    if (snap.exists()) {
                        pDocData = snap.data();
                        setProject(pDocData as Project);
                    }
                }));

                if (!pDocData) {
                    const snap = await getDoc(pDocRef);
                    if (snap.exists()) pDocData = snap.data();
                }

                const epsData = await fetchEpisodes(projectId);
                let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
                setEpisodes(eps);
                let targetEpId = null;

                if (eps.length > 0) {
                    const defaultEp = eps.find((e: any) => e.id === pDocData.default_episode_id);
                    targetEpId = defaultEp ? defaultEp.id : eps[0].id;
                    setActiveEpisodeId(targetEpId);
                }

                // Fetch assets (always try — they may exist even if script_status isn't "ready" yet)
                if (targetEpId) {
                    await fetchAssets(targetEpId);
                }
            } catch (e) {
                console.error("Canvas Load Error", e);
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => unsubs.forEach(u => u());
    }, [projectId]);

    // ─── RE-FETCH WHEN SCRIPT_STATUS TRANSITIONS TO "ready" ───
    const prevScriptStatus = useRef<string | undefined>(undefined);
    useEffect(() => {
        const currentStatus = project?.script_status;
        if (prevScriptStatus.current !== "ready" && currentStatus === "ready" && activeEpisodeId) {
            fetchAssets(activeEpisodeId);
        }
        prevScriptStatus.current = currentStatus;
    }, [project?.script_status, activeEpisodeId]);

    // ─── EXTRACTION ERROR NOTIFICATION ───
    useEffect(() => {
        if (!project) return;
        const extractionError = (project as any).extraction_error;
        if (extractionError && !extractionErrorToastedRef.current) {
            extractionErrorToastedRef.current = true;
            toast("Character details couldn't be auto-extracted. You can fill them in manually in the Asset Manager.", {
                icon: "⚠️",
                duration: 8000,
            });
        }
    }, [project]);

    const fetchAssets = async (epId?: string | null) => {
        const targetEpId = epId || activeEpisodeId;
        if (!targetEpId) return;

        try {
            const scenesSnap = await getDocs(query(collection(db, `projects/${projectId}/episodes/${targetEpId}/scenes`)));
            const s: Scene[] = [];
            scenesSnap.forEach(doc => {
                const data = doc.data();
                s.push({
                    id: doc.id, ...data,
                    header: data.slugline || data.header || "UNKNOWN SCENE",
                    summary: data.synopsis || data.summary || "",
                } as Scene);
            });
            setScenes(s);

            const assetsData = await fetchProjectAssets(projectId);
            setCharacters((assetsData.characters || []).map((c: any) => ({ ...c, type: 'character' })));
            setLocations((assetsData.locations || []).map((l: any) => ({ ...l, type: 'location' })));
            setProducts((assetsData.products || []).map((p: any) => ({ ...p, type: 'product' })));
        } catch (e) {
            console.error(e);
        }
    };

    // ─── BUILD CANVAS NODES ───
    // Step 1: Expensive layout computation — only re-runs when data changes (NOT during drag)
    const { layoutNodes, sectionLabels: canvasSectionLabels } = useMemo(() => {
        if (!project) return { layoutNodes: [] as CanvasNodeData[], sectionLabels: [] as SectionLabel[] };
        const { nodes, sectionLabels: labels } = autoLayoutNodes(scenes, characters, locations, products, project.moodboard, project);
        return { layoutNodes: nodes, sectionLabels: labels };
    }, [scenes, characters, locations, products, project, generatingMap]);

    // Step 2: Cheap position merge — runs on drag but is O(n) with no layout recalculation
    const canvasNodes = useMemo(() => {
        return layoutNodes.map((n, i) => ({
            ...n,
            position: nodePositions[n.id] || n.position,
            isGenerating: generatingMap[n.raw?.id] || false,
            index: i,
        }));
    }, [layoutNodes, nodePositions, generatingMap]);

    const wires = useMemo(() => buildWires(canvasNodes, scenes), [canvasNodes, scenes]);

    // Extract moodboard data for theming
    const moodboardBgUrl = useMemo(() => {
        if (!project) return null;
        const mb = project.moodboard;
        return (project as any).moodboard_image_url
            || (mb && typeof mb === 'object' && !Array.isArray(mb) ? mb.moodboard_image_url : null)
            || (project as any).style_ref_url || null;
    }, [project]);

    // ─── NODE DRAG (cluster-aware: dragging a scene moves its connected nodes) ───
    const canvasNodesRef = useRef(canvasNodes);
    canvasNodesRef.current = canvasNodes;

    const handleNodeMove = useCallback((id: string, pos: NodePosition) => {
        setNodePositions(prev => {
            const next = { ...prev };

            // Look up old position from state, falling back to canvasNodes layout
            const getPos = (nodeId: string): NodePosition | undefined =>
                prev[nodeId] || canvasNodesRef.current.find(n => n.id === nodeId)?.position;

            // If dragging a scene node, move the whole cluster
            if (id.startsWith('scene-')) {
                const oldPos = getPos(id);
                if (!oldPos) { next[id] = pos; return next; }

                const sceneId = id.replace('scene-', '');
                const dx = pos.x - oldPos.x;
                const dy = pos.y - oldPos.y;

                // Move all cluster members by the same delta
                for (const node of canvasNodesRef.current) {
                    if (
                        node.id === id ||
                        node.id.startsWith(`char-${sceneId}-`) ||
                        node.id.startsWith(`loc-${sceneId}-`)
                    ) {
                        const curPos = getPos(node.id);
                        if (curPos) {
                            next[node.id] = {
                                x: curPos.x + dx,
                                y: curPos.y + dy,
                            };
                        }
                    }
                }
            } else {
                // Non-scene nodes move individually
                next[id] = pos;
            }
            return next;
        });
    }, []);

    // ─── ASSET ACTIONS ───
    const handleSaveAsset = async (type: string, assetId: string, data: any) => {
        try {
            await updateAsset(projectId, type, assetId, data);
            toast.success("Updated");
            fetchAssets();
            return { id: assetId, ...data };
        } catch (e: any) {
            toast.error("Save failed");
            throw e;
        }
    };

    const handleDeleteAsset = async (type: string, id: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        try {
            await deleteAsset(projectId, type, id);
            toast.success("Deleted");
            fetchAssets();
        } catch { toast.error("Delete failed"); }
    };

    const handleGenerateAsset = async (type: string, assetId: string, prompt: string, useRef: boolean = true) => {
        setGeneratingMap(prev => ({ ...prev, [assetId]: true }));
        try {
            const reqType = type === "character" ? "characters" : type === "location" ? "locations" : "products";
            const res = await triggerAssetGeneration(
                projectId, assetId, reqType, prompt,
                project?.moodboard || {},
                project?.aspect_ratio || "16:9",
                useRef
            );
            toast.success("Generating...");
            setTimeout(fetchAssets, 1500);
            return res.image_url;
        } catch { toast.error("Generation failed"); }
        finally { setGeneratingMap(prev => ({ ...prev, [assetId]: false })); }
    };

    // ─── NODE CLICK HANDLERS ───
    const handleNodeClick = (node: CanvasNodeData) => {
        if (node.nodeType === "scene") {
            const scene = node.raw as Scene;
            setEditingScene(scene);
            setEditHeader(scene.header || (scene as any).slugline || "");
            setEditSummary(scene.summary || (scene as any).synopsis || "");
        } else if (node.nodeType === "moodboard") {
            router.push(`/project/${projectId}/moodboard?episode_id=${activeEpisodeId || 'main'}`);
        } else {
            setSelectedAsset({
                data: node.raw,
                type: node.nodeType as "character" | "location" | "product"
            });
        }
    };

    const handleSaveScene = async () => {
        if (!editingScene || !activeEpisodeId) return;
        try {
            const sceneRef = doc(db, `projects/${projectId}/episodes/${activeEpisodeId}/scenes`, editingScene.id);
            await updateDoc(sceneRef, { slugline: editHeader, header: editHeader, synopsis: editSummary, summary: editSummary });
            toast.success("Scene updated");
            setEditingScene(null);
            fetchAssets();
        } catch (e) {
            toast.error("Failed to save scene");
        }
    };

    // ─── SCENE CRUD HANDLERS (ported from Studio) ───

    const handleManualAdd = async () => {
        if (!activeEpisodeId) return;
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
                header: "INT. UNTITLED SCENE - DAY",
                summary: "",
                cast_ids: [],
                characters: [],
                location: "",
                status: "draft",
                created_at: serverTimestamp()
            });

            toastSuccess("New Scene Created");
            await fetchAssets();
        } catch (e) {
            console.error("Manual Add Error:", e);
            toastError("Failed to create scene");
        }
    };

    const handleAutoExtend = async () => {
        if (!activeEpisodeId || scenes.length === 0) {
            toastError("Need at least one scene to extend from!");
            return;
        }

        setIsExtending(true);
        try {
            const sorted = [...scenes].sort((a, b) => a.scene_number - b.scene_number);
            const lastScene = sorted[sorted.length - 1];
            const payload = {
                project_id: projectId,
                episode_id: activeEpisodeId,
                previous_scene: {
                    location: lastScene.header,
                    time_of_day: (lastScene as any).time || "DAY",
                    visual_action: lastScene.summary,
                    characters: lastScene.characters || []
                }
            };

            const res = await api.post("/api/v1/script/extend-scene", payload);
            const generatedScene = res.data.scene;

            // Resolve location to existing asset
            let finalLocationName = generatedScene.location || "";
            let finalLocationId = "";
            if (finalLocationName) {
                const cleanName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
                const searchVal = cleanName(finalLocationName);
                const foundLoc = locations.find(loc => {
                    const lName = cleanName(loc.name || "");
                    const lId = cleanName(loc.id || "");
                    return lName.includes(searchVal) || searchVal.includes(lName) || lId === searchVal;
                });
                if (foundLoc) {
                    finalLocationName = foundLoc.name;
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
                header: generatedScene.slugline || "EXT. NEW SCENE - DAY",
                summary: generatedScene.visual_action || generatedScene.synopsis || "",
                time: generatedScene.time_of_day || "DAY",
                cast_ids: generatedScene.characters || [],
                characters: generatedScene.characters || [],
                location: finalLocationName,
                location_id: finalLocationId,
                products: generatedScene.products || [],
                status: "draft",
                created_at: serverTimestamp()
            });

            toastSuccess("Scene Auto-Extended!");
            await fetchAssets();
        } catch (e) {
            console.error("Auto Extend Error:", e);
            toastError("Failed to extend narrative");
        } finally {
            setIsExtending(false);
        }
    };

    const handleRegenerateScenes = async () => {
        if (!activeEpisodeId) return;
        setIsRegenerating(true);
        try {
            const { script_text } = await fetchEpisodeScript(projectId, activeEpisodeId);
            if (!script_text) {
                toastError("No script found. Use the Script button to add one first.");
                setIsRegenerating(false);
                return;
            }

            const activeEp = episodes.find((e: any) => e.id === activeEpisodeId);
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("script_title", activeEp?.title || project?.title || "Untitled");
            formData.append("episode_id", activeEpisodeId);
            if (activeEp?.runtime) formData.append("runtime_seconds", String(activeEp.runtime));

            const blob = new Blob([script_text], { type: "text/plain" });
            formData.append("file", new File([blob], "regenerate.txt"));

            const res = await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const jobId = res.data.job_id;
            toastSuccess("Regenerating scenes...");

            const pollInterval = setInterval(async () => {
                try {
                    const job = await checkJobStatus(jobId);
                    if (job.status === "completed") {
                        clearInterval(pollInterval);
                        toastSuccess("Scenes regenerated!");
                        await fetchAssets();
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

    const handleDeleteScene = (sceneId: string) => {
        setPendingDeleteId(sceneId);
    };

    const handleConfirmDelete = async () => {
        if (!pendingDeleteId || !activeEpisodeId) return;
        setIsDeleting(true);
        try {
            if (editingScene?.id === pendingDeleteId) setEditingScene(null);
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", pendingDeleteId);
            await deleteDoc(sceneRef);
            toastSuccess("Scene Deleted");
            await fetchAssets();
        } catch (e) {
            console.error("Delete Scene Error:", e);
            toastError("Failed to delete scene");
        } finally {
            setIsDeleting(false);
            setPendingDeleteId(null);
        }
    };

    // ─── DIRECTOR CONSOLE HANDLERS (ported from Studio) ───

    // Reset context when editing scene changes
    useEffect(() => {
        setSelectedContext([]);
    }, [editingScene?.id]);

    const handleUpdateScene = async (sceneId: string, updates: Partial<SceneData>) => {
        if (!activeEpisodeId) return;
        try {
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", sceneId);
            await updateDoc(sceneRef, updates);
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
            if (editingScene?.id === sceneId) {
                setEditingScene(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (e) {
            console.error("Update Scene Error:", e);
            toast.error("Failed to save changes");
        }
    };

    const handleUpdateCast = async (sceneId: string, newCast: string[]) => {
        if (!activeEpisodeId) return;
        try {
            const sceneRef = doc(db, "projects", projectId, "episodes", activeEpisodeId, "scenes", sceneId);
            await updateDoc(sceneRef, { cast_ids: newCast, characters: newCast });
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, cast_ids: newCast, characters: newCast } as any : s));
            if (editingScene?.id === sceneId) {
                setEditingScene(prev => prev ? { ...prev, cast_ids: newCast, characters: newCast } as any : null);
            }
        } catch (e) {
            console.error("Update Cast Error:", e);
            toast.error("Failed to update cast");
        }
    };

    const handleRewrite = async (sceneId: string, instruction: string, contextRefs?: ContextReference[]) => {
        if (!activeEpisodeId) return;
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
                characters: targetScene.characters || [],
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

    const handleExecuteAi = async (instruction: string) => {
        if (!editingScene || !instruction.trim()) return;
        await handleRewrite(editingScene.id, instruction, selectedContext);
    };

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

    const hasScript = (project ? (project.script_status !== "empty" && project.script_status !== "pending" && project.script_status !== undefined) : false) || scenes.length > 0;
    const isCommercial = project?.type === "ad";

    // Auto-approve if returning and we see assets exist
    useEffect(() => {
        if (!project) return;
        const hasMood = (project as any).moodboard_image_url || (project as any).style_ref_url;
        if (hasMood || characters.length > 0 || scenes.length > 0 || (isCommercial && products.length > 0)) {
            setIsDraftApproved(true);
        }
    }, [project, characters.length, scenes.length, products.length, isCommercial]);

    // Redirect to moodboard page if no visual direction is set
    // Skip for sample projects — they should open directly to the canvas
    const moodRedirected = useRef(false);
    useEffect(() => {
        if (!project || !hasScript || !isDraftApproved || moodRedirected.current) return;
        if ((project as any).is_sample) return; // Sample projects bypass moodboard gate
        const hasMood = (project as any).moodboard_image_url || (project as any).style_ref_url;
        if (!hasMood) {
            moodRedirected.current = true;
            router.push(`/project/${projectId}/moodboard?episode_id=${activeEpisodeId || 'main'}`);
        }
    }, [project, hasScript, isDraftApproved, projectId, activeEpisodeId, router]);

    // ─── LOADING STATE ───
    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#E50914]" />
                <span className="text-[10px] font-mono tracking-[4px] text-white/20 uppercase">Loading Canvas...</span>
            </div>
        );
    }


    // ─── RENDER ───
    return (
        <div ref={containerRef} className="fixed inset-0 bg-[#060606] text-white overflow-hidden flex flex-col">

            {/* ── Pre-Production Header ── */}
            <PreProductionHeader
                projectTitle={project.title}
                projectId={projectId}
                project={project}
                activeEpisodeId={activeEpisodeId || undefined}
                hasScript={hasScript}
                episodes={episodes}
                onOpenAssets={() => setIsAssetModalOpen(true)}
                onEditScript={() => setIsScriptModalOpen(true)}
                onOpenMoodboard={() => router.push(`/project/${projectId}/moodboard?episode_id=${activeEpisodeId || 'main'}`)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onSelectEpisode={(newEpId) => {
                    setActiveEpisodeId(newEpId);
                    setNodePositions({});
                    fetchAssets();
                }}
            />

            {/* ── MAIN CANVAS ── */}
            <div id="tour-preprod-canvas" className="relative flex-1 overflow-hidden" style={{ maxHeight: '100%' }}>


                {(!hasScript || (project?.script_status === "ready" && !isDraftApproved)) ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ScriptSection
                            project={project}
                            scenes={scenes}
                            activeEpisodeId={activeEpisodeId}
                            onUpdateProject={setProject}
                            onScenesUpdated={fetchAssets}
                            episodes={episodes}
                            onApproveDraft={() => setIsDraftApproved(true)}
                        />
                    </div>
                ) : (
                    project?.script_status === "extracting"
                    && characters.length === 0
                    && scenes.length === 0
                ) ? (
                    <Phase3Skeleton project={project} />
                ) : (
                    <>
                        {/* Canvas Engine */}
                        <CanvasEngine
                            onTransformChange={setCanvasTransform}
                            initialTransform={{ x: 20, y: -60, scale: 0.7 }}
                            backgroundImageUrl={moodboardBgUrl}
                            onReady={(jumpTo) => { canvasJumpToRef.current = jumpTo; }}
                        >
                            {canvasSectionLabels.map(label => (
                                <div key={label.id} className="absolute pointer-events-none"
                                    style={{ left: label.position.x, top: label.position.y }}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold tracking-[4px] uppercase text-white/15" style={{ fontFamily: "'Inter', sans-serif" }}>
                                            {label.text}
                                        </span>
                                        <div className="h-[1px] w-20 bg-white/[0.06]" />
                                    </div>
                                </div>
                            ))}
                            <WireLayer wires={wires} />
                            {canvasNodes.map((node, idx) => (
                                <CanvasNode
                                    key={node.id}
                                    id={node.id}
                                    type={node.nodeType}
                                    position={node.position}
                                    title={node.title}
                                    subtitle={node.subtitle}
                                    imageUrl={node.imageUrl}
                                    sceneNumber={node.sceneNumber}
                                    badges={node.badges}
                                    isGenerating={node.isGenerating}
                                    index={idx}
                                    isSelected={selectedNodeIds.has(node.id)}
                                    onEdit={() => {
                                        // Shift+click = toggle selection
                                        handleNodeClick(node);
                                    }}
                                    onPositionChange={(id, pos) => {
                                        // If this node is selected and part of batch, move all selected
                                        if (selectedNodeIds.has(id) && selectedNodeIds.size > 1) {
                                            const oldPos = canvasNodesRef.current.find(n => n.id === id)?.position;
                                            if (oldPos) {
                                                const dx = pos.x - (nodePositions[id]?.x ?? oldPos.x);
                                                const dy = pos.y - (nodePositions[id]?.y ?? oldPos.y);
                                                setNodePositions(prev => {
                                                    const next = { ...prev };
                                                    for (const selId of selectedNodeIds) {
                                                        const curNode = canvasNodesRef.current.find(n => n.id === selId);
                                                        const curPos = prev[selId] || curNode?.position;
                                                        if (curPos) {
                                                            next[selId] = { x: curPos.x + dx, y: curPos.y + dy };
                                                        }
                                                    }
                                                    return next;
                                                });
                                                return;
                                            }
                                        }
                                        handleNodeMove(id, pos);
                                    }}
                                    onImageClick={() => {
                                        if (node.imageUrl) setLightboxData({ url: node.imageUrl, title: node.title });
                                        else handleNodeClick(node);
                                    }}
                                    onGenerate={
                                        node.nodeType !== "scene" && node.nodeType !== "moodboard"
                                            ? () => {
                                                // Build a rich prompt from visual traits instead of generic "portrait of Name"
                                                const raw = node.raw;
                                                const type = node.nodeType;
                                                let prompt = '';
                                                if (type === 'character') {
                                                    const traits = raw.visual_traits || {};
                                                    const charType = raw.type || 'human';
                                                    const parts: string[] = [];
                                                    if (charType !== 'human') parts.push(`${charType} character`);
                                                    if (traits.age) parts.push(traits.age);
                                                    if (traits.ethnicity) parts.push(traits.ethnicity);
                                                    if (traits.build) parts.push(traits.build);
                                                    if (traits.hair) parts.push(traits.hair);
                                                    if (traits.clothing) parts.push(`wearing ${traits.clothing}`);
                                                    if (traits.distinguishing_features) parts.push(traits.distinguishing_features);
                                                    if (traits.vibe) parts.push(traits.vibe);
                                                    const traitStr = parts.filter(Boolean).join(', ');
                                                    prompt = `Cinematic portrait of ${node.title}${traitStr ? `, ${traitStr}` : ''}. Dramatic lighting, sharp focus, high quality, 8k, photorealistic.`;
                                                } else if (type === 'location') {
                                                    prompt = `Cinematic establishing shot of ${node.title}. High quality, 8k, photorealistic.`;
                                                } else {
                                                    prompt = `Product photography of ${node.title}. High quality, 8k, photorealistic.`;
                                                }
                                                handleGenerateAsset(type, raw.id, prompt);
                                            }
                                            : undefined
                                    }
                                    onDelete={
                                        node.nodeType === "scene"
                                            ? () => handleDeleteScene(node.raw.id)
                                            : node.nodeType !== "moodboard"
                                                ? () => handleDeleteAsset(node.nodeType, node.raw.id, node.title)
                                                : undefined
                                    }
                                />
                            ))}
                        </CanvasEngine>
                        <CanvasToolbar
                            id="tour-preprod-toolbar"
                            productLabel={isCommercial ? "Product" : "Prop"}
                            onAddScene={handleManualAdd}
                            onAddCharacter={() => setSelectedAsset({
                                data: { id: 'new', name: '', type: 'character', visual_traits: {}, created_at: new Date() },
                                type: "character"
                            })}
                            onAddLocation={() => setSelectedAsset({
                                data: { id: 'new', name: '', type: 'location', visual_traits: {}, created_at: new Date() },
                                type: "location"
                            })}
                            onAddProduct={() => setSelectedAsset({
                                data: { id: 'new', name: '', type: 'product', visual_traits: {}, created_at: new Date() },
                                type: "product"
                            })}
                            onOpenMoodboard={() => router.push(`/project/${projectId}/moodboard?episode_id=${activeEpisodeId || 'main'}`)}
                            onFitToView={() => canvasJumpToRef.current?.(0, 0)}
                        />
                        {/* ── FLOATING COMMAND BAR (Add Scene / Auto-Extend / Regenerate) ── */}
                        {scenes.length > 0 && (
                            <CanvasCommandBar
                                onAddScene={handleManualAdd}
                                onAutoExtend={handleAutoExtend}
                                onRegenerate={handleRegenerateScenes}
                                isExtending={isExtending}
                                isRegenerating={isRegenerating}
                            />
                        )}
                        <CanvasMinimap
                            id="tour-preprod-minimap"
                            nodes={canvasNodes.map(n => ({ id: n.id, type: n.nodeType, position: n.position }))}
                            transform={canvasTransform}
                            containerWidth={containerRef.current?.clientWidth || 1200}
                            containerHeight={containerRef.current?.clientHeight || 800}
                            onJumpTo={(x, y) => canvasJumpToRef.current?.(x, y)}
                        />
                        <SceneNavigator
                            id="tour-preprod-scene-nav"
                            scenes={scenes.map(s => {
                                const sceneNode = canvasNodes.find(n => n.id === `scene-${s.id}`);
                                return {
                                    id: s.id,
                                    sceneNumber: s.scene_number,
                                    title: s.header || `Scene ${s.scene_number}`,
                                    characterCount: (s.characters || []).length,
                                    locationCount: s.location_id ? 1 : 0,
                                    position: sceneNode?.position || { x: 0, y: 0 },
                                };
                            })}
                            onJumpToScene={(pos) => canvasJumpToRef.current?.(pos.x - 100, pos.y - 100)}
                        />
                    </>
                )}
            </div>

            {/* ── Tour Overlay ── */}
            <TourOverlay
                step={tourStep}
                steps={PREPRODUCTION_TOUR_STEPS}
                onNext={tourNext}
                onComplete={tourComplete}
            />

            {/* ── MODALS ── */}
            {selectedAsset && (
                <AssetModal
                    isOpen={!!selectedAsset}
                    onClose={() => setSelectedAsset(null)}
                    projectId={projectId}
                    assetId={selectedAsset.data.id}
                    assetName={selectedAsset.data.name}
                    assetType={selectedAsset.type}
                    currentData={selectedAsset.data}
                    mode="upload"
                    setMode={() => { }}
                    genPrompt={genPrompt}
                    setGenPrompt={setGenPrompt}
                    isProcessing={generatingMap[selectedAsset.data.id] || false}
                    genre={project.genre || ""}
                    style={project.moodboard?.lighting || ""}
                    onUpload={() => { }}
                    onUpdateTraits={(data) => handleSaveAsset(selectedAsset.type, selectedAsset.data.id, data)}
                    onGenerate={(prompt, useRef) => handleGenerateAsset(selectedAsset.type, selectedAsset.data.id, prompt, useRef)}
                    onLinkVoice={async (v) => {
                        if (selectedAsset.type === "character") {
                            await handleSaveAsset("character", selectedAsset.data.id, { voice_config: v });
                        }
                    }}
                />
            )}

            {lightboxData && (
                <Lightbox
                    imageUrl={lightboxData.url}
                    title={lightboxData.title}
                    onClose={() => setLightboxData(null)}
                />
            )}

            {/* ── DIRECTOR CONSOLE MODAL (centered, two-column) ── */}
            {editingScene && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div
                        className="relative w-full max-w-5xl bg-[#0C0C0C] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        style={{ maxHeight: 'calc(100vh - 80px)' }}
                    >
                        {/* Modal Header */}
                        <div className="px-6 pt-5 pb-3 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#0A0A0A]">
                            <div className="flex items-center gap-3">
                                <span className="text-[28px] font-['Anton'] text-white/[0.08]">
                                    {String(editingScene.scene_number).padStart(2, "0")}
                                </span>
                                <div>
                                    <span className="text-[9px] font-bold tracking-[3px] uppercase text-white/40">Scene {String(editingScene.scene_number).padStart(2, "0")}</span>
                                    {editingScene.header && (
                                        <div className="text-[10px] font-mono text-white/20 mt-0.5 truncate max-w-[400px]">{editingScene.header}</div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingScene(null)}
                                className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >✕</button>
                        </div>

                        {/* DirectorConsole (wide two-column layout) */}
                        <DirectorConsole
                            layout="wide"
                            activeScene={editingScene as any}
                            availableCharacters={characters.map(c => ({ id: c.id || c.name, name: c.name }))}
                            availableLocations={locations.map(l => ({ id: l.id || l.name, name: l.name }))}
                            availableProducts={products.map(p => ({ id: p.id || p.name, name: p.name }))}
                            projectType={project.type as 'movie' | 'ad' | 'music_video'}
                            selectedContext={selectedContext}
                            isProcessing={isProcessing}
                            onUpdateCast={handleUpdateCast}
                            onUpdateScene={handleUpdateScene}
                            onExecuteAi={handleExecuteAi}
                            onOpenContextModal={() => setIsContextModalOpen(true)}
                            onRemoveContextRef={(id) => setSelectedContext(prev => prev.filter(r => r.id !== id))}
                            onCancelSelection={() => setEditingScene(null)}
                            onEnterProduction={() => {
                                const productionUrl = project.type === 'micro_drama'
                                    ? `/project/${projectId}/studio`
                                    : `/project/${projectId}/storyboard`;
                                setEditingScene(null);
                                router.push(productionUrl);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ── CONTEXT SELECTOR MODAL ── */}
            <ContextSelectorModal
                isOpen={isContextModalOpen}
                onClose={() => setIsContextModalOpen(false)}
                episodes={episodes}
                onFetchScenes={fetchRemoteScenes}
                initialSelection={selectedContext}
                onConfirm={(newSelection) => setSelectedContext(newSelection)}
            />

            {/* ── HEADER MODALS ── */}
            <AssetManagerModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                projectId={projectId}
                project={project}
                onAssetsUpdated={() => fetchAssets()}
            />

            <ScriptIngestionModal
                isOpen={isScriptModalOpen}
                onClose={() => setIsScriptModalOpen(false)}
                projectId={projectId}
                projectTitle={project.title}
                projectType={project.type as 'movie' | 'micro_drama' | 'ad'}
                mode="edit"
                episodeId={activeEpisodeId || undefined}
                episodes={episodes}
                initialTitle={episodes.find((e: any) => e.id === activeEpisodeId)?.title}
                initialRuntime={episodes.find((e: any) => e.id === activeEpisodeId)?.runtime_seconds || episodes.find((e: any) => e.id === activeEpisodeId)?.runtime}
                onSuccess={() => {
                    setIsScriptModalOpen(false);
                    fetchAssets();
                }}
            />

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onUpdate={(updated: Project) => setProject(updated)}
            />

            {/* ── DELETE CONFIRMATION MODAL ── */}
            {pendingDeleteId && (
                <DeleteConfirmModal
                    title="Delete Scene"
                    message="Are you sure you want to delete this scene? This action cannot be undone."
                    isDeleting={isDeleting}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setPendingDeleteId(null)}
                />
            )}
        </div>
    );
}
