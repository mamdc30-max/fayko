'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPrice, STATUT_COLORS } from '@/lib/utils'
import { Bell, Plus, Check, Trash2, CalendarDays, ChevronRight } from 'lucide-react'
import type { Devis, Client, Tache, AutomationLog, DailyFocus, Projet } from '@/lib/types'
import { useUserContext } from '@/lib/user-context'
import TacheModal, { PrioDot } from '@/components/TacheModal'

// ── Badge d'échéance coloré ──────────────────────────────────────────────────
function EcheanceTag({ date }: { date: string }) {
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  let label: string
  let cls: string

  if (date < today)            { label = 'En retard';    cls = 'text-red-500 bg-red-50' }
  else if (date === today)     { label = "Aujourd'hui";  cls = 'text-amber-600 bg-amber-50' }
  else if (date === tomorrowStr){ label = 'Demain';      cls = 'text-stone-500 bg-stone-50' }
  else {
    label = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    cls = 'text-stone-400 bg-stone-50'
  }

  return <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${cls}`}>{label}</span>
}

const PRIO_ORDER: Record<string, number> = { haute: 0, normale: 1, basse: 2 }

interface DevisWithClient extends Devis { clients: Client }
interface Stats { caMois: number; enAttente: number }
interface TacheAvecProjet extends Tache { projets?: { id: string; nom: string } | null }

function getISOWeek(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

interface Priorite { id: string; texte: string; cochee: boolean }
interface ProjetActif extends Projet { etapes_total: number; etapes_done: number }
interface PipelineStats { pipeline: number; prospects: number; projets: number }

export default function FocusPage() {
  const { isAdmin } = useUserContext()

  // ── Admin state ──
  const [focusItems,  setFocusItems]  = useState<DailyFocus[]>([])
  const [priorites,   setPriorites]   = useState<Priorite[]>([])
  const [projets,     setProjets]     = useState<ProjetActif[]>([])
  const [agendaTaches,setAgendaTaches]= useState<TacheAvecProjet[]>([])
  const [autoLogs,    setAutoLogs]    = useState<AutomationLog[]>([])
  const [selectedTache, setSelectedTache] = useState<Tache | null>(null)
  const [kpis,        setKpis]        = useState<PipelineStats | null>(null)
  const [brief,       setBrief]       = useState<{ salutation: string; actions: string[]; note: string | null } | null>(null)
  const [briefLoading,setBriefLoading]= useState(false)
  const [retard,      setRetard]      = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [newPrioTexte, setNewPrioTexte] = useState('')
  const [prioSaving,   setPrioSaving]   = useState(false)

  // ── Client state ──
  const [relances,     setRelances]      = useState<DevisWithClient[]>([])
  const [recent,       setRecent]        = useState<DevisWithClient[]>([])
  const [stats,        setStats]         = useState<Stats>({ caMois: 0, enAttente: 0 })
  const [catalogReady, setCatalogReady]  = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (isAdmin) loadAdmin()
    else loadClient()
  }, [isAdmin])

  async function loadAdmin() {
    const today   = new Date().toISOString().split('T')[0]
    const semaine = getISOWeek()
    try {

    const [
      { data: focus },
      { data: prios },
      { data: projetsData },
      { data: etapesData },
      { data: agenda },
      { data: pipeData },
      { data: logs },
      { count: retardCount },
    ] = await Promise.all([
      supabase.from('daily_focus').select('*').eq('date', today).eq('fait', false).order('priorite'),
      supabase.from('priorites_hebdo').select('id, texte, cochee').eq('semaine', semaine).order('ordre'),
      supabase.from('projets').select('*').eq('statut', 'actif').order('created_at', { ascending: false }).limit(5),
      supabase.from('etapes').select('projet_id, statut'),
      supabase.from('taches').select('*, projets(id, nom)').eq('date', today).eq('faite', false),
      supabase.from('prospects').select('montant_estime, statut').not('statut', 'in', '(client,perdu,source)'),
      supabase.from('automation_logs').select('*').order('ran_at', { ascending: false }).limit(6),
      supabase.from('taches').select('id', { count: 'exact', head: true }).lt('date', today).eq('faite', false),
    ])

    setFocusItems((focus ?? []) as DailyFocus[])
    setPriorites((prios ?? []) as Priorite[])

    // Tri : haute → normale → basse, puis par échéance croissante
    const sorted = [...(agenda ?? [])].sort((a, b) => {
      const pa = PRIO_ORDER[a.priorite] ?? 1
      const pb = PRIO_ORDER[b.priorite] ?? 1
      if (pa !== pb) return pa - pb
      if (a.echeance && b.echeance) return a.echeance < b.echeance ? -1 : 1
      if (a.echeance) return -1
      if (b.echeance) return 1
      return 0
    })
    setAgendaTaches(sorted as TacheAvecProjet[])

    // KPIs pipeline
    if (pipeData) {
      const pipeline = pipeData.reduce((s, p) => s + (p.montant_estime ?? 0), 0)
      setKpis({ pipeline, prospects: pipeData.length, projets: (projetsData ?? []).length })
    }

    // Projets with progress
    const etapesMap: Record<string, { total: number; done: number }> = {}
    for (const e of etapesData ?? []) {
      if (!etapesMap[e.projet_id]) etapesMap[e.projet_id] = { total: 0, done: 0 }
      etapesMap[e.projet_id].total++
      if (e.statut === 'termine') etapesMap[e.projet_id].done++
    }
    setProjets((projetsData ?? []).map(p => ({
      ...p,
      etapes_total: etapesMap[p.id]?.total ?? 0,
      etapes_done:  etapesMap[p.id]?.done  ?? 0,
    })) as ProjetActif[])

    setRetard(retardCount ?? 0)

    // Deduplicated automation logs
    if (logs) {
      const seen = new Set<string>()
      setAutoLogs(logs.filter(l => { if (seen.has(l.task_name)) return false; seen.add(l.task_name); return true }))
    }

    setLoading(false)
    } catch (err) {
      console.error('[Focus] Erreur chargement', err)
      setLoading(false)
    }
  }

  async function loadClient() {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

    const [{ data: allDevis }, { data: relancesData }] = await Promise.all([
      supabase.from('devis').select('*, clients(*)').order('created_at', { ascending: false }),
      supabase.from('devis').select('*, clients(*), relances(effectuee)').eq('statut', 'Envoyé').lt('created_at', sevenDaysAgo.toISOString()),
    ])

    if (allDevis) {
      const d = allDevis as DevisWithClient[]
      setRecent(d.slice(0, 5))
      setStats({
        caMois:    d.filter(x => x.statut === 'Soldé' && new Date(x.updated_at) >= startOfMonth).reduce((s, x) => s + x.total_ht, 0),
        enAttente: d.filter(x => ['Envoyé', 'Validé', 'Acompte reçu'].includes(x.statut)).reduce((s, x) => s + x.total_ht, 0),
      })
    }
    if (relancesData) {
      setRelances((relancesData as (DevisWithClient & { relances: { effectuee: boolean }[] })[])
        .filter(d => !d.relances?.length || d.relances.every(r => !r.effectuee)))
    }
    const { count } = await supabase.from('forfaits').select('id', { count: 'exact', head: true })
    setCatalogReady((count ?? 0) > 0)
    setShowOnboarding(!localStorage.getItem('onboarding_done'))
    setLoading(false)
  }

  async function generateBrief() {
    setBriefLoading(true)
    try {
      const { data: prospectsData } = await supabase
        .from('prospects')
        .select('prenom, nom, entreprise, statut, last_action_at')
        .in('statut', ['contacte', 'en_discussion', 'proposition'])

      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taches:    agendaTaches.map(t => ({ texte: t.texte, priorite: t.priorite })),
          prospects: prospectsData ?? [],
          projets:   projets.map(p => ({ nom: p.nom, etapes_done: p.etapes_done, etapes_total: p.etapes_total })),
          priorites: priorites.filter(p => !p.cochee).map(p => p.texte),
        }),
      })
      const data = await res.json()
      if (data.salutation) setBrief(data)
    } catch {}
    setBriefLoading(false)
  }

  async function markFocusDone(id: string) {
    await supabase.from('daily_focus').update({ fait: true }).eq('id', id)
    setFocusItems(prev => prev.filter(f => f.id !== id))
  }

  async function togglePriorite(id: string, cochee: boolean) {
    await supabase.from('priorites_hebdo').update({ cochee }).eq('id', id)
    setPriorites(prev => prev.map(p => p.id === id ? { ...p, cochee } : p))
  }

  async function addPrioriteFromFocus() {
    if (!newPrioTexte.trim()) return
    setPrioSaving(true)
    const semaine = getISOWeek()
    const { data } = await supabase.from('priorites_hebdo').insert({
      semaine, texte: newPrioTexte.trim(), cochee: false, ordre: priorites.length,
    }).select('id, texte, cochee').single()
    if (data) setPriorites(prev => [...prev, data as Priorite])
    setNewPrioTexte('')
    setPrioSaving(false)
  }

  async function deletePrioriteFromFocus(id: string) {
    await supabase.from('priorites_hebdo').delete().eq('id', id)
    setPriorites(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  /* ═══════════════════════════════════════════
     VUE CLIENT
  ═══════════════════════════════════════════ */
  if (!isAdmin) {
    if (showOnboarding) {
      return (
        <div className="space-y-5">
          <div className="bg-primary rounded-2xl p-6">
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-2">Bienvenue sur Fayko ✨</p>
            <h2 className="text-white font-bold text-xl leading-snug mb-3">Plus jamais une vente perdue dans tes notes</h2>
            <p className="text-white/80 text-sm leading-relaxed">Tes commandes notées à la va-vite, sans suivi, sans relance… C'est fini.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/parametres" onClick={() => { localStorage.setItem('onboarding_done', '1'); setShowOnboarding(false) }}
              className="flex-1 bg-primary text-white text-sm font-semibold px-4 py-3 rounded-xl text-center">
              Configurer mes messages
            </Link>
            <button onClick={() => { localStorage.setItem('onboarding_done', '1'); setShowOnboarding(false) }}
              className="text-sm text-muted px-4 py-3 rounded-xl border border-border">
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
          <p className="text-muted text-sm mt-0.5">{recent.length === 0 ? 'Prête à créer ta première commande ?' : `${recent.length} commande${recent.length > 1 ? 's' : ''} au total`}</p>
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
        <Link href="/devis" className="bg-primary rounded-2xl p-5 flex items-center justify-between hover:bg-primary-dark transition">
          <div>
            <p className="font-bold text-white text-lg">Nouvelle commande</p>
            <p className="text-white/70 text-xs mt-0.5">{catalogReady ? 'Choisis dans ton catalogue et envoie sur WhatsApp' : 'Envoie sur WhatsApp en 30 secondes'}</p>
          </div>
          <span className="text-4xl">✨</span>
        </Link>
        {relances.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={16} className="text-amber-600" />
              <h2 className="font-semibold text-amber-700 text-sm">{relances.length} relance{relances.length > 1 ? 's' : ''} en attente</h2>
            </div>
            <div className="space-y-2">
              {relances.slice(0, 2).map(d => (
                <Link key={d.id} href={`/devis/${d.id}`} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                  <p className="text-sm font-medium text-stone-800">{d.clients.prenom} {d.clients.nom}</p>
                  <span className="text-sm font-semibold text-primary">{formatPrice(d.total_ht)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div>
            <h2 className="font-semibold text-stone-800 text-sm mb-3">Commandes récentes</h2>
            <div className="space-y-2">
              {recent.slice(0, 3).map(d => (
                <Link key={d.id} href={`/devis/${d.id}`} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3 border border-border hover:border-primary/30 transition">
                  <div>
                    <p className="text-sm font-medium text-stone-800">{d.clients.prenom} {d.clients.nom}</p>
                    <p className="text-xs text-muted">{d.titre} · {formatDate(d.created_at)}</p>
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
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     VUE ADMIN — Focus V3
  ═══════════════════════════════════════════ */
  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const FOCUS_DOT: Record<string, string> = {
    '1-crm': 'bg-red-500', '2-crm': 'bg-amber-400', '3-crm': 'bg-amber-300',
    '1-sourcing': 'bg-blue-500', '2-sourcing': 'bg-blue-400', '3-sourcing': 'bg-blue-300',
    '1-contact': 'bg-primary', '2-contact': 'bg-primary', '3-contact': 'bg-primary',
  }
  const cochees  = priorites.filter(p => p.cochee).length
  const TYPE_DOT: Record<string, string> = { client: 'bg-orange-400', interne: 'bg-blue-400', personnel: 'bg-violet-400' }

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div>
        <p className="text-xs text-muted capitalize">{todayLabel}</p>
        <h1 className="text-2xl font-bold text-stone-800">Bonjour 👋</h1>
      </div>

      {/* ── KPIs pipeline ── */}
      {kpis && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface border border-border rounded-2xl px-3 py-3 text-center">
            <p className="text-xs text-muted mb-0.5">Pipeline</p>
            <p className="text-base font-bold text-orange-500">
              {kpis.pipeline >= 1000
                ? `${(kpis.pipeline / 1000).toFixed(1)}k`
                : `${kpis.pipeline}`}
              <span className="text-xs font-normal ml-0.5">€</span>
            </p>
          </div>
          <div className="bg-surface border border-border rounded-2xl px-3 py-3 text-center">
            <p className="text-xs text-muted mb-0.5">Prospects</p>
            <p className="text-base font-bold text-primary">{kpis.prospects}</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl px-3 py-3 text-center">
            <p className="text-xs text-muted mb-0.5">Projets</p>
            <p className="text-base font-bold text-blue-500">{kpis.projets}</p>
          </div>
        </div>
      )}

      {/* ── 0. Brief IA du jour ── */}
      {brief ? (
        <section className="bg-navy-deep rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-white/90 text-sm leading-relaxed font-medium flex-1">{brief.salutation}</p>
            <button
              onClick={() => setBrief(null)}
              className="text-white/30 hover:text-white/60 transition shrink-0 text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2.5">
            {brief.actions.map((action, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-primary font-bold text-xs shrink-0 mt-0.5 bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-white text-sm leading-snug">{action}</p>
              </div>
            ))}
          </div>
          {/* Liens rapides */}
          <div className="flex gap-2 flex-wrap border-t border-white/10 pt-3">
            <a
              href="https://calendar.google.com/calendar/r/day"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full"
            >
              📅 Agenda Google
            </a>
            {agendaTaches.length > 0 && (
              <a
                href="#taches-du-jour"
                className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full"
              >
                ✅ {agendaTaches.length} tâche{agendaTaches.length > 1 ? 's' : ''} aujourd'hui
              </a>
            )}
          </div>

          {brief.note && (
            <p className="text-white/50 text-xs leading-relaxed border-t border-white/10 pt-3 italic">
              {brief.note}
            </p>
          )}
          <button
            onClick={generateBrief}
            disabled={briefLoading}
            className="text-xs text-white/40 hover:text-white/60 transition disabled:opacity-30"
          >
            {briefLoading ? '⏳ Actualisation...' : '↺ Actualiser'}
          </button>
        </section>
      ) : (
        <button
          onClick={generateBrief}
          disabled={briefLoading}
          className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-deep text-white text-sm font-semibold py-3.5 rounded-2xl transition disabled:opacity-50"
        >
          {briefLoading
            ? <><span className="animate-pulse">⏳</span> Analyse en cours...</>
            : <>✨ Générer mon brief du jour</>
          }
        </button>
      )}

      {/* ── 1. Focus du jour (CRM scan) ── */}
      {focusItems.length > 0 && (
        <section className="bg-navy-deep rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-sm">
              ⭐ Focus du jour
              <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-normal">
                {focusItems.length} action{focusItems.length > 1 ? 's' : ''}
              </span>
            </h2>
          </div>
          <div className="space-y-2">
            {focusItems.map(item => {
              const dot  = FOCUS_DOT[`${item.priorite}-${item.categorie}`]
              const href = item.lien_type === 'prospect' ? '/prospects' : undefined
              const inner = (
                <div className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${dot ?? 'bg-white/40'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-snug">{item.action}</p>
                    {item.contexte && <p className="text-white/50 text-xs mt-0.5">{item.contexte}</p>}
                  </div>
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); markFocusDone(item.id) }}
                    className="shrink-0 w-6 h-6 rounded-full border border-white/30 hover:bg-white/20 flex items-center justify-center transition"
                  >
                    <Check size={11} className="text-white/60" />
                  </button>
                </div>
              )
              return href
                ? <Link key={item.id} href={href} className="block hover:bg-white/5 rounded-xl px-2 py-1 -mx-2 transition">{inner}</Link>
                : <div key={item.id} className="px-2 py-1">{inner}</div>
            })}
          </div>
        </section>
      )}


      {/* ── 2. Focus de la semaine ── */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-stone-800 text-sm">📋 Focus de la semaine</h2>
          {priorites.length > 0 && (
            <span className="text-xs text-muted">{cochees}/{priorites.length}</span>
          )}
        </div>
        <div className="p-3 space-y-0.5">
          {priorites.map(p => (
            <div
              key={p.id}
              className={`flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-beige-50 transition group ${p.cochee ? 'opacity-50' : ''}`}
            >
              <button
                onClick={() => togglePriorite(p.id, !p.cochee)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${p.cochee ? 'border-green-400 bg-green-50' : 'border-border hover:border-primary'}`}
              >
                {p.cochee && <Check size={9} className="text-green-600" />}
              </button>
              <span className={`text-sm flex-1 ${p.cochee ? 'line-through text-muted' : 'text-stone-700'}`}>{p.texte}</span>
              <button
                onClick={() => deletePrioriteFromFocus(p.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Plus size={13} className="text-stone-300 shrink-0" />
            <input
              value={newPrioTexte}
              onChange={e => setNewPrioTexte(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPrioriteFromFocus()}
              placeholder={priorites.length === 0 ? 'Quelle est ta priorité principale cette semaine ?' : 'Ajouter une priorité…'}
              className="flex-1 text-sm text-stone-700 bg-transparent focus:outline-none placeholder:text-stone-300 py-1.5"
            />
            {newPrioTexte.trim() && (
              <button
                onClick={addPrioriteFromFocus}
                disabled={prioSaving}
                className="text-xs text-primary font-medium hover:underline shrink-0 disabled:opacity-40"
              >
                {prioSaving ? '…' : 'Ajouter'}
              </button>
            )}
          </div>
        </div>
        {priorites.length > 0 && (
          <div className="px-4 pb-3">
            <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${cochees === priorites.length ? 'bg-green-400' : 'bg-primary'}`}
                style={{ width: `${priorites.length ? Math.round((cochees / priorites.length) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── 3. Projets actifs ── */}
      {projets.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-800 text-sm">📁 Projets actifs</h2>
            <Link href="/projets" className="text-xs text-primary font-medium">Voir tout</Link>
          </div>
          <div className="space-y-2">
            {projets.map(p => {
              const pct = p.etapes_total > 0 ? Math.round((p.etapes_done / p.etapes_total) * 100) : 0
              const dot = TYPE_DOT[p.type] ?? 'bg-stone-300'
              return (
                <Link key={p.id} href={`/projets/${p.id}`}
                  className="flex items-center gap-3 bg-surface border border-border rounded-xl px-3 py-3 hover:border-primary/30 transition">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{p.nom}</p>
                    {p.etapes_total > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted shrink-0">{p.etapes_done}/{p.etapes_total}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-muted shrink-0" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 4. A faire ── */}
      {(agendaTaches.length > 0 || retard > 0) && (
        <section id="taches-du-jour" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
              <CalendarDays size={15} className="text-primary" /> Aujourd&apos;hui
              {agendaTaches.length > 0 && (
                <span className="text-xs text-muted font-normal">{agendaTaches.length} tâche{agendaTaches.length > 1 ? 's' : ''}</span>
              )}
            </h2>
            {retard > 0 && (
              <Link href="/taches" className="flex items-center gap-1 text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition">
                ⚠️ {retard} en retard
              </Link>
            )}
          </div>
          {agendaTaches.length === 0 && retard > 0 ? (
            <Link href="/taches" className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3 hover:bg-red-100 transition">
              <p className="text-sm text-red-700 font-medium">Aucune tâche aujourd&apos;hui — {retard} tâche{retard > 1 ? 's' : ''} en attente</p>
              <ChevronRight size={14} className="text-red-400 shrink-0" />
            </Link>
          ) : (
            <div className="space-y-1.5">
              {agendaTaches.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTache(t)}
                  className="w-full flex items-center gap-3 bg-surface rounded-xl px-3 py-2.5 border border-border hover:border-primary/30 hover:bg-beige-50 transition text-left"
                >
                  <PrioDot p={t.priorite} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-stone-700 leading-snug line-clamp-2">{t.texte}</span>
                    {t.projets?.nom && (
                      <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                        {t.projets.nom}
                      </span>
                    )}
                  </div>
                  {t.echeance && <EcheanceTag date={t.echeance} />}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedTache && (
        <TacheModal
          tache={selectedTache}
          onClose={() => setSelectedTache(null)}
          onSave={updated => {
            if (updated.faite) {
              setAgendaTaches(prev => prev.filter(t => t.id !== updated.id))
            } else {
              setAgendaTaches(prev => prev.map(t => t.id === updated.id ? updated : t))
            }
            setSelectedTache(null)
          }}
          onDelete={id => { setAgendaTaches(prev => prev.filter(t => t.id !== id)); setSelectedTache(null) }}
        />
      )}

      {/* ── 5. Statut automations ── */}
      {autoLogs.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="text-xs text-muted font-semibold uppercase tracking-wide">⚙️ Automations</h2>
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
            {autoLogs.map(log => {
              const icon  = log.status === 'success' ? '✅' : log.status === 'partial' ? '⚠️' : '❌'
              const label = ({ scan_crm: 'Scan CRM', brief_agenda: 'Brief agenda', veille_hebdo: 'Veille hebdo' } as Record<string, string>)[log.task_name] ?? log.task_name
              const isToday = new Date(log.ran_at).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
              const when = isToday
                ? `Aujourd'hui ${new Date(log.ran_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : new Date(log.ran_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                  <span>{icon}</span>
                  <span className="font-medium text-stone-700">{label}</span>
                  {log.summary && <span className="text-muted hidden sm:block truncate">{log.summary}</span>}
                  <span className="text-muted ml-auto shrink-0">{when}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
