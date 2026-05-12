import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Inter, Anton, Roboto_Mono } from "next/font/google";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GlobalHeader from "@/components/GlobalHeader";
import GlobalSidebar from "@/components/GlobalSidebar";
import { Toaster } from "react-hot-toast";
import { IS_MAINTENANCE_MODE } from "@/lib/maintenance";
import Script from "next/script";
import { MediaViewerProvider } from "@/app/context/MediaViewerContext";
import { WorkspaceProvider } from "@/app/context/WorkspaceContext";
import { CreditsProvider } from "@/hooks/useCredits";

// Lazy-loaded: GlobalMediaViewer is a modal (never visible on initial paint)
const GlobalMediaViewer = dynamic(
  () => import("@/app/components/media/GlobalMediaViewer")
);

// Lazy-loaded: ActivityTracker is a side-effect-only component (presence heartbeat)
const ActivityTracker = dynamic(
  () => import("@/components/ActivityTracker").then(mod => ({ default: mod.ActivityTracker }))
);

// Lazy-loaded: VoiceDirector is the global AI voice assistant (floating mic orb)
const VoiceDirector = dynamic(
  () => import("@/components/VoiceDirector/VoiceDirector")
);

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton"
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono"
});

export const metadata: Metadata = {
  title: "MotionX Studio | AI Filmmaking Engine — From Script to Film",
  description: "MotionX Studio is an AI-native filmmaking engine. Direct, generate, and edit films in a single workflow — from script to final cut. No cameras, no crews, no delays.",
  metadataBase: new URL('https://studio.motionx.in'),
  keywords: [
    "AI filmmaking", "AI film production", "AI video editor", "AI movie maker",
    "script to film", "AI cinematography", "AI video generation",
    "AI post production", "AI storyboard", "film production software",
    "AI directed films", "cinematic AI", "AI motion transfer",
    "video production platform", "AI filmmaking engine", "Seedance 2.0",
  ],
  alternates: {
    canonical: "https://studio.motionx.in",
  },
  openGraph: {
    title: "MotionX Studio | AI Filmmaking Engine",
    description: "From script to final film — all in one studio. Direct, generate, and edit films with AI as your crew.",
    url: "https://studio.motionx.in",
    siteName: "MotionX Studio",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-dashboard.png?alt=media&token=6a5f5807-a561-4a27-b512-3f0b9ab0cd8b",
        width: 1920,
        height: 1080,
        alt: "MotionX Studio — AI Filmmaking Engine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MotionX Studio | AI Filmmaking Engine",
    description: "From script to final film — all in one studio. Direct, generate, and edit films with AI.",
    images: ["https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-dashboard.png?alt=media&token=6a5f5807-a561-4a27-b512-3f0b9ab0cd8b"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "MotionX Studio",
    "url": "https://studio.motionx.in",
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Web",
    "description": "MotionX Studio is an AI-native filmmaking engine that lets you direct, generate, and edit films in a single workflow — from script to final cut.",
    "featureList": [
      "AI Script-to-Film Pipeline",
      "Character & Location Design",
      "Cinematic Shot Generation",
      "AI Video Editing (motion transfer, relighting, object removal)",
      "Dialogue & ADR Synthesis",
      "Full Post-Production Timeline",
    ],
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "0",
      "highPrice": "3000",
      "priceCurrency": "USD",
      "description": "Free trial available. Enterprise plans for studios and production companies."
    },
    "author": {
      "@type": "Organization",
      "name": "MotionX Studios",
      "url": "https://www.motionx.in"
    }
  };

  return (
    <html lang="en">
      <head>
        {/* Resource hints: eliminate DNS+TLS latency for critical origins */}
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://motionx-api-280948415370.asia-south2.run.app" />
      </head>
      <body className={inter.className} style={{ backgroundColor: '#111111', color: 'white' }} suppressHydrationWarning={true}>

        <Script
          id="razorpay-checkout"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />

        <MediaViewerProvider>
          <GlobalMediaViewer />

          <div className="h-screen flex flex-col relative overflow-hidden">
            {/* Global Ambient Glow to enhance glassmorphism */}
            <div className="fixed inset-0 pointer-events-none z-[-1] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#D40A12]/[0.05] via-[#111111] to-[#111111]" />

            <Script
              id="json-ld"
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* ── MAINTENANCE BANNER (shown on ALL pages when active) ── */}
            {IS_MAINTENANCE_MODE && (
              <>
                <div
                  className="fixed top-0 left-0 right-0 z-[60] w-full bg-gradient-to-r from-[#1a0a00] via-[#1c0800] to-[#1a0a00] border-b border-amber-900/40"
                  style={{ animation: 'maintenance-glow 3s ease-in-out infinite' }}
                >
                  <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-center gap-3">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                    </span>
                    <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase text-amber-300/90">
                      Scheduled Maintenance — We&apos;ll be back shortly
                    </p>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                    </span>
                  </div>
                </div>
                {/* Spacer to push content below the fixed banner */}
                <div className="h-9" />
              </>
            )}

            <AuthProvider>
              <WorkspaceProvider>
              <CreditsProvider>
              <ActivityTracker />
              {/* <div className="vignette pointer-events-none fixed inset-0 z-50" /> */}

              {/* GlobalHeader handles its own visibility */}
              <Suspense fallback={null}>
                <GlobalHeader />
              </Suspense>

              {/* MAIN CONTENT + AI DIRECTOR: flex row so panel pushes content */}
              <div className="flex-1 flex flex-row relative z-0 min-h-0">
                <Suspense fallback={null}>
                  <GlobalSidebar />
                </Suspense>
                <main className="flex-1 flex flex-col relative min-w-0 overflow-y-auto" style={{ transform: 'translateZ(0)' }}>
                  {children}
                </main>

                {/* AI Director Panel — part of the layout, not overlaying */}
                <Suspense fallback={null}>
                  <VoiceDirector />
                </Suspense>
              </div>

              <Toaster
                position="bottom-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#0A0A0A',
                    color: '#fff',
                    border: '1px solid #222',
                    borderRadius: '2px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    padding: '14px 18px',
                    maxWidth: '380px',
                  },
                  success: {
                    iconTheme: { primary: '#22C55E', secondary: '#0A0A0A' },
                    style: { borderLeft: '3px solid #22C55E' },
                  },
                  error: {
                    iconTheme: { primary: '#DC2626', secondary: '#0A0A0A' },
                    style: { borderLeft: '3px solid #DC2626' },
                    duration: 5000,
                  },
                }}
              />
              </CreditsProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </div>
        </MediaViewerProvider>
        <Analytics />
        {IS_MAINTENANCE_MODE && (
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes maintenance-glow {
              0%, 100% { box-shadow: 0 2px 20px rgba(245, 158, 11, 0.05); }
              50% { box-shadow: 0 2px 30px rgba(245, 158, 11, 0.12); }
            }
          `}} />
        )}
      </body>
    </html>
  );
}