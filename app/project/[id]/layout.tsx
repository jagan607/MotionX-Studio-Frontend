import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
    title: "Production Terminal | MotionX",
    description: "AI-Native Film Production Environment",
};

export default function ProjectLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // We enforce the dark background here to ensure no white flashes during transitions
        <section className="min-h-screen w-full bg-motion-bg text-motion-text relative">
            {/* This layout acts as the 'Shell' for the 5-Stage Pipeline:
        1. Gatekeeper (Redirector)
        2. Pre-Production (Ingest)
        3. Draft (Script Lab)
        4. Assets (Casting)
        5. Studio (Dashboard)
      */}
            {children}
        </section>
    );
}