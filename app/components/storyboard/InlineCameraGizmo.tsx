"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Sparkles, Save, RotateCcw, Maximize2 } from "@/lib/lucide";
import { CameraTransform } from '@/lib/types';
import { EMERGENCY_MODE, EMERGENCY_FALLBACK_IMAGE_PROVIDER } from '@/lib/emergencyConfig';

const DEFAULT_CAMERA: CameraTransform = { x: 0, y: 1.6, z: 3, rx: 0, ry: 0, fov: 50 };

const degToRad = THREE.MathUtils.degToRad;
const radToDeg = THREE.MathUtils.radToDeg;
export type ImageProvider = 'gemini' | 'luma-uni-1';

interface Props {
    imageUrl: string;
    initialTransform?: CameraTransform;
    isGenerating?: boolean;
    onClose: () => void;
    onSave: (transform: CameraTransform, shotType: string) => void;
    onRegenerate: (transform: CameraTransform, shotType: string, provider: ImageProvider) => void;
    onExpand?: () => void;
}

function ImagePlane({ url }: { url: string }) {
    const texture = useTexture(url);
    if (texture) texture.colorSpace = THREE.SRGBColorSpace;
    return (
        <mesh position={[0, 1, 0]}>
            <planeGeometry args={[16 / 9 * 2, 2]} />
            <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
        </mesh>
    );
}

function FallbackPlane() {
    return (
        <mesh position={[0, 1, 0]}>
            <planeGeometry args={[16 / 9 * 2, 2]} />
            <meshBasicMaterial color="#222" side={THREE.DoubleSide} />
        </mesh>
    );
}

// Camera meshes (body, lens, viewfinder, frustum)
function CameraMeshes() {
    return (
        <>
            {/* Body — bright red with glow */}
            <mesh>
                <boxGeometry args={[0.4, 0.35, 0.6]} />
                <meshStandardMaterial color="#ff2020" emissive="#ff2020" emissiveIntensity={0.6} metalness={0.5} roughness={0.3} />
            </mesh>
            {/* Lens barrel */}
            <mesh position={[0, 0, -0.42]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.14, 0.18, 0.25]} />
                <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Viewfinder nub */}
            <mesh position={[0, 0.25, 0.1]}>
                <boxGeometry args={[0.12, 0.12, 0.18]} />
                <meshStandardMaterial color="#444" />
            </mesh>
            {/* Frustum cone — brighter */}
            <mesh position={[0, 0, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[2, 0.05, 4.3, 4, 1, true]} />
                <meshBasicMaterial color="#ff4444" wireframe transparent opacity={0.25} />
            </mesh>
            {/* Glow point light on camera */}
            <pointLight color="#ff2020" intensity={2} distance={3} />
        </>
    );
}

/**
 * Draggable 3D camera:
 *  - Left-drag on camera  → move in screen-parallel plane
 *  - Right-drag on camera → tilt/rotate
 *  - Scroll on scene       → zoom observer
 */
function DraggableCamera({
    transform,
    onChange,
    orbitRef,
}: {
    transform: CameraTransform;
    onChange: (t: CameraTransform) => void;
    orbitRef: React.RefObject<any>;
}) {
    const groupRef = useRef<THREE.Group>(null!);
    const { camera, gl } = useThree();
    const dragging = useRef(false);
    const shiftHeld = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const startTransform = useRef<CameraTransform>(transform);

    // Sync group position when transform changes (from reset/presets)
    useEffect(() => {
        if (groupRef.current && !dragging.current) {
            groupRef.current.position.set(transform.x, transform.y, transform.z);
            groupRef.current.rotation.set(degToRad(transform.rx), degToRad(transform.ry), 0);
        }
    }, [transform]);

    const onPointerDown = useCallback((e: any) => {
        e.stopPropagation();
        dragging.current = true;
        shiftHeld.current = e.shiftKey;
        startMouse.current = { x: e.clientX, y: e.clientY };
        startTransform.current = { ...transform };
        if (orbitRef.current) orbitRef.current.enabled = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [transform, orbitRef]);

    const onPointerMove = useCallback((e: any) => {
        if (!dragging.current) return;
        const dx = (e.clientX - startMouse.current.x) * 0.02;
        const dy = (e.clientY - startMouse.current.y) * 0.02;
        const st = startTransform.current;

        if (shiftHeld.current || e.shiftKey) {
            // Shift+drag: tilt/rotate camera
            const newT: CameraTransform = {
                ...st,
                ry: Number((st.ry + dx * 25).toFixed(1)),
                rx: Number(Math.max(-90, Math.min(90, st.rx + dy * 25)).toFixed(1)),
            };
            onChange(newT);
            if (groupRef.current) {
                groupRef.current.rotation.set(degToRad(newT.rx), degToRad(newT.ry), 0);
            }
        } else {
            // Normal drag: move camera in X + Y
            const newT: CameraTransform = {
                ...st,
                x: Number((st.x + dx).toFixed(2)),
                y: Number(Math.max(0.1, st.y - dy).toFixed(2)),
                z: st.z,
            };
            onChange(newT);
            if (groupRef.current) {
                groupRef.current.position.set(newT.x, newT.y, newT.z);
            }
        }
    }, [onChange]);

    const onPointerUp = useCallback((e: any) => {
        dragging.current = false;
        if (orbitRef.current) orbitRef.current.enabled = true;
    }, [orbitRef]);

    // Middle-click drag or shift+left-drag: move Z (forward/back)
    const onWheel = useCallback((e: any) => {
        // Only when hovering over camera — handled at scene level
    }, []);

    return (
        <group
            ref={groupRef}
            position={[transform.x, transform.y, transform.z]}
            rotation={[degToRad(transform.rx), degToRad(transform.ry), 0]}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onContextMenu={(e) => e.nativeEvent.preventDefault()}
        >
            {/* Invisible larger hitbox for easier grabbing */}
            <mesh visible={false}>
                <boxGeometry args={[0.8, 0.8, 1.2]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>
            <CameraMeshes />
        </group>
    );
}

function getShotLabel(cam: CameraTransform): string {
    const dist = Math.sqrt(cam.x * cam.x + cam.z * cam.z);
    let framing = dist > 5 ? 'Wide' : dist > 3 ? 'Medium' : dist > 1.5 ? 'Close-Up' : 'Extreme Close-Up';
    let angle = cam.y > 5 ? 'Top-Down' : cam.y > 3 ? 'High' : cam.y > 1 ? 'Eye Level' : cam.y > 0.3 ? 'Low' : 'Worm';
    return `${framing}, ${angle}`;
}

/** Shared viewfinder with visible, draggable camera model */
export function CameraViewfinder({
    imageUrl,
    cam,
    onCamChange,
    height = '300px',
}: {
    imageUrl: string;
    cam: CameraTransform;
    onCamChange: (cam: CameraTransform) => void;
    height?: string;
}) {
    const orbitRef = useRef<any>(null);

    return (
        <div
            className="relative rounded-lg overflow-hidden bg-[#080808] border border-[#D40A12]/20"
            style={{ height }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <Canvas shadows onPointerMissed={() => {}}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 10, 5]} intensity={1} />
                <Suspense fallback={<FallbackPlane />}>
                    <ImagePlane url={imageUrl} />
                </Suspense>

                {/* The draggable 3D camera */}
                <DraggableCamera
                    transform={cam}
                    onChange={onCamChange}
                    orbitRef={orbitRef}
                />

                <gridHelper args={[20, 20, '#333', '#111']} position={[0, -0.01, 0]} />
                <axesHelper args={[1]} />

                {/* Observer camera — elevated view */}
                <PerspectiveCamera makeDefault position={[5, 5, 7]} fov={50} />
                <OrbitControls
                    ref={orbitRef}
                    target={[0, 1, 0]}
                    enableZoom={true}
                    enablePan={false}
                    makeDefault
                />
            </Canvas>

            {/* HUD */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D40A12] animate-pulse" />
                <span className="text-[8px] font-mono font-bold text-[#D40A12]/80 tracking-widest">SCENE MAP</span>
            </div>
            <div className="absolute top-2 right-2 pointer-events-none">
                <span className="text-[8px] font-mono text-white/50 bg-black/50 px-1.5 py-0.5 rounded">{getShotLabel(cam)}</span>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="text-[8px] text-white/30 bg-black/40 px-2.5 py-1 rounded-full">
                    Drag camera: move · ⇧ Shift+drag: tilt · Scroll: orbit scene
                </span>
            </div>
        </div>
    );
}

/** Inline camera gizmo for shot cards */
export function InlineCameraGizmo({ imageUrl, initialTransform, isGenerating = false, onClose, onSave, onRegenerate, onExpand }: Props) {
    const [cam, setCam] = useState<CameraTransform>(initialTransform || DEFAULT_CAMERA);
    const [provider, setProvider] = useState<ImageProvider>(
        EMERGENCY_MODE ? EMERGENCY_FALLBACK_IMAGE_PROVIDER as ImageProvider : 'gemini'
    );

    // Generation flow states
    const [gizmoState, setGizmoState] = useState<'idle' | 'generating' | 'preview'>('idle');
    const [preGenImageUrl, setPreGenImageUrl] = useState<string>(imageUrl);

    useEffect(() => { setCam(initialTransform || DEFAULT_CAMERA); }, [imageUrl]);

    // Detect when image changes after generation was triggered
    useEffect(() => {
        if (gizmoState === 'generating' && imageUrl !== preGenImageUrl) {
            // New image arrived — show preview
            setGizmoState('preview');
        }
    }, [imageUrl, gizmoState, preGenImageUrl]);

    // Also catch parent's isGenerating going false while we're in generating state
    useEffect(() => {
        if (gizmoState === 'generating' && !isGenerating && imageUrl !== preGenImageUrl) {
            setGizmoState('preview');
        }
    }, [isGenerating, gizmoState, imageUrl, preGenImageUrl]);

    const reset = () => setCam(DEFAULT_CAMERA);
    const shotTypeStr = getShotLabel(cam);

    const handleGenerate = () => {
        setPreGenImageUrl(imageUrl); // remember current image
        setGizmoState('generating');
        onRegenerate(cam, shotTypeStr, provider);
    };

    const handleAccept = () => {
        // Close camera mode — the new image is already saved by the backend
        onClose();
    };

    const handleRetry = () => {
        // Go back to gizmo to try again
        setGizmoState('idle');
    };

    const isBusy = gizmoState === 'generating' || isGenerating;

    return (
        <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
                {/* Left: Original */}
                <div className="relative rounded-lg overflow-hidden bg-[#0a0a0a] border border-white/[0.06]" style={{ height: '300px' }}>
                    <img src={preGenImageUrl} alt="Original shot" className="w-full h-full object-cover" draggable={false} />
                    <div className="absolute top-2 left-2 pointer-events-none">
                        <span className="text-[7px] font-bold text-white/50 bg-black/60 px-1.5 py-0.5 rounded uppercase tracking-wider">Original</span>
                    </div>
                </div>

                {/* Right: Gizmo | Loader | Preview */}
                {gizmoState === 'generating' ? (
                    // Generating — show loader
                    <div className="relative rounded-lg overflow-hidden bg-[#080808] border border-[#D40A12]/20 flex flex-col items-center justify-center" style={{ height: '300px' }}>
                        <div className="w-10 h-10 border-3 border-white/10 border-t-[#D40A12] rounded-full animate-spin mb-4" />
                        <div className="text-white font-bold text-xs tracking-widest uppercase">Generating...</div>
                        <div className="text-neutral-500 font-mono text-[9px] mt-1.5 uppercase tracking-wider">{shotTypeStr} · {provider === 'gemini' ? 'Gemini' : 'Uni'}</div>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                            <span className="text-[8px] text-white/20 bg-black/40 px-2.5 py-1 rounded-full">Please wait</span>
                        </div>
                    </div>
                ) : gizmoState === 'preview' ? (
                    // Preview — show generated image with accept/retry
                    <div className="relative rounded-lg overflow-hidden bg-[#080808] border border-green-500/30" style={{ height: '300px' }}>
                        <img src={imageUrl} alt="Generated shot" className="w-full h-full object-cover" draggable={false} />
                        <div className="absolute top-2 left-2 pointer-events-none">
                            <div className="flex items-center gap-1.5 bg-black/60 px-1.5 py-0.5 rounded">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span className="text-[7px] font-bold text-green-400 uppercase tracking-wider">Generated</span>
                            </div>
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                            <button onClick={handleRetry}
                                className="px-3 py-1.5 rounded-md bg-black/70 backdrop-blur border border-white/10 text-[9px] font-bold text-neutral-300 hover:text-white transition-all cursor-pointer">
                                <RotateCcw size={10} className="inline mr-1" /> Retry
                            </button>
                            <button onClick={handleAccept}
                                className="px-4 py-1.5 rounded-md bg-green-600/80 backdrop-blur border border-green-400/30 text-[9px] font-bold text-white hover:bg-green-500/80 transition-all cursor-pointer">
                                ✓ Accept
                            </button>
                        </div>
                    </div>
                ) : (
                    // Idle — show camera gizmo
                    <CameraViewfinder imageUrl={imageUrl} cam={cam} onCamChange={setCam} height="300px" />
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
                <div className="text-[8px] font-mono text-neutral-500 bg-white/[0.02] px-2 py-1 rounded border border-white/[0.06]">
                    {shotTypeStr}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={reset} disabled={isBusy}
                        className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-neutral-500 hover:text-white transition-all cursor-pointer disabled:opacity-40"
                        title="Reset camera">
                        <RotateCcw size={12} />
                    </button>
                    {onExpand && (
                        <button onClick={onExpand} disabled={isBusy}
                            className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-neutral-500 hover:text-white transition-all cursor-pointer disabled:opacity-40"
                            title="Expand">
                            <Maximize2 size={12} />
                        </button>
                    )}
                    <button onClick={() => onSave(cam, shotTypeStr)} disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[9px] font-bold text-neutral-400 hover:text-white transition-all cursor-pointer disabled:opacity-40">
                        <Save size={10} /> Save
                    </button>

                    {/* Provider picker */}
                    <div className="flex bg-white/[0.02] rounded-md border border-white/[0.06] overflow-hidden">
                        {!EMERGENCY_MODE && (
                        <button onClick={() => setProvider('gemini')} disabled={isBusy}
                            className={`px-2 py-1.5 text-[8px] font-bold uppercase tracking-[0.3px] transition-all cursor-pointer disabled:opacity-40
                                ${provider === 'gemini' ? 'bg-[#D40A12]/15 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                            Gemini
                        </button>
                        )}
                        <button onClick={() => setProvider('luma-uni-1')} disabled={isBusy}
                            className={`px-2 py-1.5 text-[8px] font-bold uppercase tracking-[0.3px] transition-all cursor-pointer ${!EMERGENCY_MODE ? 'border-l border-white/[0.06]' : ''} disabled:opacity-40
                                ${provider === 'luma-uni-1' ? 'bg-[#D40A12]/15 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                            Uni
                        </button>
                    </div>

                    <button onClick={handleGenerate} disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D40A12]/15 border border-[#D40A12]/40 text-[9px] font-bold text-white hover:bg-[#D40A12]/25 transition-all cursor-pointer disabled:opacity-40">
                        <Sparkles size={10} className="text-[#D40A12]" />
                        {isBusy ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
}
