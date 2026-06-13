'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { UserContext } from '@/lib/user-context'
import {
  Home, PlusCircle, Clock, Bell, Settings, LogOut, Menu, X, Plus, Search,
  Package, Users2, Network, FolderKanban, Lightbulb, CalendarCheck, Briefcase,
  CheckSquare, CalendarDays, Rss, ExternalLink, GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import SearchModal from '@/components/SearchModal'

const ADMIN_NAV = [
  { href: '/',           label: 'Focus',     icon: Home },
  { href: '/idees',      label: 'Idées',     icon: Lightbulb },
  { href: '/projets',    label: 'Projets',   icon: FolderKanban },
  { href: '/prospects',  label: 'Prospects', icon: Users2 },
  { href: '/reseau',     label: 'Réseau',    icon: Network },
  { href: '/hebdo',      label: 'Hebdo',     icon: CalendarCheck },
  { href: '/lab',        label: 'Lab',       icon: GraduationCap },
  { href: '/parametres', label: 'Paramètres',icon: Settings },
]

// Visible dans sidebar + burger, absent de la barre mobile
const ADMIN_EXTRA = [
  { href: '/taches',      label: 'Toutes les tâches', icon: CheckSquare },
  { href: '/evenements',  label: 'Événements',         icon: CalendarDays },
  { href: '/veille',      label: 'Veille contenu',     icon: Rss },
  { href: '/missions',    label: 'Missions',            icon: Briefcase },
  { href: '/devis',       label: 'Devis',               icon: PlusCircle },
]

// Liens rapides Notion — ajouter les URLs au fur et à mesure
const NOTION_LINKS = [
  { label: '🏠 Hub YaatalCo',       url: 'https://app.notion.com/p/YaatalCo-34233578e13f81b5baa8d76ac6ff4c13' },
  { label: '📋 Pipeline outbound',   url: 'https://app.notion.com/p/Pipeline-outbound-35033578e13f81e5b873c05eb8cd7ac9' },
  { label: '📚 Fondations YaatalCo', url: 'https://app.notion.com/p/Fondations-Yaatal-Co-34233578e13f811f8fcff9d983803e71' },
].filter(l => l.url.length > 0)

const CLIENT_NAV = [
  { href: '/',           label: 'Accueil',   icon: Home },
  { href: '/devis',      label: 'Créer',     icon: PlusCircle },
  { href: '/historique', label: 'Historique',icon: Clock },
  { href: '/relances',   label: 'Relances',  icon: Bell },
  { href: '/parametres', label: 'Catalogue', icon: Package },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [checking,    setChecking]    = useState(true)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [userEmail,   setUserEmail]   = useState<string | null>(null)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [quickOpen,     setQuickOpen]     = useState(false)
  const [quickType,     setQuickType]     = useState<'tache' | 'idee' | null>(null)
  const [quickTexte,    setQuickTexte]    = useState('')
  const [quickPrio,     setQuickPrio]     = useState<'haute' | 'normale' | 'basse'>('normale')
  const [quickProjetId, setQuickProjetId] = useState('')
  const [quickProjets,  setQuickProjets]  = useState<{ id: string; nom: string }[]>([])
  const [quickSaving,   setQuickSaving]   = useState(false)
  const [quickSuccess,  setQuickSuccess]  = useState<'tache' | 'idee' | null>(null)

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isAdmin    = !adminEmail || userEmail === adminEmail

  const navItems   = isAdmin ? ADMIN_NAV   : CLIENT_NAV
  const extraItems = isAdmin ? ADMIN_EXTRA : []
  const mobileNav  = navItems.slice(0, 5)  // Focus · Idées · Projets · Prospects · Réseau

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else { setChecking(false); setUserEmail(data.session.user.email ?? null) }
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function openQuick() {
    setQuickType(null)
    setQuickTexte('')
    setQuickPrio('normale')
    setQuickProjetId('')
    setQuickSuccess(null)
    setQuickOpen(true)
    // Charge les projets actifs pour le sélecteur
    supabase.from('projets').select('id, nom').in('statut', ['actif', 'en_pause']).order('nom')
      .then(({ data }) => setQuickProjets(data ?? []))
  }

  async function saveQuickTache() {
    if (!quickTexte.trim()) return
    setQuickSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('taches').insert({
      texte: quickTexte.trim(), faite: false, date: today,
      priorite: quickPrio, source: 'manuel',
      projet_id: quickProjetId || null, etape_id: null,
    })
    setQuickSaving(false)
    if (!error) {
      setQuickSuccess('tache')
      setTimeout(() => { setQuickOpen(false); setQuickSuccess(null) }, 2200)
    }
  }

  async function saveQuickIdee() {
    if (!quickTexte.trim()) return
    setQuickSaving(true)
    const { error } = await supabase.from('idees').insert({
      texte: quickTexte.trim(), statut: 'capture', notes: null, projet_id: null,
    })
    setQuickSaving(false)
    if (!error) {
      setQuickSuccess('idee')
      setTimeout(() => { setQuickOpen(false); setQuickSuccess(null) }, 2200)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center">
        <div className="text-primary font-bold text-xl animate-pulse">✨ Fayko</div>
      </div>
    )
  }

  function NavLink({ href, label, icon: Icon, onClick }: {
    href: string; label: string; icon: React.ElementType; onClick?: () => void
  }) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
          pathname === href
            ? 'bg-primary-light text-primary'
            : 'text-muted hover:bg-beige-100 hover:text-ink'
        )}
      >
        <Icon size={18} />
        {label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-beige">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-surface border-r border-border flex-col z-30">
        <div className="p-4 border-b border-border space-y-3">
          <span className="text-xl font-bold text-primary">✨ Fayko</span>
          {isAdmin && (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 bg-beige-50 border border-border rounded-xl px-3 py-2 text-sm text-muted hover:border-primary/30 hover:text-stone-700 transition"
            >
              <Search size={14} />
              Rechercher…
            </button>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => <NavLink key={item.href} {...item} />)}
          {extraItems.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <span className="text-[10px] font-semibold text-stone-300 uppercase tracking-wider">Outils</span>
              </div>
              {extraItems.map(item => <NavLink key={item.href} {...item} />)}
            </>
          )}
          {NOTION_LINKS.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <span className="text-[10px] font-semibold text-stone-300 uppercase tracking-wider">Notion</span>
              </div>
              {NOTION_LINKS.map(link => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-beige-100 hover:text-stone-800 transition"
                >
                  <ExternalLink size={16} className="shrink-0 text-stone-300" />
                  {link.label}
                </a>
              ))}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:bg-beige-100 w-full transition"
          >
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-surface border-b border-border z-30 px-4 h-14 flex items-center justify-between">
        <span className="text-lg font-bold text-primary">✨ Fayko</span>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button onClick={() => setSearchOpen(true)} className="p-2 text-muted hover:text-stone-700 transition">
              <Search size={20} />
            </button>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 text-muted">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile burger menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 bg-surface z-20 pt-14 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navItems.map(item => (
              <NavLink key={item.href} {...item} onClick={() => setMenuOpen(false)} />
            ))}
            {extraItems.length > 0 && (
              <>
                <div className="pt-4 pb-1 px-4">
                  <span className="text-[10px] font-semibold text-stone-300 uppercase tracking-wider">Outils</span>
                </div>
                {extraItems.map(item => (
                  <NavLink key={item.href} {...item} onClick={() => setMenuOpen(false)} />
                ))}
              </>
            )}
            {NOTION_LINKS.length > 0 && (
              <>
                <div className="pt-4 pb-1 px-4">
                  <span className="text-[10px] font-semibold text-stone-300 uppercase tracking-wider">Notion</span>
                </div>
                {NOTION_LINKS.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-beige-100 hover:text-stone-800 transition"
                  >
                    <ExternalLink size={16} className="shrink-0 text-stone-300" />
                    {link.label}
                  </a>
                ))}
              </>
            )}
            <div className="pt-4 border-t border-border mt-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted w-full"
              >
                <LogOut size={20} /> Déconnexion
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="md:ml-56 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <UserContext.Provider value={{ isAdmin }}>
            {children}
          </UserContext.Provider>
        </div>
      </main>

      {/* ── Recherche globale ── */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

      {/* ── Bouton flottant capture rapide (admin seulement) ── */}
      {isAdmin && (
        <>
          <button
            onClick={openQuick}
            className="fixed bottom-[72px] right-4 md:bottom-6 md:right-6 z-40 w-13 h-13 w-[52px] h-[52px] bg-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-primary-dark transition active:scale-95"
            aria-label="Capture rapide"
          >
            <Plus size={24} />
          </button>

          {quickOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
              onClick={() => setQuickOpen(false)}
            >
              <div
                className="bg-surface w-full max-w-lg rounded-t-3xl p-6 space-y-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-1 bg-border rounded-full mx-auto" />
                <h2 className="font-bold text-ink text-center text-base">Capture rapide</h2>

                {quickSuccess ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-5xl">{quickSuccess === 'tache' ? '✅' : '💡'}</p>
                    <p className="font-bold text-ink text-base">
                      {quickSuccess === 'tache' ? 'Tâche ajoutée !' : 'Idée capturée !'}
                    </p>
                    <p className="text-sm text-muted">
                      {quickSuccess === 'tache'
                        ? 'Tu la retrouveras dans tes tâches du jour'
                        : 'Tu la retrouveras dans tes idées'}
                    </p>
                    <Link
                      href={quickSuccess === 'tache' ? '/taches' : '/idees'}
                      onClick={() => { setQuickOpen(false); setQuickSuccess(null) }}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      Voir {quickSuccess === 'tache' ? 'mes tâches' : 'mes idées'} →
                    </Link>
                  </div>
                ) : !quickType ? (
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    <button
                      onClick={() => setQuickType('tache')}
                      className="flex flex-col items-center gap-2 p-5 border-2 border-border rounded-2xl hover:border-primary/40 hover:bg-primary-light transition"
                    >
                      <span className="text-3xl">✅</span>
                      <span className="font-bold text-ink text-sm">Tâche</span>
                      <span className="text-xs text-muted text-center">À faire aujourd'hui</span>
                    </button>
                    <button
                      onClick={() => setQuickType('idee')}
                      className="flex flex-col items-center gap-2 p-5 border-2 border-border rounded-2xl hover:border-primary/40 hover:bg-primary-light transition"
                    >
                      <span className="text-3xl">💡</span>
                      <span className="font-bold text-ink text-sm">Idée</span>
                      <span className="text-xs text-muted text-center">Capturer une idée</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pb-2">
                    <textarea
                      autoFocus
                      value={quickTexte}
                      onChange={e => setQuickTexte(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          quickType === 'tache' ? saveQuickTache() : saveQuickIdee()
                        }
                      }}
                      placeholder={quickType === 'tache' ? 'Décris la tâche...' : 'Ton idée...'}
                      rows={3}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-beige-50"
                    />

                    {quickType === 'tache' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {(['haute', 'normale', 'basse'] as const).map(p => (
                            <button
                              key={p}
                              onClick={() => setQuickPrio(p)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                                quickPrio === p
                                  ? p === 'haute'   ? 'bg-red-500 text-white border-red-500'
                                  : p === 'normale' ? 'bg-navy text-white border-navy'
                                  :                   'bg-beige-100 text-muted border-border'
                                  : 'border-border text-muted hover:border-primary/20'
                              }`}
                            >
                              {p === 'haute' ? 'Haute' : p === 'normale' ? 'Normale' : 'Basse'}
                            </button>
                          ))}
                        </div>
                        {quickProjets.length > 0 && (
                          <select
                            value={quickProjetId}
                            onChange={e => setQuickProjetId(e.target.value)}
                            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-ink bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <option value="">— Aucun projet</option>
                            {quickProjets.map(p => (
                              <option key={p.id} value={p.id}>{p.nom}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setQuickType(null)}
                        className="px-4 py-3 text-sm text-muted border border-border rounded-xl hover:bg-beige-100 transition"
                      >
                        ←
                      </button>
                      <button
                        onClick={quickType === 'tache' ? saveQuickTache : saveQuickIdee}
                        disabled={!quickTexte.trim() || quickSaving}
                        className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-primary-dark transition"
                      >
                        {quickSaving ? 'Enregistrement...' : 'Sauvegarder'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-30 flex">
        {mobileNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 text-xs gap-1',
              pathname === href ? 'text-primary' : 'text-muted'
            )}
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
