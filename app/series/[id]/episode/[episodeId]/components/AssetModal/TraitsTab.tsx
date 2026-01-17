import React from 'react';
import { Loader2, Save } from 'lucide-react';

interface TraitsTabProps {
    assetType: 'character' | 'location';
    editableTraits: any;
    handleTraitChange: (key: string, value: string) => void;
    handleSaveTraits: () => void;
    isSavingTraits: boolean;
    styles: any;
}

export const TraitsTab: React.FC<TraitsTabProps> = ({
    assetType, editableTraits, handleTraitChange, handleSaveTraits, isSavingTraits, styles
}) => {

    // Define fields based on the new AI response schema
    const fields = assetType === 'location' ? [
        { k: 'terrain', l: 'TERRAIN', p: 'e.g. Indoor, Outdoor' },
        { k: 'atmosphere', l: 'ATMOSPHERE', p: 'e.g. Eerie, Tense' },
        { k: 'lighting', l: 'LIGHTING', p: 'e.g. Dim moonlight, Warm' },
        // Visual keywords are flatted from array to string for editing
        { k: 'visual_traits', l: 'VISUAL KEYWORDS', p: 'e.g. mist, fog, black water' },
    ] : [
        { k: 'age', l: 'AGE / ERA', p: 'e.g. 30s, Ancient' },
        { k: 'ethnicity', l: 'ETHNICITY', p: 'e.g. South Asian' },
        { k: 'hair', l: 'HAIR', p: 'e.g. Long, messy' },
        { k: 'clothing', l: 'CLOTHING', p: 'e.g. Dark cloak' },
        { k: 'vibe', l: 'VIBE', p: 'e.g. Mysterious' },
    ];

    // Helper to handle displaying array data in a text input
    const getDisplayValue = (key: string) => {
        const val = editableTraits[key];
        // Ensure visual_traits array is joined by commas for the input field
        if (Array.isArray(val)) return val.join(', ');
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val || '';
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    width: '100%',
                    padding: '2px'
                }}>
                    {fields.map((field: any) => (
                        <div key={field.k} style={{ minWidth: 0, gridColumn: field.k === 'visual_traits' ? 'span 2' : 'auto' }}>
                            <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px' }}>
                                {field.l}
                            </label>
                            <input
                                style={{
                                    width: '100%',
                                    backgroundColor: '#0a0a0a',
                                    border: '1px solid #333',
                                    borderRadius: '4px',
                                    color: '#EEE',
                                    fontSize: '11px',
                                    padding: '10px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                placeholder={field.p}
                                value={getDisplayValue(field.k)}
                                onChange={(e) => handleTraitChange(field.k, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #222' }}>
                <button
                    style={{ ...styles.primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                    onClick={handleSaveTraits}
                    disabled={isSavingTraits}
                >
                    {/* Fixed: Icon now spins continuously during the save process */}
                    {isSavingTraits ? <Loader2 className="force-spin" size={16} /> : <Save size={16} />}
                    {isSavingTraits ? "SAVING CONFIG..." : "UPDATE CONFIGURATION"}
                </button>
            </div>
        </div>
    );
};