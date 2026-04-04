import type { Metadata } from "next";
import { Inter, Anton, Roboto_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GlobalHeader from "@/components/GlobalHeader";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { MediaViewerProvider } from "@/app/context/MediaViewerContext";
import GlobalMediaViewer from "@/app/components/media/GlobalMediaViewer";
import { ActivityTracker } from "@/components/ActivityTracker";
import { WorkspaceProvider } from "@/app/context/WorkspaceContext";

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
      <body className={inter.className} style={{ backgroundColor: '#030303', color: 'white' }} suppressHydrationWarning={true}>

        <Script
          id="razorpay-checkout"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />

        <MediaViewerProvider>
          <GlobalMediaViewer />

          {/* CHANGED: Removed 'h-screen w-screen'. Used 'min-h-screen' so pages can scroll if needed. */}
          <div className="min-h-screen flex flex-col relative">
            <Script
              id="json-ld"
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <AuthProvider>
              <WorkspaceProvider>
              <ActivityTracker />
              {/* <div className="vignette pointer-events-none fixed inset-0 z-50" /> */}

              {/* GlobalHeader handles its own visibility */}
              <Suspense fallback={null}>
                <GlobalHeader />
              </Suspense>

              {/* MAIN CONTENT: flex-1 ensures it fills space, but doesn't force clipping */}
              <main className="flex-1 flex flex-col relative z-0">
                {children}
              </main>

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
              </WorkspaceProvider>
            </AuthProvider>
          </div>
        </MediaViewerProvider>
      </body>
    </html>
  );
}