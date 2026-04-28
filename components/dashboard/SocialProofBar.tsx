"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Film, Zap } from "lucide-react";

interface StatItem {
    icon: React.ReactNode;
    value: number;
    label: string;
    suffix?: string;
}

const STATS: StatItem[] = [
    { icon: <Film size={11} />, value: 12340, label: "Films Created", suffix: "+" },
    { icon: <Zap size={11} />, value: 54200, label: "Shots Generated", suffix: "+" },
    { icon: <Users size={11} />, value: 2100, label: "Directors Active", suffix: "+" },
];

function AnimatedNumber({ target, duration = 2000 }: { target: number; duration?: number }) {
    const [current, setCurrent] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const started = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !started.current) {
                    started.current = true;
                    const startTime = performance.now();
                    const animate = (now: number) => {
                        const elapsed = now - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        // Ease-out cubic
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setCurrent(Math.floor(eased * target));
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target, duration]);

    return <span ref={ref}>{current.toLocaleString()}</span>;
}

export default function SocialProofBar() {
    return (
        <div className="shrink-0 px-1">
            <div className="flex items-center justify-center gap-6 sm:gap-10 py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.03]">
                {STATS.map((stat, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="text-[#E50914]/40">{stat.icon}</div>
                        <span className="text-[12px] sm:text-[13px] font-bold text-white/50 tabular-nums font-mono">
                            <AnimatedNumber target={stat.value} />
                            {stat.suffix}
                        </span>
                        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[1px] text-white/15 hidden sm:inline">{stat.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
