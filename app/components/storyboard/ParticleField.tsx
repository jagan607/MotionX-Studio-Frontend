"use client";

import { useEffect, useRef, memo } from "react";

interface Particle {
    x: number;
    y: number;
    size: number;
    opacity: number;
    speed: number;
    angle: number;
    distance: number;
    baseDistance: number;
    hue: number;
    phaseOffset: number;
}

const PARTICLE_COUNT = 100;

const ParticleField = memo(() => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);
    const timeRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let dpr = window.devicePixelRatio || 1;

        const resize = () => {
            dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = window.innerWidth + "px";
            canvas.style.height = window.innerHeight + "px";
            ctx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener("resize", resize);

        const w = () => canvas.width / dpr;
        const h = () => canvas.height / dpr;

        // Initialize particles in layers
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
            const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.3;
            const layer = Math.random();
            const baseDistance = 100 + layer * Math.min(w(), h()) * 0.45;
            return {
                x: 0, y: 0,
                size: 0.6 + layer * 2.2,
                opacity: 0.1 + Math.random() * 0.45,
                speed: 0.15 + (1 - layer) * 0.35,
                angle,
                distance: baseDistance,
                baseDistance,
                hue: Math.random() > 0.75 ? 20 + Math.random() * 15 : 0, // warm amber or red
                phaseOffset: Math.random() * Math.PI * 2,
            };
        });

        const animate = () => {
            if (!ctx || !canvas) return;
            timeRef.current += 0.016; // ~60fps time step
            const t = timeRef.current;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // Soft fade — creates smooth trailing
            ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
            ctx.fillRect(0, 0, w(), h());

            const centerX = w() / 2;
            const centerY = h() / 2;

            // Central breathing glow
            const breathe = 0.5 + 0.5 * Math.sin(t * 0.4);
            const glowRadius = 160 + breathe * 40;

            const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
            glow.addColorStop(0, `rgba(229, 9, 20, ${0.07 * breathe})`);
            glow.addColorStop(0.3, `rgba(255, 100, 50, ${0.025 * breathe})`);
            glow.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w(), h());

            particlesRef.current.forEach((p) => {
                // Smooth continuous orbital rotation
                p.angle += 0.001 * p.speed;

                // Gentle breathing distance — smooth sine wave
                const breatheDist = Math.sin(t * 0.3 + p.phaseOffset) * 0.15;
                const targetDist = p.baseDistance * (0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.2 + p.phaseOffset)));

                // Smooth interpolation (lerp) toward target
                p.distance += (targetDist - p.distance) * 0.008;

                // Calculate position with smooth easing
                const prevX = p.x;
                const prevY = p.y;
                const targetX = centerX + Math.cos(p.angle) * p.distance;
                const targetY = centerY + Math.sin(p.angle) * p.distance;

                // Smooth lerp for position (eliminates jitter)
                p.x += (targetX - p.x) * 0.03;
                p.y += (targetY - p.y) * 0.03;

                // Pulsing opacity — slow and gentle
                const pulse = 0.6 + 0.4 * Math.sin(t * 0.8 + p.phaseOffset);
                const alpha = p.opacity * pulse;

                // Draw soft trail line
                if (p.size > 1.2 && prevX !== 0) {
                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = `hsla(${p.hue}, 80%, 50%, ${alpha * 0.12})`;
                    ctx.lineWidth = p.size * 0.5;
                    ctx.stroke();
                }

                // Draw particle — outer glow
                if (p.size > 1) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${p.hue}, 90%, 50%, ${alpha * 0.06})`;
                    ctx.fill();
                }

                // Draw particle — main body
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue}, 85%, 55%, ${alpha})`;
                ctx.fill();

                // Draw bright core
                if (p.size > 1) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 0.25, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${p.hue}, 50%, 90%, ${alpha * 0.7})`;
                    ctx.fill();
                }
            });

            // Connection lines — only between large nearby particles
            const bigP = particlesRef.current.filter(p => p.size > 1.5);
            for (let i = 0; i < bigP.length; i++) {
                for (let j = i + 1; j < bigP.length; j++) {
                    const dx = bigP[i].x - bigP[j].x;
                    const dy = bigP[i].y - bigP[j].y;
                    const dist = dx * dx + dy * dy; // skip sqrt for perf
                    if (dist < 12000) { // ~110px
                        const alpha = 0.03 * (1 - dist / 12000);
                        ctx.beginPath();
                        ctx.moveTo(bigP[i].x, bigP[i].y);
                        ctx.lineTo(bigP[j].x, bigP[j].y);
                        ctx.strokeStyle = `rgba(229, 9, 20, ${alpha})`;
                        ctx.lineWidth = 0.4;
                        ctx.stroke();
                    }
                }
            }

            animRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
    );
});

ParticleField.displayName = "ParticleField";
export default ParticleField;
