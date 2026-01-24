"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of a media item
export interface MediaItem {
    id: string;
    type: 'image' | 'video' | 'mixed'; // mixed means it has both
    imageUrl?: string;
    videoUrl?: string;
    title?: string; // Optional: Shot ID or Scene Name
    description?: string; // Optional: Prompt text
}

interface MediaViewerContextType {
    isOpen: boolean;
    currentIndex: number;
    items: MediaItem[];
    openViewer: (items: MediaItem[], initialIndex?: number) => void;
    closeViewer: () => void;
    nextItem: () => void;
    prevItem: () => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

export const MediaViewerProvider = ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<MediaItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const openViewer = (newItems: MediaItem[], initialIndex = 0) => {
        setItems(newItems);
        setCurrentIndex(initialIndex);
        setIsOpen(true);
    };

    const closeViewer = () => {
        setIsOpen(false);
        setItems([]);
    };

    const nextItem = () => {
        if (currentIndex < items.length - 1) setCurrentIndex(prev => prev + 1);
    };

    const prevItem = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    return (
        <MediaViewerContext.Provider value={{ isOpen, currentIndex, items, openViewer, closeViewer, nextItem, prevItem }}>
            {children}
        </MediaViewerContext.Provider>
    );
};

export const useMediaViewer = () => {
    const context = useContext(MediaViewerContext);
    if (!context) throw new Error("useMediaViewer must be used within a MediaViewerProvider");
    return context;
};