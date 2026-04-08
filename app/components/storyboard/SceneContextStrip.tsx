import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Users, Loader2, Monitor, Palette, FileText, X, Sparkles } from 'lucide-react';
import { SceneMood } from '@/lib/types';

interface SceneContextStripProps {
    seriesName: string;
    episodeTitle: string;
    sceneNumber: string;
    summary: string;
    dialogues?: Array<{ speaker?: string; line?: string }>;
    locationName: string;
    timeOfDay: string;
    castList: string;
    aspectRatio: string;

    // Mood Props
    mood?: SceneMood;
    moodSource?: "scene" | "project" | "none";
    onEditMood?: () => void;

    // Actions
    onAutoDirect: (newSummary: string) => void;
    isAutoDirecting: boolean;
}

export const SceneContextStrip: React.FC<SceneContextStripProps> = ({
    seriesName,
    episodeTitle,
    sceneNumber,
    summary,
    dialogues,
    locationName,
    timeOfDay,
    castList,
    aspectRatio,
    mood,
    moodSource = "none",
    onEditMood,
    onAutoDirect,
    isAutoDirecting
}) => {
    const [showScreenplay, setShowScreenplay] = useState(false);
    const [editableText, setEditableText] = useState('');
    const [isEdited, setIsEdited] = useState(false);

    const hasDialogues = dialogues && dialogues.length > 0;
    const hasMood = mood && (mood.atmosphere || mood.color_palette || mood.lighting || mood.texture);

    // Build full screenplay when opening the panel
    const buildScreenplayText = () => {
        let text = summary || "";
        if (dialogues && dialogues.length > 0) {
            text += "\n";
            for (const dl of dialogues) {
                if (dl.speaker && dl.line) {
                    text += `\n${dl.speaker.toUpperCase()}\n${dl.line}\n`;
                }
            }
        }
        return text;
    };

    useEffect(() => {
        setEditableText(buildScreenplayText());
        setIsEdited(false);
    }, [summary, dialogues]);

    // Truncate summary for the compact preview
    const previewText = summary && summary.length > 160
        ? summary.substring(0, 160) + '…'
        : summary || '';

    return (
        <>
            {/* ─── COMPACT STRIP (always visible) ─── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                padding: '16px 0',
                borderBottom: '1px solid #1A1A1A',
                marginBottom: '16px',
                width: '100%'
            }}>
                {/* Scene Identity */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexShrink: 0 }}>
                    <div style={{
                        color: '#E50914',
                        fontFamily: 'Anton, sans-serif',
                        fontSize: '24px',
                        letterSpacing: '1px',
                        lineHeight: '1'
                    }}>
                        SCENE {sceneNumber}
                    </div>
                    <div style={{
                        color: '#666',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                        textTransform: 'uppercase'
                    }}>
                        {seriesName} / {episodeTitle}
                    </div>
                </div>

                {/* Synopsis Preview (clickable to open screenplay) */}
                <button
                    onClick={() => setShowScreenplay(true)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0',
                        textAlign: 'left',
                        minWidth: 0,
                    }}
                >
                    <FileText size={13} style={{ color: '#666', flexShrink: 0 }} />
                    <span style={{
                        fontSize: '12px',
                        color: '#B0B0B0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: '1.4',
                    }}>
                        {previewText}
                    </span>
                    {hasDialogues && (
                        <span style={{
                            fontSize: '8px',
                            color: 'rgba(34, 197, 94, 0.8)',
                            backgroundColor: 'rgba(34, 197, 94, 0.08)',
                            border: '1px solid rgba(34, 197, 94, 0.15)',
                            padding: '2px 7px',
                            borderRadius: '10px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}>
                            {dialogues!.length} DLG
                        </span>
                    )}
                </button>

                {/* Logistics Chips */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    {[
                        { icon: MapPin, value: locationName.toUpperCase() },
                        { icon: Clock, value: timeOfDay.toUpperCase() },
                        { icon: Users, value: castList.length > 25 ? castList.substring(0, 22).toUpperCase() + '…' : castList.toUpperCase() },
                        { icon: Monitor, value: aspectRatio || "16:9" },
                    ].map((chip, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#0A0A0A',
                            border: '1px solid #181818',
                            borderRadius: '3px',
                            padding: '4px 8px',
                            height: '26px'
                        }}>
                            <chip.icon size={9} color="#666" />
                            <span style={{
                                fontSize: '9px',
                                color: '#AAA',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '90px',
                                letterSpacing: '0.3px'
                            }}>
                                {chip.value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Mood (inline) */}
                {(hasMood || onEditMood) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <Palette size={10} style={{ color: '#b45309', opacity: 0.7 }} />
                        {moodSource === "project" && (
                            <span style={{
                                fontSize: '7px', fontWeight: 'bold',
                                color: 'rgba(96, 165, 250, 0.6)',
                                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                                border: '1px solid rgba(59, 130, 246, 0.12)',
                                padding: '2px 6px', borderRadius: '10px',
                                textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                PROJECT
                            </span>
                        )}
                        {moodSource === "scene" && (
                            <span style={{
                                fontSize: '7px', fontWeight: 'bold',
                                color: 'rgba(251, 191, 36, 0.6)',
                                backgroundColor: 'rgba(245, 158, 11, 0.06)',
                                border: '1px solid rgba(245, 158, 11, 0.12)',
                                padding: '2px 6px', borderRadius: '10px',
                                textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                CUSTOM
                            </span>
                        )}
                        {hasMood && (
                            <span style={{
                                fontSize: '10px', color: '#999', fontStyle: 'italic',
                                maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {mood.atmosphere || mood.color_palette || mood.lighting || ""}
                            </span>
                        )}
                        {onEditMood && (
                            <button
                                onClick={onEditMood}
                                style={{
                                    fontSize: '8px', fontWeight: 'bold', color: '#E50914',
                                    backgroundColor: 'transparent',
                                    border: '1px solid rgba(229, 9, 20, 0.15)',
                                    borderRadius: '3px', padding: '3px 8px',
                                    cursor: 'pointer', textTransform: 'uppercase',
                                    letterSpacing: '0.5px', transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(229, 9, 20, 0.06)';
                                    e.currentTarget.style.borderColor = 'rgba(229, 9, 20, 0.3)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = 'rgba(229, 9, 20, 0.15)';
                                }}
                            >
                                EDIT
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ─── SCREENPLAY SLIDE-DOWN PANEL ─── */}
            {showScreenplay && (
                <div style={{
                    width: '100%',
                    marginBottom: '16px',
                    backgroundColor: '#0A0A0A',
                    border: '1px solid #1A1A1A',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    {/* Panel Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: '1px solid #151515',
                        backgroundColor: '#080808'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={12} style={{ color: '#555' }} />
                            <span style={{
                                fontSize: '9px', fontWeight: 'bold',
                                color: '#999', letterSpacing: '1.5px',
                                textTransform: 'uppercase'
                            }}>
                                SCREENPLAY — SCENE {sceneNumber}
                            </span>
                            {hasDialogues && (
                                <span style={{
                                    fontSize: '8px',
                                    color: 'rgba(34, 197, 94, 0.8)',
                                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                                    border: '1px solid rgba(34, 197, 94, 0.15)',
                                    padding: '2px 8px', borderRadius: '10px',
                                    fontWeight: '700', letterSpacing: '0.5px'
                                }}>
                                    {dialogues!.length} DIALOGUE LINES
                                </span>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Re-direct button */}
                            {isEdited && (
                                <button
                                    onClick={() => { onAutoDirect(editableText); setShowScreenplay(false); }}
                                    disabled={isAutoDirecting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '4px 12px', fontSize: '9px', fontWeight: '700',
                                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        borderRadius: '4px', color: '#22c55e',
                                        cursor: 'pointer', textTransform: 'uppercase',
                                        letterSpacing: '0.5px', transition: 'all 0.2s'
                                    }}
                                >
                                    {isAutoDirecting
                                        ? <Loader2 size={11} className="animate-spin" />
                                        : <Sparkles size={11} />}
                                    RE-DIRECT WITH CHANGES
                                </button>
                            )}
                            <button
                                onClick={() => setShowScreenplay(false)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '24px', height: '24px',
                                    backgroundColor: 'transparent', border: '1px solid #222',
                                    borderRadius: '4px', color: '#555', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#999'; }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555'; }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Panel Body — Two Column: Action + Dialogue */}
                    <div style={{
                        display: 'flex',
                        gap: '0',
                        maxHeight: '300px',
                        overflowY: 'auto',
                    }}>
                        {/* Action Column */}
                        <div style={{
                            flex: hasDialogues ? '0 0 50%' : '1',
                            padding: '16px 20px',
                            borderRight: hasDialogues ? '1px solid #151515' : 'none',
                        }}>
                            <div style={{
                                fontSize: '8px', fontWeight: 'bold', color: '#777',
                                letterSpacing: '1.5px', textTransform: 'uppercase',
                                marginBottom: '10px'
                            }}>
                                ACTION
                            </div>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onInput={(e) => {
                                    const newAction = (e.target as HTMLDivElement).innerText;
                                    setIsEdited(newAction.trim() !== (summary || '').trim());
                                    // Rebuild full text
                                    let full = newAction;
                                    if (dialogues && dialogues.length > 0) {
                                        full += "\n";
                                        for (const dl of dialogues) {
                                            if (dl.speaker && dl.line) {
                                                full += `\n${dl.speaker.toUpperCase()}\n${dl.line}\n`;
                                            }
                                        }
                                    }
                                    setEditableText(full);
                                }}
                                style={{
                                    fontSize: '13px', color: '#CCC', lineHeight: '1.8',
                                    outline: 'none', minHeight: '60px',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {summary}
                            </div>
                        </div>

                        {/* Dialogue Column */}
                        {hasDialogues && (
                            <div style={{
                                flex: '0 0 50%',
                                padding: '16px 20px',
                                overflowY: 'auto',
                            }}>
                                <div style={{
                                    fontSize: '8px', fontWeight: 'bold', color: '#777',
                                    letterSpacing: '1.5px', textTransform: 'uppercase',
                                    marginBottom: '10px'
                                }}>
                                    DIALOGUE
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {dialogues!.map((dl, i) => (
                                        dl.speaker && dl.line ? (
                                            <div key={i}>
                                                <div style={{
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    color: '#E50914',
                                                    letterSpacing: '1px',
                                                    textTransform: 'uppercase',
                                                    marginBottom: '3px'
                                                }}>
                                                    {dl.speaker}
                                                </div>
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: '#BBB',
                                                    lineHeight: '1.6',
                                                    paddingLeft: '12px',
                                                    borderLeft: '2px solid #1A1A1A',
                                                    fontStyle: 'italic'
                                                }}>
                                                    {dl.line}
                                                </div>
                                            </div>
                                        ) : null
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};