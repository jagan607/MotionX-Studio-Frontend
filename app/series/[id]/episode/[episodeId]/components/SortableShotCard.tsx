"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from "lucide-react";

interface SortableShotCardProps {
    shot: { id: string; visual_action?: string; shot_type?: string }; // Updated Interface
    index: number;
    styles: any;
    onDelete: (id: string) => void;
    children: React.ReactNode;
}

export const SortableShotCard = ({ shot, index, styles, onDelete, children }: SortableShotCardProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        // Improved Z-Index management for overlapping cards during drag
        zIndex: isDragging ? 1000 : 1,
        opacity: isDragging ? 0.6 : 1,
        // Add a subtle border or scale if dragging to improve visual feedback
        transformOrigin: "0 0",
        scale: isDragging ? "1.02" : "1",
    };

    return (
        <div ref={setNodeRef} style={{ ...styles.shotCard, ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Drag Handle using Vertical Grip */}
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#666', padding: '4px' }}>
                        <GripVertical size={18} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#FF0000', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                            SHOT {String(index + 1).padStart(2, '0')}
                        </span>
                        {/* Sub-label showing the ID for internal tracking */}
                        <span style={{ fontSize: '8px', color: '#444', fontFamily: 'monospace' }}>{shot.id.toUpperCase()}</span>
                    </div>
                </div>

                <button
                    onClick={() => onDelete(shot.id)}
                    style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#FF0000')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* The ShotImage, Visual Action Textarea, and Select Dropdowns rendered here */}
            <div style={{ position: 'relative' }}>
                {children}
            </div>
        </div>
    );
};