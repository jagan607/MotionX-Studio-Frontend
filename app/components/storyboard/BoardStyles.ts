// app/[id]/[episodeId]/components/BoardStyles.ts

export const styles = {
    // --- MAIN CONTAINER ---
    container: { minHeight: '100vh', backgroundColor: '#050505', color: '#EDEDED', fontFamily: 'Inter, sans-serif', padding: '40px' },
    topNav: { display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'center' },
    backLink: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '11px', fontWeight: 'bold' as const, letterSpacing: '2px', textDecoration: 'none' },

    // --- MAIN PAGE HEADER (Not Overlay) ---
    header: { marginBottom: '40px', borderBottom: '1px solid #222', paddingBottom: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
    titleBlock: { paddingBottom: '30px' },
    title: { fontFamily: 'Anton, sans-serif', fontSize: '48px', textTransform: 'uppercase' as const, color: '#FFF' },
    subtitle: { fontSize: '12px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' as const, marginTop: '10px' },
    tabRow: { display: 'flex', gap: '40px' },
    tabBtn: (isActive: boolean) => ({ paddingBottom: '30px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', color: isActive ? '#E50914' : '#666', borderBottom: isActive ? '3px solid #E50914' : '3px solid transparent', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: '8px' }),

    // --- GRID LAYOUTS ---
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '30px' },

    // --- SCENE CARD STYLES ---
    card: {
        backgroundColor: '#0A0A0A',
        border: '1px solid #1F1F1F',
        padding: '25px',
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '15px',
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        cursor: 'default'
    },
    sceneCardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #222',
        paddingBottom: '10px',
        marginBottom: '5px'
    },
    sceneNumber: {
        color: '#FFF',
        fontSize: '12px',
        fontWeight: 'bold' as const,
        letterSpacing: '1px',
        fontFamily: 'Anton, sans-serif',
        opacity: 0.8
    },
    sceneSummary: {
        fontSize: '13px',
        lineHeight: '1.5',
        color: '#CCC',
        minHeight: '40px'
    },
    compactRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '11px',
        color: '#888',
        borderTop: '1px solid #1a1a1a',
        paddingTop: '15px'
    },
    locationText: {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontWeight: '600' as const,
        color: '#BBB',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px'
    },
    timeBadge: {
        fontSize: '9px',
        fontWeight: 'bold' as const,
        padding: '2px 6px',
        borderRadius: '3px',
        backgroundColor: '#1a1a1a',
        color: '#666',
        border: '1px solid #333',
        textTransform: 'uppercase' as const,
        marginLeft: 'auto'
    },
    charTagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '6px' },
    charTag: {
        fontSize: '10px',
        backgroundColor: '#0F0F0F',
        color: '#777',
        border: '1px solid #222',
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: '500' as const
    },
    openBtn: {
        marginTop: '10px',
        width: '100%',
        padding: '12px',
        backgroundColor: '#161616',
        color: '#FFF',
        border: '1px solid #2a2a2a',
        fontSize: '10px',
        fontWeight: 'bold' as const,
        letterSpacing: '1.5px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
        borderRadius: '4px'
    },

    // --- STORYBOARD OVERLAY (UPDATED FOR PRO UI) ---

    // 1. Overlay Container (Removed padding to allow full-width header)
    sbOverlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#050505',
        zIndex: 100,
        paddingLeft: '0',
        paddingRight: '0',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden' // Important so the scroll happens inside the content area
    },

    // 2. Pro Header (Sticky, Edge-to-Edge)
    sbHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '80px', // Fixed height for pro feel
        padding: '0 32px', // Internal padding
        backgroundColor: '#050505',
        borderBottom: '1px solid #1A1A1A',
        position: 'sticky' as const,
        top: 0,
        zIndex: 100,
        gap: '24px',
        flexShrink: 0 // Prevent header from shrinking
    },

    // 3. New Header Components
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '24px'
    },
    headerTitle: {
        fontFamily: 'Anton, sans-serif',
        fontSize: '28px',
        letterSpacing: '1px',
        color: '#fff',
        textTransform: 'uppercase' as const,
        margin: 0,
        lineHeight: 1
    },
    headerStats: {
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        padding: '0 32px',
        borderLeft: '1px solid #222',
        borderRight: '1px solid #222',
        height: '40px'
    },
    statItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    statLabel: {
        fontSize: '10px',
        fontWeight: 700,
        color: '#555',
        letterSpacing: '0.5px',
        textTransform: 'uppercase' as const
    },
    statValueBox: {
        backgroundColor: '#111',
        border: '1px solid #2A2A2A',
        borderRadius: '6px',
        padding: '6px 12px',
        color: '#FFF',
        fontSize: '13px',
        fontWeight: 600,
        minWidth: '60px',
        textAlign: 'center' as const
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    btnSecondary: {
        height: '40px',
        padding: '0 20px',
        backgroundColor: '#1A1A1A',
        color: '#EEE',
        border: '1px solid #333',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease'
    },
    btnPrimary: {
        height: '40px',
        padding: '0 24px',
        backgroundColor: '#FFF',
        color: '#000',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    verticalDivider: {
        width: '1px',
        height: '24px',
        backgroundColor: '#222'
    },
    infoBox: { display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid #333', paddingRight: '20px', marginRight: '20px' }, // Legacy support

    // --- SHOT GRID ---
    sbGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', padding: '0 20px 40px 20px' },

    // --- SHOT CARD ---
    shotCard: { backgroundColor: '#0E0E0E', border: '1px solid #222', padding: '20px' },
    shotImageContainer: { position: 'relative' as const, width: '100%', height: '180px', marginBottom: '15px', border: '1px solid #222', backgroundColor: '#000', overflow: 'hidden' },
    shotImagePlaceholder: { position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', zIndex: 2 },
    label: { fontSize: '10px', fontWeight: 'bold' as const, color: '#666', marginBottom: '5px', display: 'block', letterSpacing: '1px' },

    // --- INPUTS & BUTTONS INSIDE SHOTS ---
    select: { width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '12px', marginBottom: '15px', outline: 'none' },
    textArea: { width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '12px', marginBottom: '15px', minHeight: '80px', resize: 'none' as const },
    renderBtn: { width: '100%', backgroundColor: '#E50914', color: 'white', border: 'none', padding: '12px', fontSize: '11px', fontWeight: 'bold' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    renderBtnLoading: { width: '100%', backgroundColor: '#FFF', color: 'black', border: 'none', padding: '12px', fontSize: '11px', fontWeight: 'bold' as const, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    charToggle: (active: boolean) => ({ fontSize: '10px', padding: '6px 12px', border: '1px solid #333', backgroundColor: active ? '#E50914' : 'transparent', color: active ? 'white' : '#666', cursor: 'pointer', marginRight: '5px', marginBottom: '5px' }),

    // --- ASSETS ---
    assetCard: { backgroundColor: '#0A0A0A', border: '1px solid #222', padding: '0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', overflow: 'hidden' },
    assetImage: { width: '100%', height: '300px', objectFit: 'cover' as const, backgroundColor: '#111' },
    assetPlaceholder: { width: '100%', height: '300px', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' },
    assetName: { padding: '20px', fontFamily: 'Anton, sans-serif', fontSize: '24px', color: '#FFF', textAlign: 'center' as const, width: '100%', textTransform: 'uppercase' as const },
    genBtn: { width: '100%', padding: '15px', backgroundColor: '#222', color: '#FFF', border: 'none', fontWeight: 'bold' as const, cursor: 'pointer', fontSize: '11px', letterSpacing: '2px', borderTop: '1px solid #333' },

    // --- UTILS & OVERLAYS ---
    terminalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 5, 0.98)', zIndex: 999, display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', padding: '100px' },
    terminalBox: { borderLeft: '2px solid #E50914', paddingLeft: '30px', color: '#FFF', fontFamily: 'monospace', fontSize: '16px' },
    terminalLine: { marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', letterSpacing: '2px' },
    zoomOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
    zoomImg: { maxWidth: '90%', maxHeight: '90%', border: '1px solid #333', boxShadow: '0 0 50px rgba(0,0,0,0.8)' },

    // --- LEGACY / MODAL ---
    sceneHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '10px' },
    metaTag: { fontSize: '10px', backgroundColor: '#222', padding: '2px 6px', borderRadius: '4px', color: '#888' },
    locRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' as const, marginBottom: '15px', color: '#FFF' },
    actionText: { fontSize: '14px', lineHeight: '1.6', color: '#CCC', marginBottom: '20px', minHeight: '80px' },
    modal: { width: '600px', backgroundColor: '#0A0A0A', border: '1px solid #333', padding: '0px' },
    modalTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '10px', color: 'white' },
    modalSub: { fontSize: '12px', color: '#666', marginBottom: '30px' },
    promptBox: { backgroundColor: '#0F0F0F', border: '1px solid #333', borderRadius: '6px', marginBottom: '15px', overflow: 'hidden' },
    promptHeader: { backgroundColor: '#1a1a1a', padding: '8px 12px', borderBottom: '1px solid #333', fontSize: '10px', fontWeight: 'bold' as const, color: '#888', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    promptInput: { width: '100%', backgroundColor: '#0F0F0F', border: 'none', padding: '12px', color: '#00FF00', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6', resize: 'vertical' as const, minHeight: '80px', outline: 'none', boxSizing: 'border-box' as const },
    actionToolbar: { display: 'flex', gap: '10px' },
    actionBtn: (active: boolean) => ({ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: active ? '#FFF' : '#888', padding: '4px 8px', border: '1px solid #333', backgroundColor: active ? '#222' : 'transparent', borderRadius: '4px' }),
    toggleRow: { display: 'flex', marginBottom: '30px', borderBottom: '1px solid #222' },
    toggleBtn: (active: boolean) => ({ flex: 1, padding: '15px', textAlign: 'center' as const, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '1px', color: active ? 'white' : '#444', borderBottom: active ? '2px solid #E50914' : 'none' }),
    uploadBox: { border: '1px dashed #333', padding: '50px', textAlign: 'center' as const, color: '#666', cursor: 'pointer', marginBottom: '20px' },
    textareaInput: { width: '100%', backgroundColor: '#111', border: '1px solid #333', padding: '15px', color: '#EEE', fontSize: '14px', marginBottom: '20px', resize: 'none' as const },
    primaryBtn: { width: '100%', padding: '20px', backgroundColor: '#E50914', color: 'white', border: 'none', fontWeight: 'bold' as const, cursor: 'pointer', letterSpacing: '2px', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' },
};