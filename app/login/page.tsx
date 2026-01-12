"use client";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/"); // Redirect to dashboard after login
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', border: '1px solid #222', padding: '60px', backgroundColor: '#0A0A0A' }}>
        <h1 style={{ fontFamily: 'Anton, sans-serif', fontSize: '64px', color: '#FFF', letterSpacing: '4px', marginBottom: '10px' }}>MOTION X</h1>
        <p style={{ color: '#666', fontSize: '12px', letterSpacing: '2px', marginBottom: '40px' }}>CREATIVE PRODUCTION SUITE</p>
        
        <button 
          onClick={handleGoogleLogin}
          style={{ 
            backgroundColor: '#FF0000', color: 'white', border: 'none', padding: '20px 40px', 
            fontWeight: 'bold', fontSize: '14px', letterSpacing: '2px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' 
          }}
        >
          <LogIn size={20} /> SIGN IN WITH GOOGLE
        </button>
      </div>
    </main>
  );
}