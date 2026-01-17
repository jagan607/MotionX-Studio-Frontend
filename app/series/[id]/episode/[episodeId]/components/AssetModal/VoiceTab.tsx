import React from 'react';
import { Search, Loader2, Play, Square, Check, Mic, Info } from 'lucide-react';
import { Voice } from '@/lib/elevenLabs';

interface VoiceTabProps {
    voiceSuggestion?: string;
    voiceSearch: string;
    setVoiceSearch: (s: string) => void;
    isLoadingVoices: boolean;
    filteredVoices: Voice[];
    selectedVoiceId: string | null;
    setSelectedVoiceId: (id: string) => void;
    playingVoiceId: string | null;
    handlePlayPreview: (url: string, id: string) => void;
    handleVoiceSelection: () => void;
    linkBtnState: { text: string; disabled: boolean };
    isLinkingVoice: boolean;
    styles: any;
}

export const VoiceTab: React.FC<VoiceTabProps> = ({
    voiceSuggestion, voiceSearch, setVoiceSearch, isLoadingVoices, filteredVoices,
    selectedVoiceId, setSelectedVoiceId, playingVoiceId, handlePlayPreview,
    handleVoiceSelection, linkBtnState, isLinkingVoice, styles
}) => {
    return (
        <div style={{ animation: 'fadeIn 0.3s ease', height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* AI VOICE SUGGESTION BOX */}
            {voiceSuggestion && (
                <div style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #222',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '15px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start'
                }}>
                    <Info size={16} color="#FF0000" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '1px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                            AI ANALYSIS SUGGESTION
                        </div>
                        <div style={{ fontSize: '12px', color: '#CCC', fontStyle: 'italic', lineHeight: '1.4' }}>
                            "{voiceSuggestion}"
                        </div>
                    </div>
                </div>
            )}

            {/* SEARCH BOX */}
            <div style={{ position: 'relative', marginBottom: '15px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input
                    type="text"
                    placeholder="Search voice library..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 38px', backgroundColor: '#0a0a0a', color: 'white', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                />
            </div>

            {/* VOICE LIST */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', marginBottom: '15px' }}>
                {isLoadingVoices ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#666' }}>
                        {/* Using force-spin for consistent library loading */}
                        <Loader2 className="force-spin" size={24} />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                        {filteredVoices.map(voice => (
                            <div key={voice.voice_id} onClick={() => setSelectedVoiceId(voice.voice_id)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px',
                                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                    backgroundColor: selectedVoiceId === voice.voice_id ? '#1a1a1a' : '#0a0a0a',
                                    border: selectedVoiceId === voice.voice_id ? '1px solid #FF0000' : '1px solid #222'
                                }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#EEE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {voice.name}
                                        {selectedVoiceId === voice.voice_id && <Check size={14} color="#FF0000" />}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                        {voice.labels?.accent && <span style={styles.tag}>{voice.labels.accent}</span>}
                                        {voice.labels?.age && <span style={styles.tag}>{voice.labels.age}</span>}
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handlePlayPreview(voice.preview_url, voice.voice_id); }}
                                    style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #333', backgroundColor: playingVoiceId === voice.voice_id ? '#FF0000' : 'transparent', color: playingVoiceId === voice.voice_id ? 'white' : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    {playingVoiceId === voice.voice_id ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ACTION BUTTON */}
            <button
                style={{ ...styles.primaryBtn, width: '100%', opacity: linkBtnState.disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                disabled={linkBtnState.disabled}
                onClick={handleVoiceSelection}
            >
                {/* Fixed: Icon now spins until isLinkingVoice becomes false */}
                {isLinkingVoice ? (
                    <Loader2 className="force-spin" size={16} />
                ) : (
                    <Mic size={16} />
                )}
                <span>{isLinkingVoice ? "LINKING..." : linkBtnState.text}</span>
            </button>
        </div>
    );
};