import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyBuddy',
    short_name: 'StudyBuddy',
    description: 'Track focused study sessions, tasks and schedule offline-first.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [
      { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/web-app-manifest-512x512.png', sizes: '384x384', type: 'image/png', purpose: 'maskable' },
      { src: '/web-app-manifest-192x192.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/web-app-manifest-192x192.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: '/web-app-manifest-192x192.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
    ],
  }
}