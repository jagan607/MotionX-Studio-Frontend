// app/series/[id]/episode/[episodeId]/hooks/useAssetManager.ts

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

/**
 * Mirror of Python backend logic:
 * 1. Removes characters that aren't alphanumeric or spaces (like '/')
 * 2. Trims and replaces internal spaces with underscores
 */
const sanitizeId = (name: string) => {
    if (!name) return "unknown";
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, "");
    return clean.trim().toLowerCase().replace(/\s+/g, "_");
};

export const useAssetManager = (seriesId: string) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

    // NEW: Stable ID state to ensure we always hit the correct Firestore document
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

    const [assetType, setAssetType] = useState<'character' | 'location'>('character');
    const [modalMode, setModalMode] = useState<'upload' | 'generate'>('upload');
    const [genPrompt, setGenPrompt] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);

    /**
     * Updated to accept the existingId from the database.
     * This prevents the "double underscore" mismatch by using the pre-sanitized ID.
     */
    const openAssetModal = (
        name: string,
        type: 'character' | 'location',
        existingPrompt?: string,
        existingId?: string
    ) => {
        const stableId = existingId || sanitizeId(name);

        setSelectedAsset(name);
        setSelectedAssetId(stableId); // Set the document ID here
        setAssetType(type);
        setModalOpen(true);
        setModalMode('generate');

        setGenPrompt(existingPrompt || (type === 'character' ? `Cinematic portrait of ${name}...` : `Wide shot of ${name}...`));
    };

    const handleAssetUpload = async (file: File, onSuccess: (url: string) => void) => {
        if (!selectedAssetId || !selectedAsset) return;

        const dbDocId = selectedAssetId;
        setProcessingId(dbDocId);

        try {
            const collectionName = assetType === 'location' ? 'locations' : 'characters';
            const storageRef = ref(storage, `series/${seriesId}/${assetType}s/${dbDocId}_${Date.now()}`);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            const docRef = doc(db, "series", seriesId, collectionName, dbDocId);
            await setDoc(docRef, {
                name: selectedAsset, // Keeps the display name clean
                image_url: downloadURL,
                source: "upload",
                status: "active",
                updated_at: new Date().toISOString()
            }, { merge: true });

            onSuccess(downloadURL);
            setModalOpen(false);
        } catch (e) {
            console.error("Upload failed", e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleAssetGenerate = async (onSuccess: (url: string) => void) => {
        if (!genPrompt || !selectedAssetId || !selectedAsset) return;

        const dbDocId = selectedAssetId;
        setProcessingId(dbDocId);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("prompt", genPrompt);

            // Pass the sanitized ID to the backend generator
            if (assetType === 'character') formData.append("character_name", dbDocId);
            else formData.append("location_name", dbDocId);

            const endpoint = assetType === 'character'
                ? `${API_BASE_URL}/api/v1/assets/character/generate`
                : `${API_BASE_URL}/api/v1/assets/location/generate`;

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.image_url) {
                const collectionName = assetType === 'location' ? 'locations' : 'characters';
                const docRef = doc(db, "series", seriesId, collectionName, dbDocId);

                await setDoc(docRef, {
                    name: selectedAsset,
                    image_url: data.image_url,
                    base_prompt: genPrompt,
                    source: "ai_gen",
                    updated_at: new Date().toISOString()
                }, { merge: true });

                onSuccess(data.image_url);
                setModalOpen(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    return {
        modalOpen,
        setModalOpen,
        selectedAsset,
        selectedAssetId,
        assetType,
        modalMode,
        setModalMode,
        genPrompt,
        setGenPrompt,
        // Match against the stable ID for processing state
        isProcessing: selectedAssetId ? processingId === selectedAssetId : false,
        openAssetModal,
        handleAssetUpload,
        handleAssetGenerate
    };
};