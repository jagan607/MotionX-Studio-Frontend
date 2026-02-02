import React from 'react';

interface TraitsTabProps {
    assetType: 'character' | 'location';
    editableName: string;                     // <--- NEW
    onNameChange: (val: string) => void;      // <--- NEW
    editableTraits: any;
    handleTraitChange: (key: string, value: string) => void;
}

export const TraitsTab: React.FC<TraitsTabProps> = ({
    assetType, editableTraits, handleTraitChange, editableName, onNameChange
}) => {

    // Define fields based on asset type
    const fields = assetType === 'location' ? [
        { k: 'terrain', l: 'TERRAIN', p: 'e.g. Indoor, Outdoor' },
        { k: 'atmosphere', l: 'ATMOSPHERE', p: 'e.g. Eerie, Tense' },
        { k: 'lighting', l: 'LIGHTING', p: 'e.g. Dim moonlight, Warm' },
        { k: 'visual_traits', l: 'VISUAL KEYWORDS', p: 'e.g. mist, fog, black water' },
    ] : [
        { k: 'age', l: 'AGE / ERA', p: 'e.g. 30s, Ancient' },
        { k: 'ethnicity', l: 'ETHNICITY', p: 'e.g. South Asian' },
        { k: 'hair', l: 'HAIR', p: 'e.g. Long, messy' },
        { k: 'clothing', l: 'CLOTHING', p: 'e.g. Dark cloak' },
        { k: 'vibe', l: 'VIBE', p: 'e.g. Mysterious' },
    ];

    const getDisplayValue = (key: string) => {
        const val = editableTraits[key];
        if (Array.isArray(val)) return val.join(', ');
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val || '';
    };

    return (
        <div className="w-full">
            <div className="grid grid-cols-2 gap-3 w-full p-0.5">

                {/* --- 1. ASSET NAME (Full Width) --- */}
                <div className="col-span-2">
                    <label className="block text-[9px] text-motion-red font-bold mb-1.5 tracking-wider uppercase">
                        Asset Name
                    </label>
                    <input
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2.5 text-white text-[11px] font-bold outline-none focus:border-motion-red transition-colors placeholder-[#444]"
                        placeholder="e.g. Spike, Old House"
                        value={editableName}
                        onChange={(e) => onNameChange(e.target.value)}
                    />
                </div>

                {/* --- 2. TRAIT FIELDS --- */}
                {fields.map((field: any) => (
                    <div
                        key={field.k}
                        className={field.k === 'visual_traits' || field.k === 'vibe' ? 'col-span-2' : ''}
                    >
                        <label className="block text-[9px] text-[#666] font-bold mb-1.5 tracking-wider uppercase">
                            {field.l}
                        </label>
                        <input
                            className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2.5 text-[#EEE] text-[11px] outline-none focus:border-[#555] transition-colors placeholder-[#444]"
                            placeholder={field.p}
                            value={getDisplayValue(field.k)}
                            onChange={(e) => handleTraitChange(field.k, e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};