"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { fetchProject, fetchProjectAssets, fetchEpisodes, fetchUserCredits } from "@/lib/api";
import { Project, Asset } from "@/lib/types";
import { SceneData } from "@/components/studio/SceneCard";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { SceneStoryboardContainer } from "@/app/components/studio/SceneStoryboardContainer";

// ═══════════════════════════════════════════════════════════
//    DIRECT STORYBOARD PAGE
//    Skips the Studio scene bin for single-project types
//    (film, ad, music_video). Opens storyboard with first scene.
// ═══════════════════════════════════════════════════════════

export default function StoryboardPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [episodeId, setEpisodeId] = useState<string>("main");
    const [scenes, setScenes] = useState<SceneData[]>([]);
    const [selectedScene, setSelectedScene] = useState<SceneData | null>(null);
    const [credits, setCredits] = useState<number>(0);
    const [projectAssets, setProjectAssets] = useState<{
        characters: Asset[];
        locations: Asset[];
        products: Asset[];
    }>({ characters: [], locations: [], products: [] });

    useEffect(() => {
        if (!projectId) return;

        async function init() {
            try {
                const [proj, assets, creds] = await Promise.all([
                    fetchProject(projectId),
                    fetchProjectAssets(projectId),
                    fetchUserCredits(auth.currentUser?.uid || ""),
                ]);

                setProject(proj);
                setProjectAssets(assets);
                setCredits(creds);

                // For series, redirect to studio (they need episode nav)
                if (proj.type === "micro_drama") {
                    router.replace(`/project/${projectId}/studio`);
                    return;
                }

                // Resolve episode ID (episodes endpoint may 404 for non-series)
                let epId = proj.default_episode_id || "main";
                try {
                    const epsData = await fetchEpisodes(projectId);
                    const eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
                    const targetEp = eps.find((e: any) => e.id === epId) || eps[0];
                    if (targetEp?.id) epId = targetEp.id;
                } catch {
                    // Films/ads may not have episodes — use default
                    console.warn("Episodes not found, using default:", epId);
                }
                setEpisodeId(epId);

                // Load scenes
                const q = query(
                    collection(db, "projects", projectId, "episodes", epId, "scenes"),
                    orderBy("scene_number", "asc")
                );
                const snap = await getDocs(q);
                const sceneList: SceneData[] = snap.docs.map(d => {
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
                        status: data.status || "draft",
                        header: slugline,
                        summary: synopsis,
                        cast_ids: data.cast_ids || data.characters || [],
                        location_id: data.location_id || "",
                        ...data,
                    };
                });
                sceneList.sort((a, b) => a.scene_number - b.scene_number);
                setScenes(sceneList);

                // Auto-select first scene
                if (sceneList.length > 0) {
                    setSelectedScene(sceneList[0]);
                }
            } catch (e) {
                console.error("Storyboard Load Error:", e);
                toast.error("Failed to load storyboard");
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [projectId]);

    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center gap-4">
                <Loader2 size={28} className="animate-spin text-[#E50914]" />
                <span className="text-[10px] text-neutral-600 tracking-[3px] uppercase font-mono">
                    Loading Storyboard...
                </span>
            </div>
        );
    }

    if (!selectedScene) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center gap-4">
                <p className="text-[11px] text-neutral-500">No scenes found. Go to Pre-Production first.</p>
                <button
                    onClick={() => router.push(`/project/${projectId}/preproduction`)}
                    className="px-4 py-2 rounded-lg bg-[#E50914] text-white text-[10px] font-bold uppercase tracking-[2px] cursor-pointer hover:bg-[#ff1a25] transition-all"
                >
                    Go to Pre-Production
                </button>
            </div>
        );
    }

    return (
        <SceneStoryboardContainer
            isOpen={true}
            onClose={() => router.push(`/project/${projectId}`)}
            projectId={projectId}
            episodeId={episodeId}
            scene={selectedScene}
            projectAssets={projectAssets}
            seriesTitle={project.title}
            credits={credits}
        />
    );
}
