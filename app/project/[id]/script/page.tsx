"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { InputDeck } from "@/components/pre-production/InputDeck";
import { StudioLayout } from "@/components/ui/StudioLayout"; // Reusing your layout style
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PreProductionPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    return (
        <div className="min-h-screen bg-motion-bg flex flex-col">

            {/* HEADER (Optional - can be moved to layout later) */}
            <div className="p-8 border-b border-motion-border flex items-center gap-4">
                <Link href="/dashboard" className="text-motion-text-muted hover:text-motion-text transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="text-sm font-bold tracking-[2px] text-motion-text uppercase">
            // PRE-PRODUCTION TERMINAL
                </div>
            </div>

            {/* CENTERED DECK */}
            <div className="flex-1 flex items-center justify-center p-8">
                <InputDeck
                    projectId={projectId}
                    isModal={false} // Full screen mode
                    onCancel={() => router.push("/dashboard")}
                    onSuccess={(url) => router.push(url)}
                />
            </div>
        </div>
    );
}