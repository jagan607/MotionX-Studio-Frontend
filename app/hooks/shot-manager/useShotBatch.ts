import { useState, useRef } from "react";

export const useShotBatch = (
    shotsRef: React.MutableRefObject<any[]>,
    handleRenderShot: (shot: any, aspectRatio: string) => Promise<void>
) => {
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const cancelGenerationRef = useRef(false);

    const stopGeneration = () => {
        cancelGenerationRef.current = true;
        setIsStopping(true);
    };

    const handleGenerateAll = async (aspectRatio: string) => {
        const shots = shotsRef.current;
        if (!shots.length) return;

        setIsGeneratingAll(true);
        setIsStopping(false);
        cancelGenerationRef.current = false;

        for (const shot of shots) {
            if (cancelGenerationRef.current) break;

            const freshShot = shotsRef.current.find(s => s.id === shot.id);
            if (freshShot && !freshShot.image_url) {
                await handleRenderShot(freshShot, aspectRatio);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        setIsGeneratingAll(false);
        setIsStopping(false);
    };

    return { isGeneratingAll, isStopping, stopGeneration, handleGenerateAll };
};