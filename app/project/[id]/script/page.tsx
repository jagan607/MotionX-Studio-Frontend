"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { InputDeck } from "@/components/script/InputDeck";
import { StudioLayout } from "@/components/ui/StudioLayout";
import { FileText } from "lucide-react";

export default function ScriptIngestionPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    return (
        <StudioLayout>
            {/* Main Container: Full height, no scroll on body */}
            <div className="flex flex-col h-full w-full">

                {/* HEADER: Compact, no back button */}
                <div className="flex items-center justify-between mb-2 shrink-0 px-1">
                    <div>
                        <h1 className="text-2xl font-display uppercase text-white leading-none tracking-wide">
                            Script Ingestion
                        </h1>
                    </div>

                    <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-motion-text-muted border border-neutral-800 px-3 py-1 rounded-full bg-neutral-900/50">
                        <FileText size={12} /> WAITING FOR DATA
                    </div>
                </div>

                {/* DECK CONTAINER: Fills exactly the remaining space */}
                <div className="flex-1 min-h-0 relative overflow-hidden">
                    <InputDeck
                        projectId={projectId}
                        isModal={false}
                        className="h-full w-full"
                        onCancel={() => router.push("/dashboard")}
                        onSuccess={(url) => router.push(url)}
                    />
                </div>
            </div>
        </StudioLayout>
    );
}