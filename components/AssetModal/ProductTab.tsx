import React from 'react';
import { Tag, Layers, Palette, Target } from 'lucide-react';

interface ProductTabProps {
    editableName: string;
    onNameChange: (val: string) => void;

    // Flattened props for easy binding
    brandName: string;
    category: string;
    description: string;
    materials: string;
    colors: string;
    features: string;

    onChange: (field: string, value: string) => void;
}

export const ProductTab: React.FC<ProductTabProps> = ({
    editableName, onNameChange,
    brandName, category, description, materials, colors, features,
    onChange
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* 1. IDENTITY */}
            <div className="space-y-4">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Tag size={12} /> Core Identity
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase text-neutral-400 font-mono">Product Name</label>
                        <input
                            value={editableName}
                            onChange={(e) => onNameChange(e.target.value)}
                            className="w-full bg-[#111] border border-[#333] p-3 text-xs text-white focus:border-red-600 focus:outline-none transition-colors"
                            placeholder="e.g. Quantum X Sneaker"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase text-neutral-400 font-mono">Brand Name</label>
                        <input
                            value={brandName}
                            onChange={(e) => onChange('brandName', e.target.value)}
                            className="w-full bg-[#111] border border-[#333] p-3 text-xs text-white focus:border-red-600 focus:outline-none transition-colors"
                            placeholder="e.g. Athletix"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] uppercase text-neutral-400 font-mono">Category</label>
                    <input
                        value={category}
                        onChange={(e) => onChange('category', e.target.value)}
                        className="w-full bg-[#111] border border-[#333] p-3 text-xs text-white focus:border-red-600 focus:outline-none transition-colors"
                        placeholder="e.g. Footwear, Beverage, Tech..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] uppercase text-neutral-400 font-mono">Description <span className="text-neutral-600">(visual sourcing detail)</span></label>
                    <textarea
                        value={description}
                        onChange={(e) => onChange('description', e.target.value)}
                        className="w-full h-16 bg-[#111] border border-[#333] p-3 text-xs text-white focus:border-red-600 focus:outline-none transition-colors resize-none"
                        placeholder="e.g. A weathered steel machete with a leather-wrapped handle, blade nicked from heavy use..."
                    />
                </div>
            </div>

            {/* 2. VISUAL DNA */}
            <div className="space-y-4">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Palette size={12} /> Visual DNA
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] uppercase text-neutral-400 font-mono">Materials (Comma Separated)</label>
                    <input
                        value={materials}
                        onChange={(e) => onChange('materials', e.target.value)}
                        className="w-full bg-[#111] border border-[#333] p-3 text-xs text-white focus:border-red-600 focus:outline-none transition-colors"
                        placeholder="e.g. Leather, Brushed Steel, Neon Rubber..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] uppercase text-neutral-400 font-mono">Brand Colors (Hex or Name)</label>
                    <input
                        value={colors}
                        onChange={(e) => onChange('colors', e.target.value)}
                        className="w-full bg-[#111] border border-[#333] p-3 text-xs text-white focus:border-red-600 focus:outline-none transition-colors"
                        placeholder="e.g. #E50914, Matte Black, White..."
                    />
                </div>
            </div>

            {/* 3. MARKETING */}
            <div className="space-y-4">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Target size={12} /> Selling Points
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] uppercase text-neutral-400 font-mono">Key Features (Comma Separated)</label>
                    <textarea
                        value={features}
                        onChange={(e) => onChange('features', e.target.value)}
                        className="w-full h-20 bg-[#111] border border-[#333] p-3 text-xs text-white focus:border-red-600 focus:outline-none transition-colors resize-none"
                        placeholder="e.g. Waterproof, 24h Battery, Zero Sugar..."
                    />
                </div>
            </div>
        </div>
    );
};