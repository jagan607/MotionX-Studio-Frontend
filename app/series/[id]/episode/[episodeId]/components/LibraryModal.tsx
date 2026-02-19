"use client";

import { X, Plus, Check, Users, MapPin, Search } from "lucide-react";
import { useState } from "react";

interface LibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'character' | 'location';
    masterList: any[];      // All available assets in the Series
    currentList: any[];     // Assets already in this specific Episode
    onImport: (selectedIds: string[]) => void;
    styles: any;
}

export const LibraryModal = ({ isOpen, onClose, type, masterList, currentList, onImport, styles }: LibraryModalProps) => {
    if (!isOpen) return null;

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");

    // 1. Filter out items that are already in the episode
    // 2. Filter by search term
    const availableItems = masterList.filter(m => {
        const alreadyExists = currentList.some(c => c.id === m.id);
        const matchesSearch = m.name?.toLowerCase().includes(search.toLowerCase());
        return !alreadyExists && matchesSearch;
    });

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const handleImport = () => {
        onImport(Array.from(selected));
        onClose();
        setSelected(new Set()); // Reset selection
        setSearch("");
    };

    // --- LOCAL STYLES (Cyberpunk Theme) ---
    const modalStyles = {
        overlay: {
            position: 'fixed' as const, inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        },
        container: {
            width: '700px', maxHeight: '85vh',
            backgroundColor: '#050505',
            border: '1px solid #333',
            boxShadow: '0 0 50px rgba(0,0,0,0.8)',
            display: 'flex', flexDirection: 'column' as const,
            position: 'relative' as const
        },
        header: {
            padding: '25px 30px',
            borderBottom: '1px solid #222',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.02)'
        },
        searchBar: {
            padding: '15px 30px',
            borderBottom: '1px solid #222',
            backgroundColor: '#080808'
        },
        searchInput: {
            width: '100%', backgroundColor: '#111', border: '1px solid #222',
            color: 'white', padding: '12px 15px', paddingLeft: '40px',
            fontSize: '13px', outline: 'none', borderRadius: '4px'
        },
        list: {
            flex: 1, overflowY: 'auto' as const,
            padding: '30px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
            alignContent: 'start'
        },
        footer: {
            padding: '20px 30px',
            borderTop: '1px solid #222',
            display: 'flex', justifyContent: 'flex-end',
            backgroundColor: '#080808'
        }
    };

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.container}>

                {/* HEADER */}
                <div style={modalStyles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {type === 'character' ? <Users size={20} color="#E50914" /> : <MapPin size={20} color="#E50914" />}
                        <div>
                            <h2 style={{ fontFamily: 'Anton', fontSize: '20px', margin: 0, textTransform: 'uppercase', color: 'white' }}>
                                SERIES {type === 'character' ? 'CASTING' : 'LOCATIONS'}
                            </h2>
                            <div style={{ fontSize: '10px', color: '#666', letterSpacing: '1px' }}>MASTER LIBRARY</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><X size={20} /></button>
                </div>

                {/* SEARCH */}
                <div style={modalStyles.searchBar}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} color="#666" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            style={modalStyles.searchInput}
                            placeholder={`Search ${type}s...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* ASSET LIST */}
                <div style={modalStyles.list}>
                    {availableItems.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#444', padding: '40px', border: '1px dashed #222' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>NO NEW ASSETS FOUND</div>
                            <div style={{ fontSize: '10px', marginTop: '5px' }}>All series assets are already in this episode.</div>
                        </div>
                    ) : (
                        availableItems.map((item) => {
                            const isSelected = selected.has(item.id);
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => toggleSelect(item.id)}
                                    style={{
                                        border: isSelected ? '1px solid #E50914' : '1px solid #222',
                                        backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.05)' : '#0E0E0E',
                                        padding: '12px', borderRadius: '4px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        transition: 'all 0.1s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {/* Avatar / Thumbnail */}
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '4px',
                                            backgroundColor: '#222', overflow: 'hidden',
                                            backgroundImage: item.image_url ? `url(${item.image_url})` : 'none',
                                            backgroundSize: 'cover', backgroundPosition: 'center',
                                            border: '1px solid #333'
                                        }} />

                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '11px', color: isSelected ? '#FFF' : '#CCC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                                {item.name}
                                            </div>
                                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                                                {type === 'character'
                                                    ? (item.visual_traits?.age || 'Series Regular')
                                                    : (item.terrain || 'Location')}
                                            </div>
                                        </div>
                                    </div>
                                    {isSelected && <Check size={16} color="#E50914" />}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* FOOTER */}
                <div style={modalStyles.footer}>
                    <button
                        onClick={handleImport}
                        disabled={selected.size === 0}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: selected.size > 0 ? '#E50914' : '#222',
                            color: selected.size > 0 ? '#FFF' : '#444',
                            border: 'none',
                            fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px',
                            cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'all 0.2s', borderRadius: '2px'
                        }}
                    >
                        <Plus size={16} /> IMPORT SELECTED ({selected.size})
                    </button>
                </div>
            </div>
        </div>
    );
};