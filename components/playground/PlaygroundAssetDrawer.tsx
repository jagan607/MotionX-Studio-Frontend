"use client";

/**
 * PlaygroundAssetDrawer — Left-side asset management panel.
 *
 * Features:
 *   1. Tabbed navigation (Characters | Locations | Products)
 *   2. Asset list with PlaygroundAssetCard (hover Edit/Delete)
 *   3. "+ New" button that opens PlaygroundAssetForm inline (create mode)
 *   4. Edit flow: clicking Edit on a card opens the form in edit mode
 *   5. Loading/empty states per tab
 */

import { useState, useMemo, useEffect } from "react";
import { Layers, Plus, Loader2, User, MapPin, Package } from "lucide-react";
import { usePlayground } from "@/app/context/PlaygroundContext";
import type { PlaygroundAsset } from "@/lib/playgroundApi";
import PlaygroundAssetCard from "@/components/playground/PlaygroundAssetCard";
import PlaygroundAssetForm from "@/components/playground/PlaygroundAssetForm";

type AssetTab = "characters" | "locations" | "products";

const TABS: { key: AssetTab; label: string; icon: typeof User; color: string }[] = [
    { key: "characters", label: "Chars", icon: User, color: "#3B82F6" },
    { key: "locations",  label: "Locs", icon: MapPin, color: "#22C55E" },
    { key: "products",   label: "Props", icon: Package, color: "#F59E0B" },
];

export default function PlaygroundAssetDrawer() {
    const {
        characters,
        locations,
        products,
        assetsLoading,
        assetDrawerIntent,
        setAssetDrawerIntent,
    } = usePlayground();

    const [activeTab, setActiveTab] = useState<AssetTab>("characters");
    const [showForm, setShowForm] = useState(false);
    const [editingAsset, setEditingAsset] = useState<PlaygroundAsset | null>(null);

    // Listen for external "create" intent (e.g. from PromptBar's + Asset button)
    useEffect(() => {
        if (assetDrawerIntent === 'create') {
            setEditingAsset(null);
            setShowForm(true);
            setAssetDrawerIntent(null); // consume the one-shot signal
        }
    }, [assetDrawerIntent, setAssetDrawerIntent]);

    // Get assets for the active tab
    const activeAssets = useMemo(() => {
        switch (activeTab) {
            case "characters": return characters;
            case "locations":  return locations;
            case "products":   return products;
        }
    }, [activeTab, characters, locations, products]);

    const totalAssets = characters.length + locations.length + products.length;
    const activeTabConfig = TABS.find(t => t.key === activeTab)!;

    // --- Open create form ---
    const openCreateForm = () => {
        setEditingAsset(null);
        setShowForm(true);
    };

    // --- Open edit form ---
    const openEditForm = (asset: PlaygroundAsset) => {
        setEditingAsset(asset);
        setShowForm(true);
    };

    // --- Close form ---
    const closeForm = () => {
        setShowForm(false);
        setEditingAsset(null);
    };

    // If the form is open, render it full-height
    if (showForm) {
        return (
            <PlaygroundAssetForm
                assetType={activeTab}
                editingAsset={editingAsset}
                onClose={closeForm}
            />
        );
    }

    return (
        <div className="flex flex-col h-full">

            {/* ── HEADER ── */}
            <div className="px-4 py-4 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[#E50914]" />
                        <span className="text-[10px] font-mono text-[#E50914] uppercase tracking-[3px] font-bold">Assets</span>
                    </div>
                    <span className="text-[8px] font-mono text-[#444] uppercase tracking-[1px]">
                        {assetsLoading ? "…" : totalAssets}
                    </span>
                </div>
                <p className="text-[9px] text-[#555] font-mono uppercase tracking-[1px] mt-1">
                    {assetsLoading ? "Loading…" : `${totalAssets} asset${totalAssets !== 1 ? "s" : ""} available`}
                </p>
            </div>

            {/* ── TAB BAR ── */}
            <div className="flex border-b border-white/[0.06] shrink-0">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const count = tab.key === "characters" ? characters.length
                        : tab.key === "locations" ? locations.length
                        : products.length;
                    const TabIcon = tab.icon;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); closeForm(); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-all cursor-pointer border-b-2 ${
                                isActive
                                    ? "text-white border-current"
                                    : "text-[#555] border-transparent hover:text-white/70 hover:bg-white/[0.02]"
                            }`}
                            style={isActive ? { borderColor: tab.color, color: tab.color } : undefined}
                        >
                            <TabIcon size={10} />
                            <span className="text-[8px] font-bold uppercase tracking-[1.5px]">
                                {tab.label}
                            </span>
                            {count > 0 && (
                                <span className={`text-[7px] font-mono px-1 py-0 rounded ${
                                    isActive ? "bg-white/10" : "bg-white/[0.04] text-[#444]"
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── ADD BUTTON (top, always visible) ── */}
            <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
                <button
                    onClick={openCreateForm}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/[0.1] text-[9px] font-bold uppercase tracking-[2px] text-[#666] hover:text-white hover:border-white/25 hover:bg-white/[0.03] transition-all cursor-pointer"
                >
                    <Plus size={12} />
                    New {activeTabConfig.label.slice(0, -1)}
                </button>
            </div>

            {/* ── ASSET LIST ── */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1.5">

                {/* Loading state */}
                {assetsLoading && (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="animate-spin text-[#333]" size={18} />
                    </div>
                )}

                {/* Empty state */}
                {!assetsLoading && activeAssets.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] flex items-center justify-center mb-3">
                            <activeTabConfig.icon size={18} style={{ color: activeTabConfig.color, opacity: 0.3 }} />
                        </div>
                        <p className="text-[10px] text-[#444] uppercase tracking-widest font-semibold mb-1">
                            No {activeTab} yet
                        </p>
                        <p className="text-[9px] text-[#333] max-w-[160px] leading-relaxed">
                            Create your first {activeTab.slice(0, -1)} to use it in prompts with <span className="text-[#E50914] font-mono">@</span>
                        </p>
                    </div>
                )}

                {/* Asset cards */}
                {!assetsLoading && activeAssets.map((asset) => (
                    <PlaygroundAssetCard
                        key={asset.id}
                        asset={asset}
                        onEdit={openEditForm}
                    />
                ))}
            </div>
        </div>
    );
}
