"use client";

import { auth, googleProvider, db } from "@/lib/firebase"; // Import db
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"; // Import Firestore functions
import { useRouter } from "next/navigation";
import { LogIn, Volume2, VolumeX } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";

export default function LoginPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  // STATE: Audio & Subtitles
  const [isMuted, setIsMuted] = useState(true);
  const [textIndex, setTextIndex] = useState(0);

  const taglines = [
    "CREATIVE PRODUCTION SUITE",
    "AI-POWERED FILMMAKING",
    "FROM SCRIPT TO SCREEN",
    "AUTOMATE YOUR VISUALS"
  ];

  // 3D TILT LOGIC
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-300, 300], [10, -10]); // Tilt Up/Down
  const rotateY = useTransform(x, [-300, 300], [-10, 10]); // Tilt Left/Right

  // Cycle through taglines every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % taglines.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    // Calculate mouse position relative to center
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };

  const toggleAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // --- UPDATED LOGIN LOGIC ---
  const handleGoogleLogin = async () => {
    try {
      // 1. Authenticate with Google
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 2. Check if User Document Exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // 3. If New User, Create Profile & Add Credits
      if (!userSnap.exists()) {
        console.log("Creating new user profile...");
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          credits: 10,  // <--- IMPORTANT!!!!!!!! 10 FREE CREDITS ADDED HERE, NEED TO IMPLEMENT THIS LOGIC IN THE BACKEND LATER!!!!!!!
          plan: "free",
          createdAt: serverTimestamp()
        });
      }

      // 4. Redirect
      router.push("/");
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <main
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative', height: '100vh', width: '100vw',
        overflow: 'hidden', backgroundColor: 'black',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        perspective: '1000px' // Essential for 3D effect
      }}
    >

      {/* 1. BACKGROUND VIDEO */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <video
          ref={videoRef}
          autoPlay
          loop
          muted={isMuted} // Controlled by React state
          playsInline
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: 0.6, filter: 'blur(5px)', transform: 'scale(1.05)'
          }}
        >
          <source
            src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media&token=8b2fd5b3-3280-48b5-b141-1f399daf00ac"
            type="video/mp4"
          />
        </video>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)' }} />
      </div>

      {/* AUDIO TOGGLE BUTTON */}
      <button
        onClick={toggleAudio}
        style={{
          position: 'absolute', top: '40px', right: '40px', zIndex: 50,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%', width: '50px', height: '50px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', backdropFilter: 'blur(5px)'
        }}
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {/* 2. 3D INTERACTIVE LOGIN CARD */}
      <motion.div
        style={{
          rotateX, rotateY, // Apply the 3D tilt
          zIndex: 10, width: '100%', maxWidth: '480px', margin: '0 20px',
        }}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div style={{
          textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '70px 40px',
          backgroundColor: 'rgba(5, 5, 5, 0.6)',
          backdropFilter: 'blur(12px)',
          borderRadius: '24px',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.7)'
        }}>

          {/* Logo */}
          <h1 style={{
            fontFamily: 'Anton, sans-serif', fontSize: '72px', color: '#FFF',
            letterSpacing: '4px', marginBottom: '10px', lineHeight: 1,
            textShadow: '0 0 20px rgba(255, 255, 255, 0.1)'
          }}>
            MOTION X
          </h1>

          {/* Dynamic Typewriter Subtitle */}
          <div style={{ height: '20px', marginBottom: '50px' }}>
            <motion.p
              key={textIndex} // Re-renders animation when index changes
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                color: '#FF3333', fontSize: '13px', fontWeight: 'bold',
                letterSpacing: '3px', textTransform: 'uppercase'
              }}
            >
              {taglines[textIndex]}
            </motion.p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: '#ff1f1f', boxShadow: '0 0 30px rgba(255,0,0,0.4)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleLogin}
            style={{
              backgroundColor: '#FF0000', color: 'white', border: 'none',
              padding: '22px', width: '100%', borderRadius: '50px',
              fontWeight: 'bold', fontSize: '15px', letterSpacing: '1px',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '12px'
            }}
          >
            <LogIn size={20} />
            <span>START CREATING</span>
          </motion.button>

        </div>
      </motion.div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: '30px', width: '100%', textAlign: 'center', zIndex: 10 }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '2px' }}>
          © {new Date().getFullYear()} MOTIONX STUDIO
        </p>
      </div>

    </main>
  );
}