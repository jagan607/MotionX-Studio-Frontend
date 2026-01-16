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

    // Define fields based on type
    const fields = assetType === 'location' ? [
        { k: 'environment', l: 'ENVIRONMENT', p: 'e.g. Cave, Office' },
        { k: 'time_of_day', l: 'TIME OF DAY', p: 'e.g. Night, Golden Hour' },
        { k: 'architectural_style', l: 'ARCHITECTURE', p: 'e.g. Brutalist, Modern' },
        { k: 'lighting', l: 'LIGHTING', p: 'e.g. Neon, Dim' },
        { k: 'weather', l: 'WEATHER', p: 'e.g. Foggy, Clear' },
        { k: 'vibe', l: 'MOOD / VIBE', p: 'e.g. Ominous, Sterile' },
    ] : Object.entries(editableTraits).map(([k]) => ({ k, l: k.toUpperCase(), p: '' }));

    // If character traits are empty, show fallback
    if (assetType === 'character' && fields.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666', border: '1px dashed #333', borderRadius: '8px' }}>
                NO TRAITS DETECTED
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr', // Strict 2-column layout
                    gap: '12px',
                    width: '100%',
                    padding: '2px' // Prevent scrollbar clipping
                }}>
                    {fields.map((field: any) => (
                        <div key={field.k} style={{ minWidth: 0 }}> {/* minWidth 0 prevents grid blowout */}
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
                                    boxSizing: 'border-box' // CRITICAL FIX FOR OVERFLOW
                                }}
                                placeholder={field.p}
                                value={editableTraits[field.k] || ''}
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
                    {isSavingTraits ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {isSavingTraits ? "SAVING CONFIG..." : "UPDATE CONFIGURATION"}
                </button>
            </div>
        </div>
    );
};