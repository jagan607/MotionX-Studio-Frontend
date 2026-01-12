// components/DirectorOverlay.tsx
import { Loader2 } from "lucide-react";

export default function DirectorOverlay({ logs }: { logs: string[] }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5, 5, 5, 0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'monospace', color: '#FF0000'
        }}>
            <div style={{ width: '500px', border: '1px solid #333', padding: '40px', backgroundColor: '#000' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                    <Loader2 className="animate-spin" color="#FF0000" />
                    <h2 style={{ fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>AI Director_V1</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {logs.map((log, i) => (
                        <div key={i} style={{ fontSize: '12px', opacity: 0, animation: `fadeIn 0.2s forwards ${i * 0.2}s` }}>
                            {log}
                        </div>
                    ))}
                    <div style={{ fontSize: '12px', marginTop: '10px' }}>
                        <span className="animate-pulse">_</span>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
        </div>
    );
}