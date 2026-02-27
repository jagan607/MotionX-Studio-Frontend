"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { X, Save, Sparkles, RefreshCcw, Camera, Aperture, Focus, Map } from 'lucide-react';
import { CameraTransform } from '@/lib/types';

export const DEFAULT_CAMERA: CameraTransform = { x: 0, y: 1.6, z: 3, rx: 0, ry: 0, fov: 50 };

type LensPreset = 24 | 35 | 50 | 85 | 135;
type FramingPreset = 'Extreme Wide' | 'Wide' | 'Medium' | 'Close-Up' | 'Extreme Close-Up' | 'Custom';
type AnglePreset = 'Top-Down' | 'High Angle' | 'Eye Level' | 'Low Angle' | "Worm's Eye" | 'Custom';

interface CameraGizmoOverlayProps {
    imageUrl: string;
    initialTransform?: CameraTransform;
    onClose: () => void;
    onSave: (transform: CameraTransform, shotType: string) => void;
    onRegenerate: (transform: CameraTransform, shotType: string) => void;
    isGenerating?: boolean;
}

// Reusable Image Plane
function ImagePlane({ url }: { url: string }) {
    const texture = useTexture(url);
    if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }
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
            <meshBasicMaterial color="#333" side={THREE.DoubleSide} />
        </mesh>
    );
}

// Visual Representation of the Virtual Camera
function VirtualCameraModel({ transform }: { transform: CameraTransform }) {
    return (
        <group position={[transform.x, transform.y, transform.z]} rotation={[THREE.MathUtils.degToRad(transform.rx), THREE.MathUtils.degToRad(transform.ry), 0]}>
            <mesh>
                <boxGeometry args={[0.3, 0.3, 0.5]} />
                <meshStandardMaterial color="#E50914" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Lens barrel pointing forward (-Z) */}
            <mesh position={[0, 0, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.12, 0.15, 0.2]} />
                <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Viewfinder nub */}
            <mesh position={[0, 0.2, 0.1]}>
                <boxGeometry args={[0.1, 0.1, 0.15]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            {/* Frustum Pyramic Fake */}
            <mesh position={[0, 0, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[2, 0.05, 4.3, 4, 1, true]} />
                <meshBasicMaterial color="#E50914" wireframe transparent opacity={0.15} />
            </mesh>
        </group>
    );
}

function derivePresets(cam?: CameraTransform): { lens: LensPreset, framing: FramingPreset, angle: AnglePreset } {
    if (!cam) return { lens: 35, framing: 'Medium', angle: 'Eye Level' };

    let lens: LensPreset = 50;
    if (cam.fov >= 80) lens = 24;
    else if (cam.fov >= 60) lens = 35;
    else if (cam.fov >= 40) lens = 50;
    else if (cam.fov >= 25) lens = 85;
    else lens = 135;

    let framing: FramingPreset = 'Medium';
    if (cam.z >= 8) framing = 'Extreme Wide';
    else if (cam.z >= 5) framing = 'Wide';
    else if (cam.z >= 3) framing = 'Medium';
    else if (cam.z >= 1.5) framing = 'Close-Up';
    else framing = 'Extreme Close-Up';

    let angle: AnglePreset = 'Eye Level';
    if (cam.y >= 6) angle = 'Top-Down';
    else if (cam.y >= 3) angle = 'High Angle';
    else if (cam.y >= 1.2) angle = 'Eye Level';
    else if (cam.y >= 0.4) angle = 'Low Angle';
    else angle = "Worm's Eye";

    // Mark as Custom if they dragged it manually off-center significantly
    if (Math.abs(cam.x) > 0.5 || Math.abs(cam.rx) > 40 || Math.abs(cam.ry) > 25) {
        framing = 'Custom';
        angle = 'Custom';
    }

    return { lens, framing, angle };
}

function getTransform(lens: LensPreset, framing: FramingPreset, angle: AnglePreset): CameraTransform {
    let fov = 50;
    if (lens === 24) fov = 84;
    if (lens === 35) fov = 63;
    if (lens === 50) fov = 46;
    if (lens === 85) fov = 28;
    if (lens === 135) fov = 18;

    let z = 3;
    if (framing === 'Extreme Wide') z = 10;
    if (framing === 'Wide') z = 6;
    if (framing === 'Medium') z = 3.5;
    if (framing === 'Close-Up') z = 1.8;
    if (framing === 'Extreme Close-Up') z = 1.0;
    if (framing === 'Custom') z = 3.5;

    let y = 1.6;
    let rx = 0;
    if (angle === 'Top-Down') { y = 8; rx = -80; }
    if (angle === 'High Angle') { y = 4; rx = -20; }
    if (angle === 'Eye Level') { y = 1.6; rx = 0; }
    if (angle === 'Low Angle') { y = 0.5; rx = 20; }
    if (angle === "Worm's Eye") { y = 0.1; rx = 40; }
    if (angle === 'Custom') { y = 1.6; rx = 0; }

    return { x: 0, y, z, rx, ry: 0, fov };
}

const radToDeg = THREE.MathUtils.radToDeg;
const degToRad = THREE.MathUtils.degToRad;

// Aggressively syncs React state into the Three.js camera and OrbitControls
function CameraController({ transform, controlsRef }: { transform: CameraTransform, controlsRef: React.RefObject<any> }) {
    const { camera } = useThree();

    useEffect(() => {
        camera.position.set(transform.x, transform.y, transform.z);
        camera.rotation.set(degToRad(transform.rx), degToRad(transform.ry), 0);
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = transform.fov;
            camera.updateProjectionMatrix();
        }

        // Snap target to center if it's the exact default camera position
        if (controlsRef.current) {
            if (transform.x === 0 && transform.rx === 0 && transform.ry === 0) {
                controlsRef.current.target.set(0, 1, 0);
                controlsRef.current.update();
            }
        }
    }, [transform, camera, controlsRef]);

    return null;
}

export function CameraGizmoOverlay({
    imageUrl,
    initialTransform,
    onClose,
    onSave,
    onRegenerate,
    isGenerating = false
}: CameraGizmoOverlayProps) {
    const initialCam = initialTransform || DEFAULT_CAMERA;
    const initialPresets = derivePresets(initialCam);

    // Core state
    const [camTransform, setCamTransform] = useState<CameraTransform>(initialCam);
    const [lens, setLens] = useState<LensPreset>(initialPresets.lens);
    const [framing, setFraming] = useState<FramingPreset>(initialPresets.framing);
    const [angle, setAngle] = useState<AnglePreset>(initialPresets.angle);

    const handlePresetChange = (l: LensPreset, f: FramingPreset, a: AnglePreset) => {
        setLens(l);
        setFraming(f);
        setAngle(a);
        if (f !== 'Custom' && a !== 'Custom') {
            setCamTransform(getTransform(l, f, a));
        } else {
            setCamTransform(prev => ({ ...prev, fov: getTransform(l, 'Medium', 'Eye Level').fov }));
        }
    };

    const shotTypeStr = `${lens}mm Lens, ${angle}, ${framing}`;

    const [internalIsGenerating, setInternalIsGenerating] = useState(isGenerating);

    const handleApply = (action: 'save' | 'regen') => {
        if (action === 'save') {
            onSave(camTransform, shotTypeStr);
        } else {
            setInternalIsGenerating(true);
            onRegenerate(camTransform, shotTypeStr);
        }
    };

    const handleReset = () => {
        setCamTransform(DEFAULT_CAMERA);
        const def = derivePresets(DEFAULT_CAMERA);
        setLens(def.lens);
        setFraming(def.framing);
        setAngle(def.angle);
    };

    // Auto-reset the view whenever a new generated image arrives
    // and turn off our internal loading state since the new image is here
    useEffect(() => {
        handleReset();
        setInternalIsGenerating(false);
    }, [imageUrl]);

    const activeIsGenerating = isGenerating || internalIsGenerating;

    // Also sync if parent forces it high
    useEffect(() => {
        if (activeIsGenerating) setInternalIsGenerating(true);
    }, [activeIsGenerating]);

    const controlsRef = useRef<any>(null);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8 font-sans">
            <div className="bg-[#0A0A0A] border border-white/[0.08] rounded-2xl w-full max-w-7xl h-full md:h-[88vh] flex flex-col md:flex-row overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">

                {/* Left: Viewfinder Display (First Person) */}
                <div className="flex-1 relative flex flex-col items-center justify-center bg-[#050505] p-4 md:p-8 overflow-hidden border-r border-white/5">

                    {/* Main Viewfinder Frame */}
                    <div className="relative w-full aspect-video rounded-md overflow-hidden border border-white/10 shadow-2xl bg-[#0a0a0a]">

                        <div className={`absolute inset-0 transition-opacity duration-1000 ${activeIsGenerating ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
                            <Canvas shadows>
                                <ambientLight intensity={0.6} />
                                <directionalLight position={[5, 10, 5]} intensity={1.5} />
                                <Suspense fallback={<FallbackPlane />}>
                                    <ImagePlane url={imageUrl} />
                                </Suspense>

                                <PerspectiveCamera
                                    makeDefault
                                    fov={camTransform.fov}
                                    position={[camTransform.x, camTransform.y, camTransform.z]}
                                    rotation={[degToRad(camTransform.rx), degToRad(camTransform.ry), 0]}
                                />

                                <OrbitControls
                                    ref={controlsRef}
                                    makeDefault
                                    target={[0, 1, 0]}
                                    minDistance={0.5}
                                    maxDistance={15}
                                    enablePan={true}
                                    enableZoom={true}
                                    // Let users move under the image, everywhere
                                    onChange={(e) => {
                                        if (!e?.target?.object) return;
                                        const cam = e.target.object as THREE.PerspectiveCamera;
                                        setCamTransform(prev => ({
                                            ...prev,
                                            x: Number(cam.position.x.toFixed(2)),
                                            y: Number(cam.position.y.toFixed(2)),
                                            z: Number(cam.position.z.toFixed(2)),
                                            rx: Number(radToDeg(cam.rotation.x).toFixed(1)),
                                            ry: Number(radToDeg(cam.rotation.y).toFixed(1)),
                                            fov: cam.fov
                                        }));
                                        // Switch to custom since they dragged it manually
                                        setFraming('Custom');
                                        setAngle('Custom');
                                    }}
                                />

                                <CameraController transform={camTransform} controlsRef={controlsRef} />

                                <gridHelper args={[20, 20, '#222', '#111']} position={[0, 0, 0]} />
                            </Canvas>
                        </div>

                        {/* Grid & HUD */}
                        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20">
                            <div className="border-r border-b border-white/60"></div>
                            <div className="border-r border-b border-white/60"></div>
                            <div className="border-b border-white/60"></div>
                            <div className="border-r border-b border-white/60"></div>
                            <div className="border-r border-b border-white/60"></div>
                            <div className="border-b border-white/60"></div>
                            <div className="border-r border-white/60"></div>
                            <div className="border-r border-white/60"></div>
                            <div></div>
                        </div>

                        <div className={`transition-opacity duration-500 pointer-events-none ${activeIsGenerating ? 'opacity-0' : 'opacity-100'}`}>
                            {/* Top Left: REC */}
                            <div className="absolute top-4 left-4 text-[#E50914] flex items-center gap-2 font-mono text-[10px] md:text-sm font-bold tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#E50914] animate-pulse"></div> REC
                            </div>

                            {/* Top Right: Shot Descriptor */}
                            <div className="absolute top-4 right-4 text-white font-mono text-[10px] md:text-xs font-semibold tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-right flex flex-col items-end gap-1">
                                <div>{shotTypeStr.toUpperCase()}</div>
                                <div className="text-[10px] text-neutral-300">
                                    POS: {camTransform.x.toFixed(1)}, {camTransform.y.toFixed(1)}, {camTransform.z.toFixed(1)} &nbsp;|&nbsp;
                                    ROT: {camTransform.rx.toFixed(0)}°, {camTransform.ry.toFixed(0)}°
                                </div>
                            </div>

                            {/* Instructional Pill */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 font-sans font-medium text-[11px] drop-shadow-md bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 uppercase tracking-wider">
                                Click & Drag inside frame to free-orbit camera
                            </div>
                        </div>

                        {/* Generating Overlay State */}
                        {activeIsGenerating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-10 transition-opacity duration-500">
                                <div className="w-12 h-12 border-4 border-white/10 border-t-[#E50914] rounded-full animate-spin mb-4"></div>
                                <div className="text-white font-sans text-lg tracking-widest font-bold drop-shadow-lg">DEVELOPING SHOT...</div>
                                <div className="text-neutral-400 font-mono text-xs mt-2 tracking-wider uppercase">{shotTypeStr}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Camera Rig Controls Panel */}
                <div className="w-full md:w-[400px] bg-[#0F0F0F] flex flex-col relative z-20 shrink-0 border-l border-white/5">

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212]">
                        <div>
                            <h2 className="text-base font-bold text-white tracking-wide">CAMERA RIG</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-neutral-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors p-2"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Third Person Map (Picture in Picture style) */}
                    <div className="w-full h-[220px] bg-[#000] border-b border-white/5 relative shrink-0">
                        <Canvas shadows>
                            <ambientLight intensity={0.5} />
                            <directionalLight position={[5, 10, 5]} intensity={1} />
                            <Environment preset="city" />
                            <Suspense fallback={<FallbackPlane />}>
                                <ImagePlane url={imageUrl} />
                            </Suspense>
                            {/* The physical camera model positioned exactly where the user is looking from */}
                            <VirtualCameraModel transform={camTransform} />

                            <gridHelper args={[20, 20, '#333', '#111']} position={[0, -0.01, 0]} />
                            <axesHelper args={[2]} position={[0, 0, 0]} />

                            {/* Outer Observer Camera looking at the whole setup */}
                            <PerspectiveCamera makeDefault position={[5, 6, 8]} fov={50} />
                            <OrbitControls target={[0, 1, 0]} enableZoom={true} makeDefault />
                        </Canvas>

                        <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded bg-black/80 backdrop-blur border border-white/10">
                            <Map size={12} className="text-[#E50914]" />
                            <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest">SCENE MAP</span>
                        </div>
                    </div>

                    {/* Scrollable Controls Body */}
                    <div className="flex-1 overflow-y-auto p-5 pb-32 space-y-6 no-scrollbar">

                        {/* LENS SELECTION */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-neutral-400">
                                <Aperture size={14} className="text-[#E50914]" />
                                <h3 className="text-xs uppercase tracking-widest font-semibold text-neutral-300">Lens (Focal Length)</h3>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                                {[24, 35, 50, 85, 135].map(l => (
                                    <button
                                        key={l}
                                        onClick={() => handlePresetChange(l as LensPreset, framing, angle)}
                                        disabled={activeIsGenerating}
                                        className={`py-2 text-[11px] font-mono rounded transition-all flex flex-col items-center justify-center gap-0.5 ${lens === l
                                            ? 'bg-[#E50914] text-white shadow-[0_0_10px_rgba(229,9,20,0.3)] border border-[#ff4d4d]'
                                            : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white border border-white/5 disabled:opacity-40'
                                            }`}
                                    >
                                        <span className={lens === l ? 'font-bold text-sm' : 'text-sm'}>{l}</span>
                                        <span className={`text-[8px] opacity-70 ${lens === l ? 'text-white' : 'text-neutral-500'}`}>mm</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* FRAMING SELECTION */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-neutral-400">
                                <Focus size={14} className="text-[#E50914]" />
                                <h3 className="text-xs uppercase tracking-widest font-semibold text-neutral-300">Framing / Distance</h3>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {['Extreme Wide', 'Wide', 'Medium', 'Close-Up', 'Extreme Close-Up'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => handlePresetChange(lens, f as FramingPreset, angle)}
                                        disabled={activeIsGenerating}
                                        className={`px-4 py-2 text-xs text-left rounded transition-all flex justify-between items-center ${framing === f
                                            ? 'bg-white/10 text-white border border-white/20'
                                            : 'bg-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-300 border border-transparent disabled:opacity-40'
                                            }`}
                                    >
                                        <span className="font-medium tracking-wide">{f}</span>
                                        {framing === f && <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] shadow-[0_0_8px_rgba(229,9,20,0.8)]" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ANGLE SELECTION */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-neutral-400">
                                <Camera size={14} className="text-[#E50914]" />
                                <h3 className="text-xs uppercase tracking-widest font-semibold text-neutral-300">Camera Angle</h3>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {['Top-Down', 'High Angle', 'Eye Level', 'Low Angle', "Worm's Eye"].map(a => (
                                    <button
                                        key={a}
                                        onClick={() => handlePresetChange(lens, framing, a as AnglePreset)}
                                        disabled={activeIsGenerating}
                                        className={`px-4 py-2 text-xs text-left rounded transition-all flex justify-between items-center ${angle === a
                                            ? 'bg-white/10 text-white border border-white/20'
                                            : 'bg-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-300 border border-transparent disabled:opacity-40'
                                            }`}
                                    >
                                        <span className="font-medium tracking-wide">{a}</span>
                                        {angle === a && <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] shadow-[0_0_8px_rgba(229,9,20,0.8)]" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Sticky Footer Actions */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 bg-gradient-to-t from-[#111] via-[#111] to-transparent pt-10 border-t border-white/5">
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => handleApply('regen')}
                                disabled={activeIsGenerating}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold bg-[#E50914] text-white hover:bg-[#ff0f1a] shadow-[0_0_20px_rgba(229,9,20,0.2)] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                {activeIsGenerating ? (
                                    <>GENERATING... <span className="animate-pulse">⏳</span></>
                                ) : (
                                    <><Sparkles size={16} /> GENERATE SHOT</>
                                )}
                            </button>
                            <div className="flex gap-2.5">
                                <button
                                    onClick={handleReset}
                                    disabled={activeIsGenerating}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RefreshCcw size={14} /> Reset UI
                                </button>
                                <button
                                    onClick={() => handleApply('save')}
                                    disabled={activeIsGenerating}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-white/5 text-neutral-200 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={14} /> Save Config
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
