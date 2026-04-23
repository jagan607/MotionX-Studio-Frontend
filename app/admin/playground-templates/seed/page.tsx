"use client";

/**
 * Seed Playground Templates — One-time script page to populate Firestore
 * with the hardcoded Seedance 2.0 templates.
 *
 * Visit /admin/playground-templates/seed to run.
 * This is idempotent — it checks if templates already exist.
 */

import { useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Upload, Check, AlertTriangle } from "lucide-react";
import {
    ALL_TEMPLATES,
    assembleSuperheroPrompt,
    assembleFightPrompt,
    type SuperheroStyle,
    type Duration,
    type FightType,
} from "@/lib/playgroundTemplates";

const COLLECTION = "playground_templates";

export default function SeedPlaygroundTemplatesPage() {
    const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
    const [log, setLog] = useState<string[]>([]);

    const appendLog = (msg: string) => setLog((prev) => [...prev, msg]);

    const handleSeed = async () => {
        setStatus("running");
        setLog([]);

        try {
            // Check existing count
            const existing = await getDocs(collection(db, COLLECTION));
            if (existing.size > 0) {
                appendLog(`⚠️ Collection already has ${existing.size} templates. Skipping seed.`);
                appendLog("Delete all existing templates first if you want to re-seed.");
                setStatus("done");
                return;
            }

            appendLog(`📦 Seeding ${ALL_TEMPLATES.length} templates...`);
            let order = 0;

            for (const t of ALL_TEMPLATES) {
                let promptText = "";
                if (t.family === "superhero" && t.style) {
                    promptText = assembleSuperheroPrompt(t.style as SuperheroStyle, t.duration as Duration, false);
                } else if (t.family === "fight" && t.fightType) {
                    promptText = assembleFightPrompt(t.fightType as FightType, t.duration as Duration, "a_wins", false);
                }

                await addDoc(collection(db, COLLECTION), {
                    family: t.family,
                    style: t.style || "",
                    fightType: t.fightType || "",
                    duration: t.duration,
                    title: t.title,
                    subtitle: t.subtitle,
                    accent: t.accent,
                    emoji: t.emoji,
                    previewVideoUrl: t.previewVideoUrl || "",
                    promptText,
                    visible: true,
                    order,
                    requiredImages: t.requiredImages,
                    supportsLocation: t.supportsLocation,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                });

                appendLog(`✅ [${order}] ${t.emoji} ${t.title} — ${t.duration}s (${t.family})`);
                order++;
            }

            appendLog(`\n🎉 Done! ${order} templates seeded.`);
            setStatus("done");
        } catch (e: any) {
            appendLog(`❌ Error: ${e.message}`);
            setStatus("error");
        }
    };

    return (
        <div>
            <div className="mb-10">
                <h1 className="text-3xl font-bold font-mono uppercase tracking-tight mb-2">
                    Seed Playground Templates
                </h1>
                <p className="text-sm text-[#666] font-mono">
                    One-time population of Firestore <code className="text-red-500/60">playground_templates</code> from hardcoded data.
                </p>
            </div>

            <div className="p-6 border-2 border-[#222] bg-[#0A0A0A] mb-6">
                <p className="text-xs font-mono text-[#888] mb-4">
                    This will create <strong className="text-white">{ALL_TEMPLATES.length}</strong> template documents in Firestore.
                    Each template includes the full assembled prompt text, preview video URLs, and metadata.
                </p>

                <button
                    onClick={handleSeed}
                    disabled={status === "running"}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-mono font-bold uppercase tracking-wider border-2 border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {status === "running" ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : status === "done" ? (
                        <Check size={16} />
                    ) : status === "error" ? (
                        <AlertTriangle size={16} />
                    ) : (
                        <Upload size={16} />
                    )}
                    {status === "running" ? "Seeding..." : status === "done" ? "Seed Complete" : "Seed Templates"}
                </button>
            </div>

            {/* Log output */}
            {log.length > 0 && (
                <div className="p-4 border-2 border-[#222] bg-[#080808] font-mono text-xs space-y-0.5 max-h-[60vh] overflow-y-auto">
                    {log.map((line, i) => (
                        <div key={i} className={`${
                            line.startsWith("❌") ? "text-red-400" :
                            line.startsWith("⚠️") ? "text-yellow-400" :
                            line.startsWith("🎉") ? "text-green-400" :
                            "text-[#888]"
                        }`}>
                            {line}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
