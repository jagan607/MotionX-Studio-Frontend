"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, onSnapshot, collection, query, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    api, fetchEpisodes, fetchProjectAssets, updateAsset, deleteAsset, triggerAssetGeneration,
    uploadStyleRef
} from "@/lib/api";
import { Project, Scene, CharacterProfile, LocationProfile, ProductProfile } from "@/lib/types";
import { ArrowLeft, Loader2, Play, Upload, Palette, Sparkles, ImageIcon, X, ChevronLeft, ChevronRight, Sun, Layers, CloudFog, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { AssetModal } from "@/components/AssetModal";

import { CanvasEngine, CanvasTransform, CanvasJumpTo } from "./components/CanvasEngine";
import { CanvasNode, NodePosition, NodeType } from "./components/CanvasNode";
import { WireLayer } from "./components/ConnectionWire";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { CanvasMinimap } from "./components/CanvasMinimap";
import { SceneNavigator } from "./components/SceneNavigator";
import { Lightbox } from "./components/Lightbox";
import { ScriptSection } from "./components/ScriptSection";
import { MoodSection } from "./components/MoodSection";

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
const NODE_W: Record<NodeType, number> = { scene: 260, character: 160, location: 260, moodboard: 240, product: 150 };
const NODE_H_EST: Record<NodeType, number> = { scene: 260, character: 300, location: 170, moodboard: 220, product: 200 };

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
        }
        for (const loc of locations) {
            if (!sceneLocs.find(l => l.id === loc.id) && scene.header && loc.name &&
                scene.header.toLowerCase().includes(loc.name.toLowerCase())) {
                sceneLocs.push(loc);
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
    const [showMoodboard, setShowMoodboard] = useState(false);
    const [editingScene, setEditingScene] = useState<Scene | null>(null);
    const [editHeader, setEditHeader] = useState("");
    const [editSummary, setEditSummary] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const moodAutoOpened = useRef(false);

    // Onboarding Moodboard State
    const [showOnboardingMood, setShowOnboardingMood] = useState(false);
    const [styleRefFile, setStyleRefFile] = useState<File | null>(null);
    const [isUploadingStyle, setIsUploadingStyle] = useState(false);
    const [isGeneratingMood, setIsGeneratingMood] = useState(false);
    const [moodOptions, setMoodOptions] = useState<any[]>([]);
    const [isApplyingMood, setIsApplyingMood] = useState<string | null>(null);
    const [isDraggingStyle, setIsDraggingStyle] = useState(false);
    const styleInputRef = useRef<HTMLInputElement>(null);
    const [selectedMoodIdx, setSelectedMoodIdx] = useState(0);

    // ─── LOCK BODY SCROLL & MEASURE HEADER ───
    const [headerHeight, setHeaderHeight] = useState(0);
    useEffect(() => {
        // Measure the GlobalHeader's actual height
        const header = document.querySelector('header.sticky');
        if (header) {
            setHeaderHeight(header.getBoundingClientRect().height);
        }
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

                if (targetEpId) await fetchAssets(targetEpId);
            } catch (e) {
                console.error("Canvas Load Error", e);
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => unsubs.forEach(u => u());
    }, [projectId]);

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
    const { canvasNodes, sectionLabels: canvasSectionLabels } = useMemo(() => {
        if (!project) return { canvasNodes: [] as CanvasNodeData[], sectionLabels: [] as SectionLabel[] };
        const { nodes: layoutNodes, sectionLabels: labels } = autoLayoutNodes(scenes, characters, locations, products, project.moodboard, project);
        const finalNodes = layoutNodes.map((n, i) => ({
            ...n,
            position: nodePositions[n.id] || n.position,
            isGenerating: generatingMap[n.raw?.id] || false,
            index: i,
        }));
        return { canvasNodes: finalNodes, sectionLabels: labels };
    }, [scenes, characters, locations, products, project, nodePositions, generatingMap]);

    const wires = useMemo(() => buildWires(canvasNodes, scenes), [canvasNodes, scenes]);

    // Extract moodboard data for theming
    const moodAtmosphere = (project as any)?.moodboard_style?.atmosphere || "";
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
            setShowMoodboard(true);
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

    const hasScript = (project ? (project.script_status !== "empty" && project.script_status !== "pending") : false) || scenes.length > 0;
    const isCommercial = project?.type === "ad";

    // Auto-show onboarding moodboard on first visit if no moodboard selected
    useEffect(() => {
        if (!project || moodAutoOpened.current) return;
        const hasMood = (project as any).moodboard_image_url || (project as any).style_ref_url;
        if (!hasMood && hasScript) {
            setShowOnboardingMood(true);
            moodAutoOpened.current = true;
        }
    }, [project, hasScript]);

    // Listen to moodboard options for onboarding
    useEffect(() => {
        if (!showOnboardingMood || !project?.id) return;
        const colRef = collection(db, "projects", project.id, "moodboard_options");
        const unsub = onSnapshot(colRef, (snap) => {
            setMoodOptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [showOnboardingMood, project?.id]);

    // Onboarding handlers
    const handleStyleRefUpload = async (file: File) => {
        setIsUploadingStyle(true);
        try {
            const res = await uploadStyleRef(projectId, file);
            toast.success("Style reference applied!");
            setProject(prev => prev ? { ...prev, style_ref_url: res.url || res.style_ref_url } as any : prev);
            setShowOnboardingMood(false);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Upload failed");
        } finally { setIsUploadingStyle(false); }
    };

    const handleGenerateMoods = async (referenceMood?: any) => {
        setIsGeneratingMood(true);
        try {
            const payload: any = {
                project_id: projectId,
                episode_id: activeEpisodeId || "main",
            };
            if (referenceMood) {
                payload.reference_mood = {
                    name: referenceMood.name,
                    color_palette: referenceMood.color_palette,
                    lighting: referenceMood.lighting,
                    texture: referenceMood.texture,
                    atmosphere: referenceMood.atmosphere,
                };
            }
            await api.post("/api/v1/shot/generate_moodboard", payload);
            toast.success(referenceMood ? `Generating variations of "${referenceMood.name}"...` : "Generating cinematic styles...");
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Generation failed");
        } finally { setIsGeneratingMood(false); }
    };

    const handleSelectMood = async (mood: any) => {
        setIsApplyingMood(mood.id);
        try {
            await api.post("/api/v1/shot/select_moodboard", {
                project_id: projectId,
                mood_option_id: mood.id,
            });
            toast.success(`Style "${mood.name}" applied!`);
            setProject(prev => prev ? {
                ...prev,
                style_ref_url: mood.image_url || prev.style_ref_url,
                moodboard_image_url: mood.image_url,
            } as any : prev);
            setShowOnboardingMood(false);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Selection failed");
        } finally { setIsApplyingMood(null); }
    };

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
        <div ref={containerRef} className="fixed left-0 right-0 bottom-0 bg-[#060606] text-white overflow-hidden flex flex-col"
            style={{ top: `${headerHeight}px` }}>

            {/* ── Top Bar (minimal) ── */}
            <header className="relative z-[30] h-10 border-b border-white/[0.04] bg-[#050505]/70 backdrop-blur-xl flex items-center justify-between px-5 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
                    <h1 className="text-xs font-bold tracking-wider uppercase text-white/80 truncate max-w-[200px]">
                        {project.title}
                    </h1>
                    <span className="text-[8px] text-white/20 font-mono tracking-[3px] uppercase">Pre-Production</span>
                </div>

                {hasScript && (
                    <button
                        onClick={() => router.push(project.type === 'micro_drama' ? `/project/${projectId}/studio` : `/project/${projectId}/storyboard`)}
                        className="h-7 px-4 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] text-white text-[9px] font-bold uppercase tracking-[2px] rounded-full flex items-center gap-2 transition-all hover:-translate-y-0.5"
                    >
                        Production
                        <Play size={8} className="fill-current" />
                    </button>
                )}
            </header>

            {/* ── MAIN CANVAS ── */}
            <div className="relative flex-1 overflow-hidden" style={{ maxHeight: '100%' }}>
                <style jsx>{`
                    @keyframes mbHeroFade { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes mbLabelReveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes mbScanDrift { 0% { top: 10%; } 100% { top: 90%; } }
                    @keyframes mbPulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(229,9,20,0.15); } 50% { box-shadow: 0 0 40px rgba(229,9,20,0.3); } }
                    @keyframes mbFlowBlob1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(25%,15%) scale(1.3); } 66% { transform: translate(-15%,25%) scale(0.9); } }
                    @keyframes mbFlowBlob2 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-20%,-15%) scale(1.15); } 66% { transform: translate(15%,-10%) scale(1.25); } }
                    @keyframes mbPulseText { 0%,100% { opacity: 0.5; } 50% { opacity: 0.25; } }
                `}</style>

                {!hasScript ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ScriptSection
                            project={project}
                            scenes={scenes}
                            activeEpisodeId={activeEpisodeId}
                            onUpdateProject={setProject}
                            onScenesUpdated={fetchAssets}
                            episodes={episodes}
                        />
                    </div>
                ) : showOnboardingMood ? (
                    /* ═══════════════════════════════════════════════════════
                       IMMERSIVE MOODBOARD — Full Cinema Experience
                       ═══════════════════════════════════════════════════════ */
                    (() => {
                        const currentMood = moodOptions[selectedMoodIdx] || null;
                        const readyMoods = moodOptions.filter(m => m.status === 'ready');
                        const hasMoods = moodOptions.length > 0;
                        const hasCurrentImage = currentMood?.status === 'ready' && currentMood?.image_url;

                        return (
                            <div className="absolute inset-0 bg-[#020202]">
                                {!hasMoods ? (
                                    /* ── Empty State: Generate ── */
                                    <div className="absolute inset-0">
                                        <div className="absolute inset-0 overflow-hidden">
                                            <div className="absolute w-[50%] h-[50%] rounded-full bg-[#E50914]/15 blur-[80px]"
                                                style={{ animation: 'mbFlowBlob1 6s ease-in-out infinite', top: '15%', left: '20%' }} />
                                            <div className="absolute w-[40%] h-[40%] rounded-full bg-[#ff4d4d]/[0.08] blur-[60px]"
                                                style={{ animation: 'mbFlowBlob2 7s ease-in-out infinite', top: '40%', right: '15%' }} />
                                            <div className="absolute inset-0 backdrop-blur-3xl bg-white/[0.01]" />
                                        </div>

                                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                            {isGeneratingMood ? (
                                                <>
                                                    <Loader2 size={24} className="text-[#E50914] animate-spin mb-4" />
                                                    <span className="text-[10px] text-white/40 tracking-[4px] uppercase">Generating moods...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Palette size={36} className="text-[#E50914]/30 mb-6" />
                                                    <h2 className="text-2xl sm:text-3xl uppercase tracking-wide mb-3 font-anton text-white/80">Visual Direction</h2>
                                                    <p className="text-[11px] text-white/30 tracking-[2px] uppercase mb-8">Define the cinematic look for your project</p>
                                                    <button onClick={handleGenerateMoods}
                                                        className="flex items-center gap-2 px-8 py-3 rounded-lg bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold uppercase tracking-[2px] transition-all cursor-pointer">
                                                        <Palette size={14} /> Generate Moodboard
                                                    </button>
                                                    <button onClick={() => setShowOnboardingMood(false)}
                                                        className="mt-6 text-[9px] text-neutral-600 hover:text-white/40 tracking-[2px] uppercase transition-colors cursor-pointer">
                                                        Skip for now →
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* ── Immersive Hero View ── */
                                    <>
                                        {/* HERO BACKGROUND */}
                                        <div key={currentMood?.id + (currentMood?.image_url || '')} className="absolute inset-0 z-0" style={{ animation: 'mbHeroFade 0.8s ease both' }}>
                                            {hasCurrentImage ? (
                                                <img src={currentMood!.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                            ) : (
                                                <div className="absolute inset-0 bg-[#050505] overflow-hidden">
                                                    <div className="absolute w-[55%] h-[55%] rounded-full bg-[#E50914]/25 blur-[60px]"
                                                        style={{ animation: 'mbFlowBlob1 5s ease-in-out infinite', top: '10%', left: '15%' }} />
                                                    <div className="absolute w-[45%] h-[45%] rounded-full bg-[#ff4d4d]/[0.12] blur-[50px]"
                                                        style={{ animation: 'mbFlowBlob2 6s ease-in-out infinite', top: '35%', right: '10%' }} />
                                                    <div className="absolute inset-0 backdrop-blur-2xl bg-white/[0.02]" />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-[11px] font-semibold text-white/40 tracking-[4px] uppercase"
                                                            style={{ animation: 'mbPulseText 2.5s ease-in-out infinite' }}>
                                                            Rendering...
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Cinematic overlays */}
                                            <div className="absolute inset-0 bg-black/30" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-transparent to-[#020202]/40" />
                                            <div className="absolute inset-0 bg-gradient-to-r from-[#020202]/70 via-transparent to-[#020202]/50" />
                                        </div>

                                        {/* LETTERBOX BARS */}
                                        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#020202] to-transparent z-30" />
                                        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#020202] via-[#020202] to-transparent z-30" />

                                        {/* VIEWFINDER FRAME */}
                                        <div className="absolute inset-0 z-20 pointer-events-none">
                                            <div className="absolute top-8 left-8 w-10 h-10 border-t border-l border-white/[0.06]" />
                                            <div className="absolute top-8 right-8 w-10 h-10 border-t border-r border-white/[0.06]" />
                                            <div className="absolute bottom-32 left-8 w-10 h-10 border-b border-l border-white/[0.06]" />
                                            <div className="absolute bottom-32 right-8 w-10 h-10 border-b border-r border-white/[0.06]" />
                                            <div className="absolute left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#E50914]/15 to-transparent"
                                                style={{ animation: 'mbScanDrift 6s ease-in-out infinite alternate' }} />
                                        </div>

                                        {/* CENTER: MOOD INFO */}
                                        <div className="absolute inset-0 z-30 flex items-center pointer-events-none">
                                            <div key={currentMood?.id} className="ml-12 max-w-lg" style={{ animation: 'mbLabelReveal 0.5s ease both' }}>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="h-[1px] w-10 bg-[#E50914]/40" />
                                                    <span className="text-[9px] font-mono text-[#E50914]/60 uppercase tracking-[4px]">
                                                        Mood {selectedMoodIdx + 1} of {moodOptions.length}
                                                    </span>
                                                </div>

                                                <h1 className="text-4xl md:text-5xl font-anton uppercase tracking-tight leading-[0.9] mb-5 text-white">
                                                    {currentMood?.name || 'Untitled'}
                                                </h1>

                                                {/* Attribute tags */}
                                                <div className="space-y-0 border-l border-white/[0.06] pl-5">
                                                    {currentMood?.color_palette && (
                                                        <div className="flex items-start gap-3 py-2">
                                                            <Palette size={13} className="text-white/20 mt-0.5" />
                                                            <div>
                                                                <span className="text-[8px] font-mono text-white/25 uppercase tracking-[3px] block mb-0.5">Color Palette</span>
                                                                <span className="text-[12px] text-white/70 leading-relaxed">{currentMood.color_palette}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {currentMood?.lighting && (
                                                        <div className="flex items-start gap-3 py-2">
                                                            <Sun size={13} className="text-white/20 mt-0.5" />
                                                            <div>
                                                                <span className="text-[8px] font-mono text-white/25 uppercase tracking-[3px] block mb-0.5">Lighting</span>
                                                                <span className="text-[12px] text-white/70 leading-relaxed">{currentMood.lighting}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {currentMood?.texture && (
                                                        <div className="flex items-start gap-3 py-2">
                                                            <Layers size={13} className="text-white/20 mt-0.5" />
                                                            <div>
                                                                <span className="text-[8px] font-mono text-white/25 uppercase tracking-[3px] block mb-0.5">Texture</span>
                                                                <span className="text-[12px] text-white/70 leading-relaxed">{currentMood.texture}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {currentMood?.atmosphere && (
                                                        <div className="flex items-start gap-3 py-2">
                                                            <CloudFog size={13} className="text-white/20 mt-0.5" />
                                                            <div>
                                                                <span className="text-[8px] font-mono text-white/25 uppercase tracking-[3px] block mb-0.5">Atmosphere</span>
                                                                <span className="text-[12px] text-white/70 leading-relaxed">{currentMood.atmosphere}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Rendering indicator */}
                                                {currentMood?.status !== 'ready' && (
                                                    <div className="flex items-center gap-2 mt-6">
                                                        <Loader2 size={12} className="animate-spin text-[#E50914]/40" />
                                                        <span className="text-[9px] text-white/20 uppercase tracking-[3px] font-mono">Rendering preview...</span>
                                                    </div>
                                                )}

                                                {/* Generate More Like This */}
                                                {currentMood?.status === 'ready' && (
                                                    <button
                                                        onClick={() => handleGenerateMoods(currentMood)}
                                                        disabled={isGeneratingMood}
                                                        className="pointer-events-auto mt-5 flex items-center gap-2 px-4 py-2 text-[9px] font-bold text-white/40 uppercase tracking-[1.5px] border border-white/[0.08] rounded-lg hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
                                                    >
                                                        <RefreshCw size={10} className={isGeneratingMood ? 'animate-spin' : ''} />
                                                        Generate More Like This
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* NAVIGATION ARROWS */}
                                        {moodOptions.length > 1 && (
                                            <div className="absolute inset-y-0 left-0 right-0 z-40 flex items-center justify-between px-5 pointer-events-none">
                                                <button onClick={() => setSelectedMoodIdx(prev => (prev - 1 + moodOptions.length) % moodOptions.length)}
                                                    className="w-10 h-10 rounded-full border border-white/[0.08] bg-black/30 backdrop-blur-sm flex items-center justify-center hover:border-white/[0.2] hover:bg-black/50 transition-all cursor-pointer pointer-events-auto group">
                                                    <ChevronLeft size={16} className="text-white/30 group-hover:text-white transition-colors" />
                                                </button>
                                                <button onClick={() => setSelectedMoodIdx(prev => (prev + 1) % moodOptions.length)}
                                                    className="w-10 h-10 rounded-full border border-white/[0.08] bg-black/30 backdrop-blur-sm flex items-center justify-center hover:border-white/[0.2] hover:bg-black/50 transition-all cursor-pointer pointer-events-auto group">
                                                    <ChevronRight size={16} className="text-white/30 group-hover:text-white transition-colors" />
                                                </button>
                                            </div>
                                        )}

                                        {/* BOTTOM FILMSTRIP */}
                                        <div className="absolute bottom-0 left-0 right-0 z-40">
                                            {/* Perforations */}
                                            <div className="flex items-center justify-center gap-[6px] mb-1 opacity-15">
                                                {[...Array(60)].map((_, i) => (
                                                    <div key={i} className="w-[6px] h-[3px] rounded-[1px] bg-white/60" />
                                                ))}
                                            </div>

                                            <div className="flex h-[64px] border-t border-white/[0.04] bg-[#020202]/80 backdrop-blur-md">
                                                {moodOptions.map((mood, idx) => {
                                                    const active = idx === selectedMoodIdx;
                                                    const hasImage = mood.status === 'ready' && mood.image_url;
                                                    return (
                                                        <button key={mood.id}
                                                            onClick={() => setSelectedMoodIdx(idx)}
                                                            className={`relative flex-1 overflow-hidden transition-all duration-500 cursor-pointer group
                                                                ${idx > 0 ? 'border-l border-white/[0.03]' : ''}
                                                                ${active ? 'flex-[1.8]' : 'opacity-40 hover:opacity-70'}`}>
                                                            {hasImage ? (
                                                                <img src={mood.image_url} alt={mood.name}
                                                                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700
                                                                        ${active ? 'scale-100 brightness-90' : 'scale-110 brightness-50 group-hover:brightness-75 group-hover:scale-105'}`} />
                                                            ) : (
                                                                <div className="absolute inset-0 bg-[#060606] overflow-hidden">
                                                                    <div className="absolute w-[70%] h-[70%] rounded-full bg-[#E50914]/20 blur-[25px]"
                                                                        style={{ animation: 'mbFlowBlob1 4s ease-in-out infinite', top: '5%', left: '10%' }} />
                                                                    <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.02]" />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                                                            {active && <div className="absolute top-0 inset-x-0 h-[2px] bg-[#E50914] shadow-[0_0_8px_rgba(229,9,20,0.5)]" />}
                                                            <div className="absolute bottom-0 inset-x-0 p-2">
                                                                <span className={`text-[8px] font-bold uppercase tracking-wider block truncate ${active ? 'text-white' : 'text-white/50'}`}>
                                                                    {mood.name}
                                                                </span>
                                                                {!hasImage && (
                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                        <Loader2 size={7} className="animate-spin text-[#E50914]/30" />
                                                                        <span className="text-[7px] text-white/15 uppercase tracking-wider font-mono">Rendering</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Bottom perforations */}
                                            <div className="flex items-center justify-center gap-[6px] mt-1 mb-1 opacity-15">
                                                {[...Array(60)].map((_, i) => (
                                                    <div key={i} className="w-[6px] h-[3px] rounded-[1px] bg-white/60" />
                                                ))}
                                            </div>

                                            {/* CTA Bar */}
                                            <div className="flex items-center justify-between px-6 py-1.5 bg-[#020202]">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[8px] font-mono text-white/10 uppercase tracking-[3px]">
                                                        ← → Navigate
                                                    </span>
                                                    <button onClick={handleGenerateMoods} disabled={isGeneratingMood}
                                                        className="flex items-center gap-2 px-3 py-1 text-[9px] font-bold text-white/30 uppercase tracking-[1px] border border-white/[0.06] rounded-md hover:text-white hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer disabled:opacity-30">
                                                        <RefreshCw size={10} className={isGeneratingMood ? 'animate-spin' : ''} />
                                                        Regenerate
                                                    </button>
                                                    <button onClick={() => setShowOnboardingMood(false)}
                                                        className="flex items-center gap-2 px-3 py-1 text-[9px] font-bold text-white/30 uppercase tracking-[1px] border border-white/[0.06] rounded-md hover:text-white hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer">
                                                        Skip
                                                    </button>
                                                </div>
                                                <button onClick={() => currentMood && handleSelectMood(currentMood)}
                                                    disabled={!hasCurrentImage || !!isApplyingMood}
                                                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#E50914] hover:bg-[#ff1a25] text-white text-[10px] font-bold uppercase tracking-[2px] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(229,9,20,0.2)] hover:shadow-[0_0_30px_rgba(229,9,20,0.4)]"
                                                    style={hasCurrentImage && !isApplyingMood ? { animation: 'mbPulseGlow 2.5s ease-in-out infinite' } : undefined}>
                                                    {isApplyingMood ? (
                                                        <><Loader2 size={12} className="animate-spin" /> Applying...</>
                                                    ) : (
                                                        <>Apply This Mood <ChevronRight size={13} /></>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()
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
                                                const raw = node.raw;
                                                const type = node.nodeType;
                                                const prompt = `Cinematic ${type === "character" ? "portrait" : type === "location" ? "establishing shot" : "product photo"} of ${node.title}. High quality, 8k, photorealistic.`;
                                                handleGenerateAsset(type, raw.id, prompt);
                                            }
                                            : undefined
                                    }
                                    onDelete={
                                        node.nodeType !== "scene" && node.nodeType !== "moodboard"
                                            ? () => handleDeleteAsset(node.nodeType, node.raw.id, node.title)
                                            : undefined
                                    }
                                />
                            ))}
                        </CanvasEngine>
                        <CanvasToolbar
                            productLabel={isCommercial ? "Product" : "Prop"}
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
                            onOpenMoodboard={() => setShowMoodboard(true)}
                        />
                        <CanvasMinimap
                            nodes={canvasNodes.map(n => ({ id: n.id, type: n.nodeType, position: n.position }))}
                            transform={canvasTransform}
                            containerWidth={containerRef.current?.clientWidth || 1200}
                            containerHeight={containerRef.current?.clientHeight || 800}
                            onJumpTo={(x, y) => canvasJumpToRef.current?.(x, y)}
                        />
                        <SceneNavigator
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

            {/* Scene Editing Overlay */}
            {editingScene && (
                <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-8">
                    <div className="relative w-full max-w-lg bg-[#0C0C0C] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="px-6 pt-5 pb-3 border-b border-white/[0.06] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-[28px] font-['Anton'] text-white/[0.08]">
                                    {String(editingScene.scene_number).padStart(2, "0")}
                                </span>
                                <span className="text-[9px] font-bold tracking-[3px] uppercase text-white/40">Edit Scene</span>
                            </div>
                            <button
                                onClick={() => setEditingScene(null)}
                                className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >✕</button>
                        </div>
                        {/* Fields */}
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-[9px] font-bold tracking-[2px] uppercase text-white/30 block mb-2">Scene Header</label>
                                <input
                                    type="text"
                                    value={editHeader}
                                    onChange={e => setEditHeader(e.target.value)}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-colors font-mono"
                                    placeholder="INT. LOCATION — TIME"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold tracking-[2px] uppercase text-white/30 block mb-2">Summary / Description</label>
                                <textarea
                                    value={editSummary}
                                    onChange={e => setEditSummary(e.target.value)}
                                    rows={5}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-white/20 transition-colors resize-none leading-relaxed"
                                    placeholder="Describe what happens in this scene..."
                                />
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="px-6 pb-5 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingScene(null)}
                                className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-white/40 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
                            >Cancel</button>
                            <button
                                onClick={handleSaveScene}
                                className="px-5 py-2 text-[10px] font-bold tracking-widest uppercase text-white bg-[#E50914] hover:bg-[#F6121D] rounded-lg transition-colors shadow-[0_0_20px_rgba(229,9,20,0.3)]"
                            >Save Scene</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Moodboard Overlay (for returning users via toolbar) */}
            {showMoodboard && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-8">
                    <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border border-white/10 rounded-2xl p-1">
                        <button
                            onClick={() => setShowMoodboard(false)}
                            className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/50 hover:text-white transition-colors"
                        >✕</button>
                        <MoodSection project={project} onUpdateProject={setProject} activeEpisodeId={activeEpisodeId} />
                    </div>
                </div>
            )}
        </div>
    );
}
