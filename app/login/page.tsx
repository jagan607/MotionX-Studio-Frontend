"use client";

import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <main style={{
      position: 'relative',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: 'black',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>

      {/* 1. BACKGROUND VIDEO (Blurred) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.6,
            filter: 'blur(5px)',       // <--- CONTROLS THE BLUR AMOUNT
            transform: 'scale(1.05)'   // <--- Slight zoom to hide blurred edges
          }}
        >
          <source
            src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media&token=8b2fd5b3-3280-48b5-b141-1f399daf00ac"
            type="video/mp4"
          />
        </video>
        {/* Dark Overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.83)' }} />
      </div>

      {/* 2. LOGIN CARD */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '450px', margin: '0 20px' }}
      >
        <div style={{
          textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '60px 40px',
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>

          <h1 style={{
            fontFamily: 'Anton, sans-serif',
            fontSize: '64px',
            color: '#FFF',
            letterSpacing: '4px',
            marginBottom: '5px',
            lineHeight: 1
          }}>
            MOTION X
          </h1>

          <p style={{
            color: '#aaa',
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            marginBottom: '40px',
            textTransform: 'uppercase'
          }}>
            Creative Production Suite
          </p>

          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: '#ff1f1f' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGoogleLogin}
            style={{
              backgroundColor: '#FF0000',
              color: 'white',
              border: 'none',
              padding: '20px',
              width: '100%',
              borderRadius: '50px',
              fontWeight: 'bold',
              fontSize: '14px',
              letterSpacing: '1px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              transition: 'all 0.3s ease'
            }}
          >
            <LogIn size={20} />
            <span>SIGN IN WITH GOOGLE</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: '30px', width: '100%', textAlign: 'center', zIndex: 10 }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '2px' }}>
          © {new Date().getFullYear()} MOTIONX STUDIO
        </p>
      </div>

    </main>
  );
}