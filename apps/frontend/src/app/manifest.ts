import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Postiz Mobile',
    short_name: 'Postiz',
    description: 'Mobile Content-Planung mit Postiz',
    start_url: '/m/kalender',
    scope: '/m/',
    id: '/m/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#0a0a0a',
    background_color: '#0a0a0a',
    lang: 'de',
    dir: 'ltr',
    categories: ['productivity', 'business', 'social'],
    icons: [
      {
        src: '/icons/pwa/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/pwa/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/pwa/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/pwa/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
