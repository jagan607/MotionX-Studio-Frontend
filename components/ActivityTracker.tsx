"use client";
import { useEffect } from "react";

export function ActivityTracker() {
    useEffect(() => {
        // Ping the server once on mount
        const ping = () => fetch('/api/user/activity', { method: 'POST' });
        ping();

        // Optional: Ping every 15 minutes if they stay open
        const interval = setInterval(ping, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return null; // It's invisible
}