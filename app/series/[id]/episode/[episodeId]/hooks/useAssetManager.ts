// app/series/[id]/episode/[episodeId]/hooks/useAssetManager.ts

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

export const useAssetManager = (seriesId: string) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
    const [assetType, setAssetType] = useState<'character' | 'location'>('character');
    const [modalMode, setModalMode] = useState<'upload' | 'generate'>('upload');
    const [genPrompt, setGenPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const openAssetModal = (name: string, type: 'character' | 'location') => {
        setSelectedAsset(name);
        setAssetType(type);
        setModalOpen(true);
        setGenPrompt(type === 'character' ? `Cinematic portrait of ${name}...` : `Wide shot of ${name}...`);
    };

    const handleAssetUpload = async (file: File, onSuccess: (url: string) => void) => {
        if (!selectedAsset) return;
        setIsProcessing(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("file", file);

            const endpoint = assetType === 'character'
                ? `${API_BASE_URL}/api/v1/assets/character/upload`
                : `${API_BASE_URL}/api/v1/assets/location/upload`;

            if (assetType === 'character') formData.append("character_name", selectedAsset);
            else formData.append("location_name", selectedAsset);

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess(data.image_url);
                setModalOpen(false);
            } else {
                alert("Upload failed: " + data.detail);
            }
        } catch (e) {
            console.error(e);
            alert("Connection failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAssetGenerate = async (onSuccess: (url: string) => void) => {
        if (!genPrompt || !selectedAsset) return alert("Describe the asset");
        setIsProcessing(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("prompt", genPrompt);

            let endpoint = "";
            if (assetType === 'character') {
                formData.append("character_name", selectedAsset);
                endpoint = `${API_BASE_URL}/api/v1/assets/character/generate`;
            } else {
                formData.append("location_name", selectedAsset);
                endpoint = `${API_BASE_URL}/api/v1/assets/location/generate`;
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                onSuccess(data.image_url);
                setModalOpen(false);
            } else {
                alert("Error: " + data.detail);
            }
        } catch (e) {
            console.error(e);
            alert("Generation failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        modalOpen, setModalOpen, selectedAsset, assetType, modalMode, setModalMode,
        genPrompt, setGenPrompt, isProcessing, openAssetModal, handleAssetUpload, handleAssetGenerate
    };
};