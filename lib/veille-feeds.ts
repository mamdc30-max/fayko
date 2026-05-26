import type { VeilleCategorie, VeilleType } from './types'

export interface FeedConfig {
  url: string
  categorie: VeilleCategorie
  type: VeilleType
  label: string
  maxItems: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration des flux RSS de la veille hebdo
//
// Pour ajouter un flux :
//   1. Trouve son URL RSS (en général : site.com/feed/ pour les blogs WordPress)
//   2. Pour un podcast : ouvre Apple Podcasts → ⋯ → Copier le flux RSS
// ─────────────────────────────────────────────────────────────────────────────

export const VEILLE_FEEDS: FeedConfig[] = [

  // ── 📢 Communication & Branding ──────────────────────────────────────────
  {
    url: 'https://www.blogdumoderateur.com/feed/',
    categorie: 'communication',
    type: 'article',
    label: 'Blog du Modérateur',
    maxItems: 2,
  },
  {
    url: 'https://siecledigital.fr/feed/',
    categorie: 'communication',
    type: 'article',
    label: 'Siècle Digital',
    maxItems: 1,
  },
  {
    url: 'https://www.journalducommunitymanager.fr/feed/',
    categorie: 'communication',
    type: 'article',
    label: 'Journal du CM',
    maxItems: 1,
  },

  // ── 🌍 Diaspora & Entrepreneuriat ────────────────────────────────────────
  {
    url: 'https://www.theafricareport.com/feed/',
    categorie: 'diaspora',
    type: 'article',
    label: 'The Africa Report',
    maxItems: 2,
  },
  {
    url: 'https://www.jeuneafrique.com/rss/',
    categorie: 'diaspora',
    type: 'article',
    label: 'Jeune Afrique',
    maxItems: 2,
  },

  // ── 💼 LinkedIn & Réseaux sociaux ────────────────────────────────────────
  {
    url: 'https://www.socialmediaexaminer.com/feed/',
    categorie: 'linkedin',
    type: 'article',
    label: 'Social Media Examiner',
    maxItems: 2,
  },
  {
    url: 'https://www.swello.com/fr/blog/feed/',
    categorie: 'linkedin',
    type: 'article',
    label: 'Swello Blog',
    maxItems: 1,
  },

  // ── 🤖 Outils & IA ───────────────────────────────────────────────────────
  {
    url: 'https://www.producthunt.com/feed',
    categorie: 'outils',
    type: 'outil',
    label: 'Product Hunt',
    maxItems: 3,
  },
  {
    url: 'https://www.usine-digitale.fr/rss.xml',
    categorie: 'outils',
    type: 'article',
    label: "L'Usine Digitale",
    maxItems: 1,
  },
  {
    url: 'https://www.numerama.com/feed/',
    categorie: 'outils',
    type: 'article',
    label: 'Numerama',
    maxItems: 1,
  },

  // ── 🎧 Podcasts ───────────────────────────────────────────────────────────
  // Les descriptions d'épisodes RSS servent de résumé (Claude les reformule si ANTHROPIC_API_KEY est définie)
  {
    url: 'https://feeds.acast.com/public/shows/generation-do-it-yourself',
    categorie: 'communication',
    type: 'podcast',
    label: 'Génération Do It Yourself',
    maxItems: 1,
  },
  {
    // Marketing Square — Xavier Chabanne
    // Si cette URL ne fonctionne pas : cherche "Marketing Square RSS" sur Podcastaddict
    url: 'https://feed.ausha.co/marketing-square',
    categorie: 'communication',
    type: 'podcast',
    label: 'Marketing Square',
    maxItems: 1,
  },
  {
    url: 'https://visionarymarketing.com/fr/feed/podcast/',
    categorie: 'communication',
    type: 'podcast',
    label: 'Visionary Marketing',
    maxItems: 1,
  },
]
