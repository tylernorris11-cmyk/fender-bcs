import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fender Steel — Control Centre',
    short_name: 'FenderBCS',
    description: 'Orders, production, stock, customers and CARES compliance for Fender Steel.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D4A42',
    theme_color: '#0D4A42',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
