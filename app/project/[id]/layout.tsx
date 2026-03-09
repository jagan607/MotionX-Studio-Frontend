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
            {/* This layout acts as the 'Shell' for the 3-Phase Pipeline:
        1. Project Hub (Gatekeeper)
        2. Pre-Production Canvas (Script, Characters, Locations, Mood)
        3. Production Studio (Storyboard, Shots, Animation)
        4. Post-Production (Timeline, Sound)
      */}
            {children}
        </section>
    );
}