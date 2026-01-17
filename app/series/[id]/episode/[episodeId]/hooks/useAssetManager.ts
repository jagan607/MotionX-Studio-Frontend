// app/series/[id]/episode/[episodeId]/hooks/useAssetManager.ts

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

const sanitizeId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

export const useAssetManager = (seriesId: string) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
    const [assetType, setAssetType] = useState<'character' | 'location'>('character');
    const [modalMode, setModalMode] = useState<'upload' | 'generate'>('upload');
    const [genPrompt, setGenPrompt] = useState("");

    // FIX: Change from boolean to string to track WHICH asset is busy
    const [processingId, setProcessingId] = useState<string | null>(null);

    const openAssetModal = (name: string, type: 'character' | 'location', existingPrompt?: string) => {
        setSelectedAsset(name);
        setAssetType(type);
        setModalOpen(true);
        setModalMode('generate'); // Default to generate for better UX

        // Priority: Load the specific AI-analyzed prompt if available
        setGenPrompt(existingPrompt || (type === 'character' ? `Cinematic portrait of ${name}...` : `Wide shot of ${name}...`));
    };

    const handleAssetUpload = async (file: File, onSuccess: (url: string) => void) => {
        if (!selectedAsset) return;
        const dbDocId = sanitizeId(selectedAsset);
        setProcessingId(dbDocId); // Lock specifically this ID

        try {
            const collectionName = assetType === 'location' ? 'locations' : 'characters';
            const storageRef = ref(storage, `series/${seriesId}/${assetType}s/${dbDocId}_${Date.now()}`);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            const docRef = doc(db, "series", seriesId, collectionName, dbDocId);
            await setDoc(docRef, {
                name: selectedAsset,
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
            setProcessingId(null); // Unlock
        }
    };

    const handleAssetGenerate = async (onSuccess: (url: string) => void) => {
        if (!genPrompt || !selectedAsset) return;

        const dbDocId = sanitizeId(selectedAsset);
        setProcessingId(dbDocId); // Lock specifically this ID

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("prompt", genPrompt);

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
                    base_prompt: genPrompt, // Persist the prompt used
                    source: "ai_gen",
                    updated_at: new Date().toISOString()
                }, { merge: true });

                onSuccess(data.image_url);
                setModalOpen(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null); // Unlock
        }
    };

    return {
        modalOpen,
        setModalOpen,
        selectedAsset,
        assetType,
        modalMode,
        setModalMode,
        genPrompt,
        setGenPrompt,
        // Derived state: only true if the open modal's ID matches the processing ID
        isProcessing: selectedAsset ? processingId === sanitizeId(selectedAsset) : false,
        openAssetModal,
        handleAssetUpload,
        handleAssetGenerate
    };
};