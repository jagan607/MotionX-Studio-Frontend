import React from 'react';
import { Search, Play, Pause, Check, Loader2, Music } from 'lucide-react';
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px' }}>

            {/* AI SUGGESTION BANNER */}
            {voiceSuggestion && (
                <div style={{ padding: '10px 15px', backgroundColor: '#1a1a1a', borderRadius: '6px', borderLeft: '3px solid #FF4444' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#666', marginBottom: '2px', letterSpacing: '1px' }}>AI CASTING DIRECTOR SUGGESTION</div>
                    <div style={{ fontSize: '12px', color: '#DDD', fontStyle: 'italic' }}>"{voiceSuggestion}"</div>
                </div>
            )}

            {/* SEARCH BAR */}
            <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input
                    placeholder="Search voice styles (e.g. Deep, British, Excited)..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '10px 10px 10px 35px', backgroundColor: '#050505',
                        border: '1px solid #222', borderRadius: '6px', color: 'white', fontSize: '12px', outline: 'none'
                    }}
                />
            </div>

            {/* VOICE LIST */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #222', borderRadius: '6px', backgroundColor: '#050505' }}>
                {isLoadingVoices ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: '10px' }}>
                        <Loader2 className="force-spin" size={24} />
                        <div style={{ fontSize: '10px' }}>FETCHING ELEVENLABS VOICES...</div>
                    </div>
                ) : filteredVoices.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '11px' }}>No voices found matching "{voiceSearch}"</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredVoices.map((voice) => {
                            const isSelected = selectedVoiceId === voice.voice_id;
                            const isPlaying = playingVoiceId === voice.voice_id;

                            return (
                                <div
                                    key={voice.voice_id}
                                    onClick={() => setSelectedVoiceId(voice.voice_id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 15px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer',
                                        backgroundColor: isSelected ? '#151515' : 'transparent',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div
                                            onClick={(e) => { e.stopPropagation(); handlePlayPreview(voice.preview_url, voice.voice_id); }}
                                            style={{
                                                width: '28px', height: '28px', borderRadius: '50%', backgroundColor: isPlaying ? '#FF4444' : '#222',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >
                                            {isPlaying ? <Pause size={12} color="white" /> : <Play size={12} color={isSelected ? "white" : "#666"} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', color: isSelected ? 'white' : '#CCC', fontWeight: isSelected ? 'bold' : 'normal' }}>
                                                {voice.name}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                                                {voice.labels ? Object.values(voice.labels).slice(0, 3).join(" • ") : "Generic"}
                                            </div>
                                        </div>
                                    </div>
                                    {isSelected && <Check size={16} color="#FF4444" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ACTION FOOTER */}
            <div style={{ paddingTop: '10px' }}>
                <button
                    onClick={handleVoiceSelection}
                    disabled={linkBtnState.disabled}
                    style={{
                        width: '100%', padding: '12px', backgroundColor: linkBtnState.disabled ? '#222' : '#FFF',
                        color: linkBtnState.disabled ? '#555' : '#000', border: 'none', borderRadius: '4px',
                        fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px',
                        cursor: linkBtnState.disabled ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                >
                    {isLinkingVoice ? <Loader2 className="force-spin" size={14} /> : <Music size={14} />}
                    {linkBtnState.text}
                </button>
            </div>
        </div>
    );
};