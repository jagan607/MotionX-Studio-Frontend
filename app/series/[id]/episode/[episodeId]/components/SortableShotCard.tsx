"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from "lucide-react";

interface SortableShotCardProps {
    shot: { id: string };
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
        zIndex: isDragging ? 101 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={{ ...styles.shotCard, ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Drag Handle using Vertical Grip */}
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#444' }}>
                        <GripVertical size={16} />
                    </div>
                    <span style={{ color: '#FF0000', fontWeight: 'bold', fontSize: '12px' }}>SHOT {index + 1}</span>
                </div>
                <button onClick={() => onDelete(shot.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                </button>
            </div>
            {/* The ShotImage and other controls go here via children */}
            {children}
        </div>
    );
};