import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OvoCore Autonomous Poultry Management',
    short_name: 'OvoCore',
    description: 'Precision egg production, flock telemetry, silo tracking, and unit economics for modern commercial poultry farms.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#f59e0b',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/ovocore-icon.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: '/ovocore-icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
    ],
  };
}
