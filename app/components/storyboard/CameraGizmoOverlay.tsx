"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { X, Save, Sparkles, RefreshCcw } from 'lucide-react';
import { CameraTransform } from '@/lib/types';

export const DEFAULT_CAMERA: CameraTransform = {
    x: 0,
    y: 1.6,
    z: 3,
    rx: 0,
    ry: 0,
    fov: 50
};

export function cameraToShotType(cam: CameraTransform): string {
    const parts: string[] = [];

    // Height → Angle descriptor
    if (cam.y < 0.8) parts.push("Worm's-eye");
    else if (cam.y < 1.2) parts.push("Low-angle");
    else if (cam.y < 2.0) parts.push("Eye-level");
    else if (cam.y < 4.0) parts.push("High-angle");
    else parts.push("Bird's-eye");

    // Distance → Framing descriptor
    if (cam.z < 1.5) parts.push("extreme close-up");
    else if (cam.z < 2.5) parts.push("close-up");
    else if (cam.z < 4) parts.push("medium shot");
    else if (cam.z < 6) parts.push("medium-wide");
    else parts.push("wide shot");

    // FOV → Lens
    parts.push(`${Math.round(cam.fov)}mm`);

    // Lateral offset → OTS hint
    if (Math.abs(cam.ry) > 20) {
        parts.push(`(${cam.ry > 0 ? 'right' : 'left'} offset)`);
    }

    return parts.join(" ");
}

interface CameraGizmoOverlayProps {
    imageUrl: string;
    initialTransform?: CameraTransform;
    onClose: () => void;
    onSave: (transform: CameraTransform, shotType: string) => void;
    onRegenerate: (transform: CameraTransform, shotType: string) => void;
    isGenerating?: boolean; // To disable buttons while generating
}

const rad2deg = (rad: number) => rad * (180 / Math.PI);
const deg2rad = (deg: number) => deg * (Math.PI / 180);

export function CameraGizmoOverlay({
    imageUrl,
    initialTransform,
    onClose,
    onSave,
    onRegenerate,
    isGenerating = false
}: CameraGizmoOverlayProps) {
    const [camTransform, setCamTransform] = useState<CameraTransform>(
        initialTransform || DEFAULT_CAMERA
    );

    // Provide a texture loader for the image plane
    const texture = useRef<THREE.Texture | null>(null);
    useEffect(() => {
        if (imageUrl) {
            new THREE.TextureLoader().load(imageUrl, (loaded) => {
                loaded.colorSpace = THREE.SRGBColorSpace;
                texture.current = loaded;
                // Force a re-render to apply the texture
                setCamTransform((prev) => ({ ...prev }));
            });
        }
    }, [imageUrl]);

    const handleReset = () => {
        setCamTransform(DEFAULT_CAMERA);
    };

    const handleFovChange = (fov: number) => {
        setCamTransform(prev => ({ ...prev, fov }));
    };

    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCamTransform(prev => ({ ...prev, y: parseFloat(e.target.value) }));
    };

    const shotTypeDescription = cameraToShotType(camTransform);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
            {/* Main Modal Container */}
            <div className="bg-[#0A0A0A] border border-white/[0.08] rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/[0.08] bg-black/40">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="text-xl">🎬</span> Camera Framing Gizmo
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1">
                            Orbit, pan, and zoom to set the exact camera angle for image generation.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-500 hover:text-white p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 3D Viewport */}
                <div className="flex-1 relative w-full bg-[#111] overflow-hidden">
                    <Canvas shadows>
                        <ambientLight intensity={0.5} />
                        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />

                        {/* The shot image as a flat plane standing up */}
                        {texture.current ? (
                            <mesh position={[0, 1, 0]}>
                                {/* Assuming 16:9 aspect ratio roughly */}
                                <planeGeometry args={[16 / 9 * 2, 2]} />
                                <meshBasicMaterial map={texture.current} side={THREE.DoubleSide} />
                            </mesh>
                        ) : (
                            <mesh position={[0, 1, 0]}>
                                <planeGeometry args={[16 / 9 * 2, 2]} />
                                <meshBasicMaterial color="#333" side={THREE.DoubleSide} />
                            </mesh>
                        )}

                        {/* Controllable camera */}
                        <PerspectiveCamera
                            makeDefault
                            fov={camTransform.fov}
                            position={[camTransform.x, camTransform.y, camTransform.z]}
                            rotation={[deg2rad(camTransform.rx), deg2rad(camTransform.ry), 0]}
                        />

                        {/* Orbit controls constrained to useful ranges */}
                        <OrbitControls
                            makeDefault
                            minDistance={0.5}
                            maxDistance={10}
                            minPolarAngle={0.1}     // Prevent going completely below ground
                            maxPolarAngle={Math.PI / 2 + 0.2} // Allow slightly below horizon
                            enablePan={true}
                            onChange={(e) => {
                                if (!e?.target?.object) return;
                                const cam = e.target.object as THREE.PerspectiveCamera;

                                setCamTransform(prev => ({
                                    ...prev,
                                    x: Number(cam.position.x.toFixed(2)),
                                    y: Number(cam.position.y.toFixed(2)),
                                    z: Number(cam.position.z.toFixed(2)),
                                    rx: Number(rad2deg(cam.rotation.x).toFixed(1)),
                                    ry: Number(rad2deg(cam.rotation.y).toFixed(1)),
                                    // FOV is managed by state, but grab it just in case
                                    fov: cam.fov
                                }));
                            }}
                        />

                        {/* Visual guides */}
                        <gridHelper args={[20, 20, '#444', '#222']} position={[0, 0, 0]} />
                        <axesHelper args={[2]} position={[0, 0.01, 0]} />
                    </Canvas>

                    {/* Live Shot Type Readout (Floating) */}
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-lg shadow-lg pointer-events-none">
                        <span className="text-xs text-neutral-400 font-semibold block mb-0.5 uppercase tracking-wider">Derived Shot Type</span>
                        <span className="text-sm font-bold text-[#E50914]">{shotTypeDescription}</span>
                    </div>

                    {/* Camera Data Readout (Floating) */}
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-2 rounded-lg shadow-lg pointer-events-none text-[10px] text-neutral-300 font-mono flex flex-col gap-1">
                        <div><span className="text-neutral-500">POS:</span> {camTransform.x}, {camTransform.y}, {camTransform.z}</div>
                        <div><span className="text-neutral-500">ROT:</span> {camTransform.rx}°, {camTransform.ry}°</div>
                        <div><span className="text-neutral-500">FOV:</span> {camTransform.fov}mm</div>
                    </div>
                </div>

                {/* Bottom Controls Panel */}
                <div className="p-4 border-t border-white/[0.08] bg-black/40 flex flex-col md:flex-row gap-6 items-center">

                    {/* Left: Tuning Controls */}
                    <div className="flex-1 flex gap-6 w-full">
                        {/* Lens / FOV Selection */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Lens (FOV)</label>
                            <div className="flex gap-1.5 p-1 bg-white/[0.03] rounded-lg border border-white/[0.08]">
                                {[24, 35, 50, 85, 135].map(fov => (
                                    <button
                                        key={fov}
                                        onClick={() => handleFovChange(fov)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${camTransform.fov === fov
                                                ? 'bg-[#E50914] text-white shadow-sm'
                                                : 'text-neutral-400 hover:bg-white/[0.05] hover:text-white'
                                            }`}
                                    >
                                        {fov}mm
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Height Slider */}
                        <div className="flex flex-col gap-2 flex-1 max-w-xs">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Camera Height (Y)</label>
                                <span className="text-[10px] font-mono text-neutral-300">{camTransform.y}m</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="8"
                                step="0.1"
                                value={camTransform.y}
                                onChange={handleHeightChange}
                                className="w-full accent-[#E50914]"
                            />
                            <div className="flex justify-between text-[9px] text-neutral-500">
                                <span>Low (-0)</span>
                                <span>Eye (1.6)</span>
                                <span>High (8+)</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <button
                            onClick={handleReset}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.1] transition-colors disabled:opacity-50"
                        >
                            <RefreshCcw size={14} /> Reset
                        </button>

                        <button
                            onClick={() => onSave(camTransform, shotTypeDescription)}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-6 py-2 rounded-lg text-xs font-semibold bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.15] transition-colors disabled:opacity-50"
                        >
                            <Save size={14} /> Save Pose
                        </button>

                        <button
                            onClick={() => onRegenerate(camTransform, shotTypeDescription)}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-6 py-2 rounded-lg text-xs font-semibold bg-[#E50914] text-white hover:bg-[#E50914]/90 shadow-[0_0_15px_rgba(229,9,20,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <>Generatng... <span className="animate-pulse">⏳</span></>
                            ) : (
                                <><Sparkles size={14} /> Re-Gen Shot</>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
