"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowRight, Users, MapPin, RefreshCw, Wand2, Image as ImageIcon, Loader2, CheckCircle
} from "lucide-react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

// --- DESIGN SYSTEM ---
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionButton } from "@/components/ui/MotionButton";

// --- TYPES ---
interface Asset {
    id: string;
    name: string;
    description?: string; // or visual_traits
    image_url?: string;
    status: 'pending' | 'generating' | 'ready';
}

export default function AssetOnboardingPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // State
    const [activeTab, setActiveTab] = useState<'cast' | 'locations'>('cast');
    const [characters, setCharacters] = useState<Asset[]>([]);
    const [locations, setLocations] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    // 1. FETCH ASSETS
    useEffect(() => {
        async function fetchAssets() {
            if (!projectId) return;
            try {
                // Fetch Characters
                const charSnap = await getDocs(collection(db, "projects", projectId, "characters"));
                const chars = charSnap.docs.map(d => ({ id: d.id, ...d.data(), status: d.data().image_url ? 'ready' : 'pending' })) as Asset[];

                // Fetch Locations
                const locSnap = await getDocs(collection(db, "projects", projectId, "locations"));
                const locs = locSnap.docs.map(d => ({ id: d.id, ...d.data(), status: d.data().image_url ? 'ready' : 'pending' })) as Asset[];

                setCharacters(chars);
                setLocations(locs);
            } catch (e) {
                console.error(e);
                toast.error("Failed to load assets");
            } finally {
                setLoading(false);
            }
        }
        fetchAssets();
    }, [projectId]);

    // 2. GENERATE VISUAL (Call Backend)
    const generateVisual = async (asset: Asset, type: 'character' | 'location') => {
        setGeneratingId(asset.id);
        try {
            // NOTE: We will build this backend endpoint next
            const res = await api.post("/project/generate-asset-visual", {
                project_id: projectId,
                asset_id: asset.id,
                type: type // 'character' or 'location'
            });

            const newUrl = res.data.image_url;

            // Update Local State
            if (type === 'character') {
                setCharacters(prev => prev.map(c => c.id === asset.id ? { ...c, image_url: newUrl, status: 'ready' } : c));
            } else {
                setLocations(prev => prev.map(l => l.id === asset.id ? { ...l, image_url: newUrl, status: 'ready' } : l));
            }
            toast.success("Visual Generated");

        } catch (e) {
            console.error(e);
            toast.error("Generation Failed");
        } finally {
            setGeneratingId(null);
        }
    };

    // 3. ENTER STUDIO (Finalize)
    const handleEnterStudio = async () => {
        try {
            // Mark project as fully ready
            await updateDoc(doc(db, "projects", projectId), {
                script_status: "production_ready"
            });
            router.push(`/project/${projectId}/studio`);
        } catch (e) {
            toast.error("Failed to update status");
        }
    };

    // Helper: Filter assets based on tab
    const activeAssets = activeTab === 'cast' ? characters : locations;
    const progress = Math.round((characters.filter(c => c.status === 'ready').length + locations.filter(l => l.status === 'ready').length) / (characters.length + locations.length || 1) * 100);

    return (
        <StudioLayout>
            {/* HEADER */}
            <div className="flex items-end justify-between mb-8 border-b border-motion-border pb-6">
                <div>
                    <h1 className="text-4xl font-display uppercase mb-2">Asset Visualization</h1>
                    <p className="text-motion-text-muted text-xs font-mono tracking-widest">
                        ESTABLISH VISUAL IDENTITY BEFORE PRODUCTION // PROGRESS: {progress}%
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="flex bg-motion-surface border border-motion-border rounded-sm p-1">
                        <button
                            onClick={() => setActiveTab('cast')}
                            className={`px-6 py-2 text-[10px] font-bold tracking-[2px] uppercase transition-all ${activeTab === 'cast' ? 'bg-motion-red text-white' : 'text-motion-text-muted hover:text-white'}`}
                        >
                            CAST ({characters.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('locations')}
                            className={`px-6 py-2 text-[10px] font-bold tracking-[2px] uppercase transition-all ${activeTab === 'locations' ? 'bg-motion-red text-white' : 'text-motion-text-muted hover:text-white'}`}
                        >
                            LOCATIONS ({locations.length})
                        </button>
                    </div>

                    <MotionButton onClick={handleEnterStudio} className="w-[200px]">
                        ENTER STUDIO <ArrowRight size={14} />
                    </MotionButton>
                </div>
            </div>

            {/* GRID */}
            {loading ? (
                <div className="h-64 flex items-center justify-center text-motion-text-muted text-xs font-mono animate-pulse">
                    LOADING ASSET MANIFEST...
                </div>
            ) : activeAssets.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-motion-text-muted border border-dashed border-motion-border">
                    <Users className="mb-4 opacity-20" size={48} />
                    <div className="text-xs font-mono tracking-widest">NO ASSETS DETECTED IN SCRIPT</div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {activeAssets.map((asset) => (
                        <div
                            key={asset.id}
                            className={`
                            group relative aspect-[3/4] bg-motion-surface border transition-all overflow-hidden
                            ${asset.image_url ? 'border-motion-border hover:border-motion-text' : 'border-motion-border border-dashed'}
                        `}
                        >
                            {/* IMAGE AREA */}
                            <div className="absolute inset-0 w-full h-full">
                                {asset.image_url ? (
                                    <img src={asset.image_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/50">
                                        {generatingId === asset.id ? (
                                            <Loader2 className="animate-spin text-motion-red mb-2" />
                                        ) : (
                                            <ImageIcon className="text-motion-text-muted opacity-20 mb-2" size={32} />
                                        )}
                                        <div className="text-[9px] font-mono text-motion-text-muted uppercase tracking-widest">
                                            {generatingId === asset.id ? "RENDERING..." : "NO VISUAL DATA"}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* OVERLAY INFO */}
                            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-display uppercase leading-none">{asset.name}</h3>
                                    {asset.status === 'ready' && <CheckCircle size={14} className="text-motion-red" />}
                                </div>

                                {/* ACTIONS */}
                                <button
                                    onClick={() => generateVisual(asset, activeTab === 'cast' ? 'character' : 'location')}
                                    disabled={generatingId === asset.id}
                                    className="w-full mt-2 flex items-center justify-center gap-2 bg-motion-border/50 hover:bg-motion-red/80 backdrop-blur-md py-2 text-[9px] font-bold tracking-[2px] uppercase transition-all border border-white/10 hover:border-motion-red"
                                >
                                    {generatingId === asset.id ? (
                                        "PROCESSING"
                                    ) : (
                                        <>
                                            {asset.image_url ? <RefreshCw size={10} /> : <Wand2 size={10} />}
                                            {asset.image_url ? "REGENERATE" : "GENERATE LOOK"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="h-20" />
        </StudioLayout>
    );
}