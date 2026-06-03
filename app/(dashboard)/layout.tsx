'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { UserContext } from '@/lib/user-context'
import {
  Home, PlusCircle, Clock, Bell, Settings, LogOut, Menu, X, Plus, Search,
  Package, Users2, Network, FolderKanban, Lightbulb, CalendarCheck, Briefcase,
  CheckSquare, CalendarDays, Rss,
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
  const [quickOpen,   setQuickOpen]   = useState(false)
  const [quickType,   setQuickType]   = useState<'tache' | 'idee' | null>(null)
  const [quickTexte,  setQuickTexte]  = useState('')
  const [quickPrio,   setQuickPrio]   = useState<'haute' | 'normale' | 'basse'>('normale')
  const [quickSaving, setQuickSaving] = useState(false)

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
    setQuickOpen(true)
  }

  async function saveQuickTache() {
    if (!quickTexte.trim()) return
    setQuickSaving(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('taches').insert({
      texte: quickTexte.trim(), faite: false, date: today,
      priorite: quickPrio, source: 'manuel', projet_id: null, etape_id: null,
    })
    setQuickOpen(false)
    setQuickSaving(false)
  }

  async function saveQuickIdee() {
    if (!quickTexte.trim()) return
    setQuickSaving(true)
    await supabase.from('idees').insert({
      texte: quickTexte.trim(), statut: 'capture', notes: null, projet_id: null,
    })
    setQuickOpen(false)
    setQuickSaving(false)
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
            : 'text-muted hover:bg-beige-100 hover:text-stone-800'
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
                className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto" />
                <h2 className="font-bold text-stone-800 text-center text-base">Capture rapide</h2>

                {!quickType ? (
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    <button
                      onClick={() => setQuickType('tache')}
                      className="flex flex-col items-center gap-2 p-5 border-2 border-border rounded-2xl hover:border-primary/40 hover:bg-primary-light transition"
                    >
                      <span className="text-3xl">✅</span>
                      <span className="font-bold text-stone-700 text-sm">Tâche</span>
                      <span className="text-xs text-muted text-center">À faire aujourd'hui</span>
                    </button>
                    <button
                      onClick={() => setQuickType('idee')}
                      className="flex flex-col items-center gap-2 p-5 border-2 border-border rounded-2xl hover:border-primary/40 hover:bg-primary-light transition"
                    >
                      <span className="text-3xl">💡</span>
                      <span className="font-bold text-stone-700 text-sm">Idée</span>
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
                      <div className="flex gap-2">
                        {(['haute', 'normale', 'basse'] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => setQuickPrio(p)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                              quickPrio === p
                                ? p === 'haute'   ? 'bg-red-500 text-white border-red-500'
                                : p === 'normale' ? 'bg-stone-600 text-white border-stone-600'
                                :                   'bg-stone-200 text-stone-600 border-stone-200'
                                : 'border-border text-muted hover:border-stone-300'
                            }`}
                          >
                            {p === 'haute' ? 'Haute' : p === 'normale' ? 'Normale' : 'Basse'}
                          </button>
                        ))}
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
