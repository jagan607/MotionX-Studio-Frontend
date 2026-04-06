"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

export interface MentionItem {
    tag: string;            // e.g. "@video1"
    type: 'image' | 'video' | 'audio';
    url: string;
    name: string;
    locked?: boolean;
}

interface UsePromptMentionOptions {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    items: MentionItem[];
    enabled: boolean;
}

interface MenuPosition {
    top: number;
    left: number;
}

export interface UsePromptMentionReturn {
    isOpen: boolean;
    filteredItems: MentionItem[];
    activeIndex: number;
    menuPosition: MenuPosition;
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    handleChange: (value: string, cursorPos?: number) => void;
    handleBlur: () => void;
    insertTag: (tag: string) => void;
    close: () => void;
}

// ── Regex to detect "@partial" behind the cursor ──
const MENTION_TRIGGER = /@(\w*)$/;

/**
 * Compute the pixel position of the cursor inside a textarea using a hidden mirror div.
 * Accounts for the textarea's scrollTop to keep the menu anchored correctly.
 */
function getCursorPixelPosition(
    textarea: HTMLTextAreaElement,
    triggerIndex: number
): MenuPosition {
    // Create a hidden mirror element
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(textarea);

    // Copy all relevant styles
    const stylesToCopy = [
        'font', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
        'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform',
        'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'boxSizing', 'whiteSpace', 'wordWrap', 'overflowWrap', 'width',
    ] as const;

    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';

    for (const prop of stylesToCopy) {
        (mirror.style as any)[prop] = style.getPropertyValue(
            prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        );
    }

    // Insert text up to the trigger, add a marker span
    const textBefore = textarea.value.substring(0, triggerIndex);
    const textNode = document.createTextNode(textBefore);
    const marker = document.createElement('span');
    marker.textContent = '@';
    mirror.appendChild(textNode);
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    // Position relative to the mirror
    const relativeTop = markerRect.top - mirrorRect.top;
    const relativeLeft = markerRect.left - mirrorRect.left;

    document.body.removeChild(mirror);

    // Account for textarea scroll position
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;

    return {
        top: relativeTop - textarea.scrollTop + lineHeight + 4, // 4px gap below cursor
        left: Math.min(relativeLeft, textarea.clientWidth - 40),   // keep in bounds
    };
}

export function usePromptMention({
    textareaRef,
    items,
    enabled,
}: UsePromptMentionOptions): UsePromptMentionReturn {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredItems, setFilteredItems] = useState<MentionItem[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
    const triggerIndexRef = useRef<number>(-1);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Close the menu
    const close = useCallback(() => {
        setIsOpen(false);
        setFilteredItems([]);
        setActiveIndex(0);
        triggerIndexRef.current = -1;
    }, []);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        };
    }, []);

    // ── onChange handler: detect @trigger and filter ──
    const handleChange = useCallback(
        (value: string, cursorPos?: number) => {
            if (!enabled || items.length === 0) {
                if (isOpen) close();
                return;
            }

            const textarea = textareaRef.current;
            const pos = cursorPos ?? textarea?.selectionStart ?? value.length;
            const textBeforeCursor = value.slice(0, pos);
            const match = MENTION_TRIGGER.exec(textBeforeCursor);

            if (!match) {
                if (isOpen) close();
                return;
            }

            const partial = match[1].toLowerCase(); // text after @
            const triggerPos = match.index;
            triggerIndexRef.current = triggerPos;

            // Filter items
            const filtered = partial
                ? items.filter(item => item.tag.toLowerCase().startsWith('@' + partial))
                : items; // show all when just "@"

            if (filtered.length === 0) {
                if (isOpen) close();
                return;
            }

            setFilteredItems(filtered);
            setActiveIndex(0);
            setIsOpen(true);

            // Compute pixel position
            if (textarea) {
                const position = getCursorPixelPosition(textarea, triggerPos);
                setMenuPosition(position);
            }
        },
        [enabled, items, isOpen, close, textareaRef]
    );

    // ── Insert tag: cleanly replaces the @partial trigger text ──
    const insertTag = useCallback((tag: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const value = textarea.value;
        const triggerPos = triggerIndexRef.current;
        const cursorPos = textarea.selectionStart ?? value.length;

        // Slice out the typed '@' and partial text, replace with full tag + trailing space
        const before = value.slice(0, triggerPos);
        const after = value.slice(cursorPos);
        const insertion = tag + ' ';
        const newValue = before + insertion + after;
        const newCursorPos = triggerPos + insertion.length;

        // Use native setter for React 18 controlled inputs
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
        )?.set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(textarea, newValue);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        });

        close();
    }, [close, textareaRef]);

    // ── Keyboard handler ──
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (!isOpen || filteredItems.length === 0) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setActiveIndex(prev => (prev + 1) % filteredItems.length);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setActiveIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
                    break;
                case 'Enter':
                case 'Tab': {
                    e.preventDefault();
                    const selected = filteredItems[activeIndex];
                    if (selected) insertTag(selected.tag);
                    break;
                }
                case 'Escape':
                    e.preventDefault();
                    close();
                    break;
            }
        },
        [isOpen, filteredItems, activeIndex, close, insertTag]
    );

    // ── Blur handler with delay (so click on dropdown can fire first) ──
    const handleBlur = useCallback(() => {
        blurTimeoutRef.current = setTimeout(() => {
            close();
        }, 200);
    }, [close]);

    return {
        isOpen,
        filteredItems,
        activeIndex,
        menuPosition,
        handleKeyDown,
        handleChange,
        handleBlur,
        insertTag,
        close,
    };
}
