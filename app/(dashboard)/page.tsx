'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPrice, STATUT_COLORS } from '@/lib/utils'
import { Bell, Plus, Check, Trash2, CalendarDays, Network } from 'lucide-react'
import type { Devis, Client, Tache, ContactReseau, AutomationLog } from '@/lib/types'
import { useUserContext } from '@/lib/user-context'

interface DevisWithClient extends Devis { clients: Client }

interface Stats {
  caMois: number
  enAttente: number
}

export default function HomePage() {
  const [relances, setRelances] = useState<DevisWithClient[]>([])
  const [recent, setRecent] = useState<DevisWithClient[]>([])
  const [stats, setStats] = useState<Stats>({ caMois: 0, enAttente: 0 })
  const [catalogReady, setCatalogReady] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taches, setTaches] = useState<Tache[]>([])
  const [newTache, setNewTache] = useState('')
  const [showAllTaches, setShowAllTaches] = useState(false)
  const [contactsRelance, setContactsRelance] = useState<ContactReseau[]>([])
  const [autoLogs, setAutoLogs]               = useState<AutomationLog[]>([])
  const { isAdmin } = useUserContext()

  useEffect(() => {
    async function load() {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      if (isAdmin) {
        // Tâches du jour
        const today = new Date().toISOString().split('T')[0]
        const { data: t } = await supabase.from('taches').select('*').eq('date', today).order('created_at')
        if (t) setTaches(t)

        // Contacts réseau J+3 à recontacter
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
        const { data: cr } = await supabase
          .from('contacts_reseau')
          .select('*')
          .eq('rappel_fait', false)
          .lte('created_at', threeDaysAgo.toISOString())
        if (cr) setContactsRelance(cr)

        // Derniers logs d'automation (1 par tâche)
        const { data: logs } = await supabase
          .from('automation_logs')
          .select('*')
          .order('ran_at', { ascending: false })
          .limit(6)
        if (logs) {
          // Garder seulement la dernière exécution de chaque task
          const seen = new Set<string>()
          const deduplicated = logs.filter(l => {
            if (seen.has(l.task_name)) return false
            seen.add(l.task_name); return true
          })
          setAutoLogs(deduplicated)
        }
      }

      const [{ data: allDevis }, { data: relancesData }] = await Promise.all([
        supabase.from('devis').select('*, clients(*)').order('created_at', { ascending: false }),
        supabase
          .from('devis')
          .select('*, clients(*), relances(effectuee)')
          .eq('statut', 'Envoyé')
          .lt('created_at', sevenDaysAgo.toISOString()),
      ])

      if (allDevis) {
        const d = allDevis as DevisWithClient[]
        setRecent(d.slice(0, 5))
        const caMois = d
          .filter(x => x.statut === 'Soldé' && new Date(x.updated_at) >= startOfMonth)
          .reduce((s, x) => s + x.total_ht, 0)
        const enAttente = d
          .filter(x => ['Envoyé', 'Validé', 'Acompte reçu'].includes(x.statut))
          .reduce((s, x) => s + x.total_ht, 0)
        setStats({ caMois, enAttente })
      }

      if (relancesData) {
        const pending = (relancesData as (DevisWithClient & { relances: { effectuee: boolean }[] })[])
          .filter(d => !d.relances?.length || d.relances.every(r => !r.effectuee))
        setRelances(pending)
      }

      if (!isAdmin) {
        const { count } = await supabase.from('forfaits').select('id', { count: 'exact', head: true })
        setCatalogReady((count ?? 0) > 0)
        const seen = localStorage.getItem('onboarding_done')
        if (!seen) setShowOnboarding(true)
      }

      setLoading(false)
    }
    load()
  }, [isAdmin])

  async function addTache() {
    if (!newTache.trim()) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('taches')
      .insert({ texte: newTache.trim(), date: today, source: 'manuel' })
      .select()
      .single()
    if (data) setTaches(prev => [...prev, data])
    setNewTache('')
  }

  async function toggleTache(id: string, faite: boolean) {
    await supabase.from('taches').update({ faite, faite_at: faite ? new Date().toISOString() : null }).eq('id', id)
    setTaches(prev => prev.map(t => t.id === id ? { ...t, faite, faite_at: faite ? new Date().toISOString() : null } : t))
  }

  async function deleteTache(id: string) {
    await supabase.from('taches').delete().eq('id', id)
    setTaches(prev => prev.filter(t => t.id !== id))
  }

  async function markRappelFait(id: string) {
    await supabase.from('contacts_reseau').update({ rappel_fait: true }).eq('id', id)
    setContactsRelance(prev => prev.filter(c => c.id !== id))
  }

  function dismissOnboarding() {
    localStorage.setItem('onboarding_done', '1')
    setShowOnboarding(false)
  }

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  /* ==================== VUE BTOC ==================== */
  if (!isAdmin) {
    if (showOnboarding) {
      return (
        <div className="space-y-5">
          <div className="bg-primary rounded-2xl p-6">
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-2">Bienvenue sur Fayko ✨</p>
            <h2 className="text-white font-bold text-xl leading-snug mb-3">
              Plus jamais une vente perdue dans tes notes
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Tes commandes notées à la va-vite, sans suivi, sans relance, sans vraiment savoir ce que tu gagnes… C'est fini.
            </p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
            {[
              { icon: '📦', title: 'Chaque commande bien conservée', desc: 'Fini les notes éparpillées — tout est centralisé, sécurisé, retrouvable à tout moment.' },
              { icon: '💬', title: 'Envoi WhatsApp en 1 clic', desc: 'Un récap de commande propre avec ton lien de paiement intégré, prêt à envoyer.' },
              { icon: '🔔', title: 'Relances automatiques J+7', desc: "Si pas de réponse après 7 jours, Fayko te le rappelle. Fini l'argent oublié." },
              { icon: '📈', title: 'Ta progression en temps réel', desc: 'Vois ce que tu encaisses, ce qui est en attente et comment ton activité évolue.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{title}</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">💡 Important avant de commencer</p>
            <p className="text-sm text-amber-700 leading-relaxed">
              Configure tes messages WhatsApp pour y intégrer ton lien de paiement (Revolut, Wero, PayPal, virement…). 2 minutes pour ne plus jamais perdre un règlement.
            </p>
          </div>

          <div className="bg-primary-light border border-primary/20 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Par où commencer ?</p>
            {[
              { n: '1', label: 'Configure tes messages de paiement', done: false },
              { n: '2', label: 'Ajoute tes articles dans le catalogue', done: catalogReady },
              { n: '3', label: 'Crée ta première commande', done: recent.length > 0 },
            ].map(({ n, label, done }) => (
              <div key={n} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-primary text-white'}`}>
                  {done ? '✓' : n}
                </span>
                <p className={`text-sm ${done ? 'text-muted line-through' : 'text-stone-700'}`}>{label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Link href="/parametres" onClick={dismissOnboarding}
              className="flex-1 bg-primary text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-primary-dark transition text-center">
              Configurer mes messages
            </Link>
            <button onClick={dismissOnboarding}
              className="text-sm text-muted px-4 py-3 rounded-xl border border-border hover:bg-beige-50 transition">
              Passer
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Bonjour 👋</h1>
          <p className="text-muted text-sm mt-0.5">
            {recent.length === 0 ? 'Prête à créer ta première commande ?' : `${recent.length} commande${recent.length > 1 ? 's' : ''} au total`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary rounded-2xl p-4 text-white">
            <p className="text-xs text-white/70 mb-1">Encaissé ce mois</p>
            <p className="text-2xl font-bold">{formatPrice(stats.caMois)}</p>
          </div>
          <div className="bg-surface rounded-2xl p-4 border border-border">
            <p className="text-xs text-muted mb-1">En attente</p>
            <p className="text-2xl font-bold text-amber-600">{formatPrice(stats.enAttente)}</p>
          </div>
        </div>

        <Link href="/devis"
          className="bg-primary rounded-2xl p-5 flex items-center justify-between hover:bg-primary-dark transition">
          <div>
            <p className="font-bold text-white text-lg">Nouvelle commande</p>
            <p className="text-white/70 text-xs mt-0.5">
              {catalogReady ? 'Choisis dans ton catalogue et envoie sur WhatsApp' : 'Envoie sur WhatsApp en 30 secondes'}
            </p>
          </div>
          <span className="text-4xl">✨</span>
        </Link>

        {relances.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={16} className="text-amber-600" />
              <h2 className="font-semibold text-amber-700 text-sm">
                {relances.length} relance{relances.length > 1 ? 's' : ''} en attente
              </h2>
            </div>
            <div className="space-y-2">
              {relances.slice(0, 2).map(d => (
                <Link key={d.id} href={`/devis/${d.id}`}
                  className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                  <p className="text-sm font-medium text-stone-800">{d.clients.prenom} {d.clients.nom}</p>
                  <span className="text-sm font-semibold text-primary">{formatPrice(d.total_ht)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-stone-800 text-sm">Commandes récentes</h2>
              <Link href="/historique" className="text-xs text-primary font-medium">Voir tout</Link>
            </div>
            <div className="space-y-2">
              {recent.slice(0, 3).map(d => (
                <Link key={d.id} href={`/devis/${d.id}`}
                  className="flex items-center justify-between bg-surface rounded-xl px-4 py-3 border border-border hover:border-primary/30 transition">
                  <div>
                    <p className="text-sm font-medium text-stone-800">{d.clients.prenom} {d.clients.nom}</p>
                    <p className="text-xs text-muted">{d.titre} • {formatDate(d.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-stone-800">{formatPrice(d.total_ht)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[d.statut]}`}>{d.statut}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {recent.length === 0 && (
          <div className="text-center py-8 text-muted">
            <p className="text-3xl mb-3">📦</p>
            <p className="text-sm font-medium text-stone-700">Aucune commande pour l'instant</p>
            <p className="text-xs mt-1">Crée ta première commande ci-dessus</p>
          </div>
        )}
      </div>
    )
  }

  /* ==================== VUE ADMIN = BRIEF QUOTIDIEN ==================== */
  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const agendaTaches = taches.filter(t => t.source === 'agenda')
  const manualTaches = taches.filter(t => t.source !== 'agenda')
  const pendingManual = manualTaches.filter(t => !t.faite)
  const doneTaches = manualTaches.filter(t => t.faite)
  const visiblePending = showAllTaches ? pendingManual : pendingManual.slice(0, 3)

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <p className="text-xs text-muted capitalize">{todayLabel}</p>
        <h1 className="text-2xl font-bold text-stone-800">Bonjour 👋</h1>
      </div>

      {/* Block 1 — Agenda du jour */}
      <section className="space-y-2">
        <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
          <CalendarDays size={15} className="text-primary" /> Agenda du jour
        </h2>
        {agendaTaches.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted">Aucun événement importé · Demande ton brief à Claude pour synchroniser l'agenda</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {agendaTaches.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-surface rounded-xl px-3 py-2.5 border border-border">
                <span className={`w-2 h-2 rounded-full shrink-0 ${t.faite ? 'bg-green-400' : 'bg-primary'}`} />
                <span className={`text-sm ${t.faite ? 'text-muted line-through' : 'text-stone-700'}`}>{t.texte}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Block 2 — Tâches du jour */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-stone-800 text-sm">Tâches du jour</h2>
          {manualTaches.length > 0 && (
            <span className="text-xs text-muted">{doneTaches.length}/{manualTaches.length} faites</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={newTache}
            onChange={e => setNewTache(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTache()}
            placeholder="Ajouter une tâche…"
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={addTache} disabled={!newTache.trim()}
            className="bg-primary text-white px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-primary-dark transition">
            <Plus size={16} />
          </button>
        </div>

        {manualTaches.length === 0 && (
          <p className="text-xs text-muted py-1">Aucune tâche · tape Entrée pour en ajouter</p>
        )}

        <div className="space-y-1">
          {visiblePending.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 py-1 group">
              <button onClick={() => toggleTache(t.id, true)}
                className="w-5 h-5 rounded border-2 border-border hover:border-primary transition shrink-0" />
              <span className="text-sm text-stone-700 flex-1">{t.texte}</span>
              <button onClick={() => deleteTache(t.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition">
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {pendingManual.length > 3 && !showAllTaches && (
            <button onClick={() => setShowAllTaches(true)} className="text-xs text-primary font-medium py-1">
              + {pendingManual.length - 3} tâche{pendingManual.length - 3 > 1 ? 's' : ''} de plus
            </button>
          )}

          {showAllTaches && doneTaches.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 py-1">
              <button onClick={() => toggleTache(t.id, false)}
                className="w-5 h-5 rounded border-2 border-green-400 bg-green-50 flex items-center justify-center shrink-0">
                <Check size={10} className="text-green-600" />
              </button>
              <span className="text-sm text-muted line-through flex-1">{t.texte}</span>
            </div>
          ))}

          {showAllTaches && (
            <button onClick={() => setShowAllTaches(false)} className="text-xs text-muted py-1">Réduire</button>
          )}
        </div>
      </section>

      {/* Block 3 — Réseau : contacts J+3 */}
      <section className="space-y-2">
        <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
          <Network size={15} className="text-primary" /> Réseau — À recontacter
        </h2>
        {contactsRelance.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted">
              Aucun contact J+3 ·{' '}
              <Link href="/contacts" className="text-primary font-medium">Ajouter un contact →</Link>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contactsRelance.map(c => (
              <div key={c.id}
                className="bg-surface rounded-xl border border-border px-3 py-2.5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {c.prenom}{c.entreprise ? ` · ${c.entreprise}` : ''}
                  </p>
                  {c.sujet && <p className="text-xs text-muted mt-0.5">{c.sujet}</p>}
                  {c.evenement && <p className="text-xs text-muted">Rencontré à : {c.evenement}</p>}
                </div>
                <button onClick={() => markRappelFait(c.id)}
                  className="shrink-0 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition flex items-center gap-1">
                  <Check size={12} /> Contacté
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Badge relances devis */}
      {relances.length > 0 && (
        <Link href="/relances"
          className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-100 transition">
          <Bell size={14} className="shrink-0" />
          <span className="font-medium">{relances.length} devis en attente de relance</span>
          <span className="ml-auto text-xs">→</span>
        </Link>
      )}

      {/* Block 4 — Statut automations */}
      {autoLogs.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="font-semibold text-stone-800 text-sm text-xs text-muted uppercase tracking-wide">
            ⚙️ Automations
          </h2>
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
            {autoLogs.map(log => {
              const icon  = log.status === 'success' ? '✅' : log.status === 'partial' ? '⚠️' : '❌'
              const label = ({ brief_agenda: 'Brief agenda', veille_hebdo: 'Veille hebdo' } as Record<string, string>)[log.task_name] ?? log.task_name
              const heure = new Date(log.ran_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              const isToday = new Date(log.ran_at).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
              const whenLabel = isToday ? `Aujourd'hui ${heure}` : new Date(log.ran_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                  <span>{icon}</span>
                  <span className="font-medium text-stone-700">{label}</span>
                  <span className="text-muted ml-auto">{whenLabel}</span>
                </div>
              )
            })}
          </div>
          {autoLogs.some(l => l.status !== 'success') && (
            <p className="text-xs text-amber-600 px-1">
              ⚠️ Certaines automations ont rencontré des problèmes
            </p>
          )}
        </section>
      )}
    </div>
  )
}
