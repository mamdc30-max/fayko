'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { UserContext } from '@/lib/user-context'
import { Home, PlusCircle, Clock, Bell, Settings, LogOut, Menu, X, Package, Users2, Network, ListChecks, Newspaper, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isAdmin = !adminEmail || userEmail === adminEmail

  const navItems = isAdmin ? [
    { href: '/', label: 'Brief', icon: Home },
    { href: '/taches', label: 'Tâches', icon: ListChecks },
    { href: '/projets', label: 'Projets', icon: FolderKanban },
    { href: '/devis', label: 'Devis', icon: PlusCircle },
    { href: '/prospects', label: 'Prospects', icon: Users2 },
    { href: '/contacts', label: 'Réseau', icon: Network },
    { href: '/veille', label: 'Veille', icon: Newspaper },
    { href: '/parametres', label: 'Paramètres', icon: Settings },
  ] : [
    { href: '/', label: 'Accueil', icon: Home },
    { href: '/devis', label: 'Créer', icon: PlusCircle },
    { href: '/historique', label: 'Historique', icon: Clock },
    { href: '/relances', label: 'Relances', icon: Bell },
    { href: '/parametres', label: 'Catalogue', icon: Package },
  ]

  const mobileNavItems = navItems.slice(0, 5)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else {
        setChecking(false)
        setUserEmail(data.session.user.email ?? null)
      }
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center">
        <div className="text-primary font-bold text-xl animate-pulse">✨ Fayko</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-beige">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-surface border-r border-border flex-col z-30">
        <div className="p-6 border-b border-border">
          <span className="text-xl font-bold text-primary">✨ Fayko</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
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
          ))}
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
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 text-muted">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile full menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 bg-surface z-20 pt-14">
          <nav className="p-4 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition',
                  pathname === href ? 'bg-primary-light text-primary' : 'text-stone-700'
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted w-full mt-4"
            >
              <LogOut size={20} /> Déconnexion
            </button>
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

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-30 flex">
        {mobileNavItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 text-xs gap-1 relative',
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
