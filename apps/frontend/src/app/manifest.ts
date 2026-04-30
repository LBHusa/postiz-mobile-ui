import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Husatech Social',
    short_name: 'HS',
    description: 'Mobile Content-Planung fuer Husatech',
    start_url: '/m/kalender',
    display: 'standalone',
    theme_color: '#0a0a0a',
    background_color: '#0a0a0a',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/pwa/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/pwa/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
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
