"use client";

import { User, Loader2, LogOut } from "lucide-react";

interface SettingsTabProps {
    user: any;
    displayName: string;
    setDisplayName: (value: string) => void;
    handleUpdateProfile: () => void;
    handleLogout: () => void;
    isSaving: boolean;
}

export default function SettingsTab({
    user,
    displayName,
    setDisplayName,
    handleUpdateProfile,
    handleLogout,
    isSaving
}: SettingsTabProps) {

    // --- STYLES ---
    const styles = {
        card: {
            backgroundColor: '#0A0A0A',
            border: '1px solid #222',
            padding: '24px', // Compact padding
            marginTop: '20px', // Compact margin
            position: 'relative' as const
        },
        sectionTitle: {
            fontFamily: 'Anton, sans-serif',
            fontSize: '20px', // Reduced font size
            textTransform: 'uppercase' as const,
            marginBottom: '20px',
            color: '#EDEDED'
        },
        inputGroup: {
            marginBottom: '20px'
        },
        label: {
            display: 'block',
            fontFamily: 'monospace',
            fontSize: '9px', // Smaller label
            color: '#666',
            marginBottom: '6px',
            textTransform: 'uppercase' as const
        },
        input: {
            width: '100%',
            backgroundColor: '#050505',
            border: '1px solid #333',
            padding: '10px 12px', // Tighter padding
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '12px', // Smaller input font
            outline: 'none',
            transition: 'border-color 0.2s'
        },
        saveBtn: {
            backgroundColor: '#FFF',
            color: '#000',
            padding: '10px 20px',
            border: 'none',
            fontWeight: 'bold' as const,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            marginTop: '5px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'monospace',
            opacity: isSaving ? 0.7 : 1
        },
        dangerBtn: {
            border: '1px solid #333', // Milder border (was #330000)
            color: '#EF4444', // Softer Red
            backgroundColor: 'transparent',
            padding: '10px 20px',
            fontSize: '11px',
            fontWeight: 'bold' as const,
            fontFamily: 'monospace',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <style jsx>{`
                input:focus {
                    border-color: #666 !important;
                }
                .danger-btn:hover {
                    background-color: #1A0505 !important;
                    border-color: #FF0000 !important;
                }
            `}</style>

            {/* IDENTITY CARD */}
            <div style={styles.card}>
                <h2 style={styles.sectionTitle}>Operator Identity</h2>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>DISPLAY NAME</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        style={styles.input}
                        placeholder="ENTER CALLSIGN"
                        disabled={isSaving}
                    />
                </div>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>EMAIL ADDRESS (LOCKED)</label>
                    <input
                        type="text"
                        value={user?.email || ""}
                        disabled
                        style={{ ...styles.input, opacity: 0.5, cursor: 'not-allowed' }}
                    />
                </div>

                <button
                    onClick={handleUpdateProfile}
                    disabled={isSaving}
                    style={styles.saveBtn}
                >
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <User size={14} />}
                    {isSaving ? "SAVING..." : "UPDATE IDENTITY"}
                </button>
            </div>

            {/* DANGER ZONE CARD */}
            {/* Removed the red border color to "mild" it down */}
            <div style={styles.card}>
                {/* Kept title red but slightly softer hue or kept standard red */}
                <h2 style={{ ...styles.sectionTitle, color: '#EF4444' }}>Danger Zone</h2>
                <p className="text-[10px] text-gray-500 font-mono mb-4">
                    TERMINATING YOUR SESSION WILL REQUIRE RE-AUTHENTICATION.
                </p>
                <button
                    onClick={handleLogout}
                    className="danger-btn"
                    style={styles.dangerBtn}
                >
                    <LogOut size={14} /> TERMINATE SESSION
                </button>
            </div>
        </div>
    );
}