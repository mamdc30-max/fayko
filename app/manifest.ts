import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fayko',
    short_name: 'Fayko',
    description: 'Pilotage YaatalCo — focus, projets, prospects, missions',
    theme_color: '#d97706',
    background_color: '#faf8f5',
    display: 'standalone',
    start_url: '/',
    orientation: 'portrait',
    icons: [
      {
        src: '/api/pwa-icon/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/api/pwa-icon/512',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/api/pwa-icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Focus du jour',
        url: '/',
        description: 'Brief et taches du jour',
      },
      {
        name: 'Missions',
        url: '/missions',
        description: 'Missions detectees par la veille',
      },
    ],
  }
}
