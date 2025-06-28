import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tabular Reviews - AI-Powered Document Analysis',
  description: 'Transform your documents into structured data with advanced AI analysis and secure processing.',
  keywords: 'AI, document analysis, data extraction, tabular data, document processing, machine learning',
  authors: [{ name: 'Tabular Reviews Team' }],
  creator: 'Tabular Reviews',
  publisher: 'Tabular Reviews',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
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
  verification: {
    // Add your verification tokens here when deploying
    // google: 'your-google-verification-token',
    // yandex: 'your-yandex-verification-token',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Tabular Reviews - AI-Powered Document Analysis',
    description: 'Transform your documents into structured data with advanced AI analysis and secure processing.',
    siteName: 'Tabular Reviews',
    images: [
      {
        url: '/og-image.png', // Add this image to your public folder
        width: 1200,
        height: 630,
        alt: 'Tabular Reviews - AI-Powered Document Analysis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tabular Reviews - AI-Powered Document Analysis',
    description: 'Transform your documents into structured data with advanced AI analysis and secure processing.',
    images: ['/og-image.png'],
    creator: '@tabularreviews', // Replace with your Twitter handle
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#3b82f6',
      },
    ],
  },
  // manifest: '/site.webmanifest',
  other: {
    'msapplication-TileColor': '#3b82f6',
    'theme-color': '#ffffff',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Security Headers */}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta httpEquiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=()" />
        
        {/* Content Security Policy */}
        <meta
          httpEquiv="Content-Security-Policy"
          content={`
            default-src 'self';
            script-src 'self' 'unsafe-inline' 'unsafe-eval' ${process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : ''};
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            img-src 'self' data: https: blob:;
            font-src 'self' https://fonts.gstatic.com;
            connect-src 'self' http://localhost:8000 https://localhost:8000 ${process.env.NEXT_PUBLIC_API_URL || ''} wss: ws: ${process.env.NEXT_PUBLIC_SUPABASE_URL} wss://knqkunivquuuvnfwrqrn.supabase.co;
            media-src 'self';
            object-src 'none';
            base-uri 'self';
            form-action 'self';
            frame-ancestors 'none';
          `.replace(/\s+/g, ' ').trim()
        }
        />
        
        {/* CSRF Token Placeholder */}
        <meta name="csrf-token" content="" />
        
        {/* DNS Prefetch for Performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        
        {/* Preconnect for Performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        
        {/* Security: Don't expose technology stack */}
        <meta name="generator" content="" />
        
        {/* Prevent automatic phone number detection */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {/* Security: Add nonce for inline scripts if needed */}
        <noscript>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            flexDirection: 'column',
            textAlign: 'center',
            padding: '2rem'
          }}>
            <h1 style={{ color: '#1f2937', marginBottom: '1rem' }}>
              JavaScript Required
            </h1>
            <p style={{ color: '#6b7280', maxWidth: '32rem' }}>
              Tabular Reviews requires JavaScript to function properly. 
              Please enable JavaScript in your browser settings to continue.
            </p>
          </div>
        </noscript>
        
        {/* <AuthProvider> */}
          <Providers>
            <div id="app-root" className="min-h-screen">
              {children}
            </div>
          </Providers>
        {/* </AuthProvider> */}
        
        {/* Error Boundary Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                console.error('Global error:', e.error);
                // You can add error reporting here
              });
              
              window.addEventListener('unhandledrejection', function(e) {
                console.error('Unhandled promise rejection:', e.reason);
                // You can add error reporting here
              });
            `
          }}
        />
        
        {/* Service Worker Registration */}
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js')
                      .then(function(registration) {
                        console.log('SW registered: ', registration);
                      })
                      .catch(function(registrationError) {
                        console.log('SW registration failed: ', registrationError);
                      });
                  });
                }
              `
            }}
          />
        )}
      </body>
    </html>
  )
}