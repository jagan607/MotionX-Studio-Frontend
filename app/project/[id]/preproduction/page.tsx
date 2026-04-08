"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, onSnapshot, collection, query, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    fetchEpisodes, fetchProjectAssets, updateAsset, deleteAsset, triggerAssetGeneration,
} from "@/lib/api";
import { Project, Scene, CharacterProfile, LocationProfile, ProductProfile } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { PreProductionHeader } from "./components/PreProductionHeader";
import { AssetManagerModal } from "@/app/components/studio/AssetManagerModal";
import { ScriptIngestionModal } from "@/app/components/studio/ScriptIngestionModal";
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

import { Phase3Skeleton } from "./components/Phase3Skeleton";

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
    const [editingScene, setEditingScene] = useState<Scene | null>(null);
    const [editHeader, setEditHeader] = useState("");
    const [editSummary, setEditSummary] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Header Modal State
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

    // Scene Draft State
    const [isDraftApproved, setIsDraftApproved] = useState(false);



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
    const moodRedirected = useRef(false);
    useEffect(() => {
        if (!project || !hasScript || !isDraftApproved || moodRedirected.current) return;
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
                onOpenAssets={() => setIsAssetModalOpen(true)}
                onEditScript={() => setIsScriptModalOpen(true)}
            />

            {/* ── MAIN CANVAS ── */}
            <div className="relative flex-1 overflow-hidden" style={{ maxHeight: '100%' }}>


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
                            onOpenMoodboard={() => router.push(`/project/${projectId}/moodboard?episode_id=${activeEpisodeId || 'main'}`)}
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
        </div>
    );
}
