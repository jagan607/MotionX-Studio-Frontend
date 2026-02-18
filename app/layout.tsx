import type { Metadata } from "next";
import { Inter, Anton, Roboto_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GlobalHeader from "@/components/GlobalHeader";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { MediaViewerProvider } from "@/app/context/MediaViewerContext";
import GlobalMediaViewer from "@/app/components/media/GlobalMediaViewer";
import { ActivityTracker } from "@/components/ActivityTracker";

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
  title: "MotionX Studio | Direct AI Cinema",
  description: "The first AI-native operating system for filmmakers.",
  metadataBase: new URL('https://studio.motionx.in'),
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
    "description": "The first AI-native operating system for filmmakers.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "10 Free Credits on Signup"
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
              <ActivityTracker />
              {/* <div className="vignette pointer-events-none fixed inset-0 z-50" /> */}

              {/* GlobalHeader handles its own visibility */}
              <GlobalHeader />

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
            </AuthProvider>
          </div>
        </MediaViewerProvider>
      </body>
    </html>
  );
}