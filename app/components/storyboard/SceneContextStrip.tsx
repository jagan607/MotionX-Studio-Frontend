import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Users, Sparkles, Loader2, Monitor } from 'lucide-react';

interface SceneContextStripProps {
    seriesName: string;
    episodeTitle: string;
    sceneNumber: string;
    summary: string;
    locationName: string;
    timeOfDay: string;
    castList: string;
    aspectRatio: string; // New prop for Aspect Ratio

    // Actions
    onAutoDirect: (newSummary: string) => void;
    isAutoDirecting: boolean;
}

// --- HELPER COMPONENT FOR LOGISTICS ---
const LogisticsChip = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
        <span style={{
            fontSize: '9px',
            fontWeight: 'bold',
            color: '#555',
            marginBottom: '6px',
            letterSpacing: '1px',
            textTransform: 'uppercase'
        }}>
            {label}
        </span>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#050505',
            border: '1px solid #222',
            borderRadius: '4px',
            padding: '4px 10px',
            height: '38px'
        }}>
            <Icon size={12} color="#666" />
            <span style={{
                fontSize: '11px',
                color: '#ccc',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px'
            }}>
                {value}
            </span>
        </div>
    </div>
);

export const SceneContextStrip: React.FC<SceneContextStripProps> = ({
    seriesName,
    episodeTitle,
    sceneNumber,
    summary,
    locationName,
    timeOfDay,
    castList,
    aspectRatio,
    onAutoDirect,
    isAutoDirecting
}) => {
    const [localText, setLocalText] = useState(summary || "");
    const [isFocused, setIsFocused] = useState(false);

    // Sync local state if parent prop changes
    useEffect(() => {
        setLocalText(summary || "");
    }, [summary]);

    const hasChanged = localText.trim() !== (summary || "").trim();
    const showAction = hasChanged || isAutoDirecting;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '30px',
            padding: '20px 0', // Vertical padding only, horiz handled by parent margin
            borderBottom: '1px solid #222',
            marginBottom: '20px',
            width: '100%'
        }}>
            {/* 1. IDENTITY BLOCK */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', paddingTop: '4px' }}>
                <div style={{ color: '#666', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {seriesName} <span style={{ color: '#444' }}>/</span> {episodeTitle}
                </div>
                <div style={{ color: '#FF0000', fontFamily: 'Anton, sans-serif', fontSize: '32px', letterSpacing: '1px', lineHeight: '1' }}>
                    SCENE {sceneNumber}
                </div>
            </div>

            {/* 2. EDITABLE SUMMARY (Now fills available space) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#555', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    SCENE SUMMARY
                </label>

                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start', // Align text to top
                    backgroundColor: '#050505',
                    border: isFocused ? '1px solid #555' : '1px solid #222',
                    borderRadius: '4px',
                    padding: '10px',
                    transition: 'border-color 0.2s',
                    minHeight: '40px',
                    width: '100%'
                }}>
                    <textarea
                        value={localText}
                        onChange={(e) => setLocalText(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Describe scene action here..."
                        style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: hasChanged ? '#fff' : '#aaa',
                            fontSize: '13px',
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit',
                            lineHeight: '1.5',
                            height: '100%', // Take full height
                            minHeight: '20px',
                            padding: '0',
                            margin: '0'
                        }}
                    />

                    {/* DYNAMIC ACTION BUTTON */}
                    <div style={{
                        width: showAction ? '32px' : '0px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        marginLeft: showAction ? '10px' : '0px',
                        opacity: showAction ? 1 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '24px' // Align with first line of text
                    }}>
                        <button
                            onClick={() => onAutoDirect(localText)}
                            disabled={isAutoDirecting}
                            title="Update Suggestions based on new summary"
                            style={{
                                padding: '5px',
                                backgroundColor: isAutoDirecting ? '#222' : 'rgba(34, 197, 94, 0.15)',
                                border: isAutoDirecting ? '1px solid #333' : '1px solid #22c55e',
                                borderRadius: '3px',
                                color: '#22c55e',
                                cursor: isAutoDirecting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '24px',
                                minHeight: '24px'
                            }}
                        >
                            {isAutoDirecting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. LOGISTICS TAGS (Right Aligned) */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexShrink: 0 }}>
                <LogisticsChip label="LOCATION" value={locationName.toUpperCase()} icon={MapPin} />
                <LogisticsChip label="TIME" value={timeOfDay.toUpperCase()} icon={Clock} />
                <LogisticsChip label="CASTING" value={castList.toUpperCase()} icon={Users} />
                <LogisticsChip label="ASPECT" value={aspectRatio || "16:9"} icon={Monitor} />
            </div>
        </div>
    );
};