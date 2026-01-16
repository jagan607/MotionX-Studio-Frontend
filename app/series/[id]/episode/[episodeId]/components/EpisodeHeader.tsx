import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutTemplate, Users, MapPin } from 'lucide-react';

interface EpisodeHeaderProps {
    seriesId: string;
    episodeTitle: string;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    castCount: number;
    locCount: number;
    styles: any;
}

export const EpisodeHeader: React.FC<EpisodeHeaderProps> = ({
    seriesId,
    episodeTitle,
    activeTab,
    setActiveTab,
    castCount,
    locCount,
    styles
}) => {
    return (
        <>
            {/* --- TOP NAV --- */}
            <div style={styles.topNav}>
                <Link href={`/series/${seriesId}`} style={styles.backLink}>
                    <ArrowLeft size={14} /> BACK TO EPISODES
                </Link>
                <div style={{ fontSize: '12px', color: '#444' }}>MOTION X STUDIO</div>
            </div>

            {/* --- HEADER BLOCK --- */}
            <div style={styles.header}>
                <div style={styles.titleBlock}>
                    <h1 style={styles.title}>{episodeTitle || 'UNTITLED'}</h1>
                    <p style={styles.subtitle}>PHASE 2: ASSET LAB</p>
                </div>

                <div style={styles.tabRow} id="tour-assets-target">
                    <div style={styles.tabBtn(activeTab === 'scenes')} onClick={() => setActiveTab('scenes')}>
                        <LayoutTemplate size={16} /> SCENES
                    </div>
                    <div style={styles.tabBtn(activeTab === 'casting')} onClick={() => setActiveTab('casting')}>
                        <Users size={16} /> CASTING ({castCount})
                    </div>
                    <div style={styles.tabBtn(activeTab === 'locations')} onClick={() => setActiveTab('locations')}>
                        <MapPin size={16} /> LOCATIONS ({locCount})
                    </div>
                </div>
            </div>
        </>
    );
};