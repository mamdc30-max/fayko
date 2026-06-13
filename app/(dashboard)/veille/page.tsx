'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { ExternalLink, CalendarPlus, RefreshCw, ChevronDown, ChevronUp, Headphones } from 'lucide-react'
import type { VeilleItem } from '@/lib/types'

const CATEGORIES = [
  { value: 'tous',          label: 'Tous',           emoji: '🌐' },
  { value: 'communication', label: 'Communication',  emoji: '📢' },
  { value: 'diaspora',      label: 'Diaspora',       emoji: '🌍' },
  { value: 'linkedin',      label: 'LinkedIn',       emoji: '💼' },
  { value: 'outils',        label: 'Outils & IA',    emoji: '🤖' },
]

const TYPE_STYLE: Record<string, { label: string; color: string; emoji: string }> = {
  article:   { label: 'Article',     color: 'bg-sky-50 text-sky-600',       emoji: '📄' },
  evenement: { label: 'Événement',   color: 'bg-orange-50 text-primary',    emoji: '📅' },
  outil:     { label: 'Outil',       color: 'bg-purple-50 text-purple-600', emoji: '🛠️' },
  tendance:  { label: 'Tendance',    color: 'bg-amber-50 text-amber-700',   emoji: '📈' },
  podcast:   { label: 'Podcast',     color: 'bg-rose-50 text-rose-600',     emoji: '🎧' },
}

// Seuil au-delà duquel on tronque le résumé
const RESUME_THRESHOLD = 180

export default function VeillePage() {
  const [items, setItems]                     = useState<VeilleItem[]>([])
  const [loading, setLoading]                 = useState(true)
  const [refreshing, setRefreshing]           = useState(false)
  const [refreshMsg, setRefreshMsg]           = useState<string | null>(null)
  const [activeCategorie, setActiveCategorie] = useState('tous')
  const [addingId, setAddingId]               = useState<string | null>(null)
  const [addedIds, setAddedIds]               = useState<Set<string>>(new Set())

  useEffect(() => { loadFromDb() }, [])

  // Recharge les items depuis Supabase (sans re-fetcher les RSS)
  async function loadFromDb() {
    setLoading(true)
    const { data } = await supabase
      .from('veille_items')
      .select('*')
      .order('date_veille', { ascending: false })
      .order('created_at',  { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  // Lance la récupération des flux RSS côté serveur
  async function refreshVeille() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/refresh-veille', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
      })
      const json = await res.json() as { count?: number; errors?: string[] }
      if (res.ok) {
        setRefreshMsg(`✅ ${json.count ?? 0} contenus récupérés`)
        await loadFromDb()
      } else {
        setRefreshMsg('❌ Erreur lors du rafraîchissement')
      }
    } catch {
      setRefreshMsg('❌ Impossible de contacter le serveur')
    } finally {
      setRefreshing(false)
    }
  }

  async function addToEvents(item: VeilleItem) {
    setAddingId(item.id)
    const { error } = await supabase.from('evenements_reseau').insert({
      nom:        item.titre,
      type:       'networking',
      date_event: null,
      lieu:       null,
    })
    if (!error) setAddedIds(prev => new Set(Array.from(prev).concat(item.id)))
    setAddingId(null)
  }

  const filtered = activeCategorie === 'tous'
    ? items
    : items.filter(i => i.categorie === activeCategorie)

  const byCategorie = CATEGORIES.slice(1).map(cat => ({
    ...cat,
    items: items.filter(i => i.categorie === cat.value),
  })).filter(cat => cat.items.length > 0)

  const lastDate = items[0]?.date_veille

  // Compteurs par type pour la semaine
  const podcastCount = items.filter(i => i.type === 'podcast').length

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Veille hebdo</h1>
          <p className="text-xs text-muted mt-0.5">
            {refreshMsg
            ? refreshMsg
            : lastDate
              ? `Mise à jour le ${formatDate(lastDate)}`
              : 'Clique sur "Générer la veille" pour démarrer'}
          </p>
          {podcastCount > 0 && (
            <p className="text-xs text-rose-500 mt-0.5 flex items-center gap-1">
              <Headphones size={11} /> {podcastCount} podcast{podcastCount > 1 ? 's' : ''} à écouter cette semaine
            </p>
          )}
        </div>
        <button
          onClick={refreshVeille}
          disabled={refreshing}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Génération…' : 'Générer la veille'}
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategorie(cat.value)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              activeCategorie === cat.value
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-muted border-border hover:border-primary/40'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-14 text-muted">
          <p className="text-4xl mb-3">📰</p>
          <p className="text-sm font-semibold text-stone-700">Aucune veille cette semaine</p>
          <p className="text-xs mt-2 leading-relaxed max-w-xs mx-auto text-stone-500">
            Le script tourne automatiquement chaque vendredi à 18h.<br />
            Tu peux aussi lancer <code className="bg-stone-100 px-1 rounded font-mono">veille-hebdo.ps1</code> manuellement.
          </p>
        </div>
      )}

      {/* Grouped view — Tous */}
      {items.length > 0 && activeCategorie === 'tous' && (
        <div className="space-y-7">
          {byCategorie.map(cat => (
            <div key={cat.value} className="space-y-2">
              <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
                {cat.emoji} {cat.label}
                <span className="text-xs text-muted font-normal">({cat.items.length})</span>
              </h2>
              {cat.items.map(item => (
                <VeilleCard
                  key={item.id}
                  item={item}
                  onAddEvent={addToEvents}
                  adding={addingId === item.id}
                  added={addedIds.has(item.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Filtered flat view */}
      {items.length > 0 && activeCategorie !== 'tous' && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Aucun contenu dans cette catégorie</p>
          ) : (
            filtered.map(item => (
              <VeilleCard
                key={item.id}
                item={item}
                onAddEvent={addToEvents}
                adding={addingId === item.id}
                added={addedIds.has(item.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Carte ───────────────────────────────────────────────────────────────────

function VeilleCard({
  item,
  onAddEvent,
  adding,
  added,
}: {
  item: VeilleItem
  onAddEvent: (item: VeilleItem) => void
  adding: boolean
  added: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const t = TYPE_STYLE[item.type] ?? TYPE_STYLE.article

  const isPodcast    = item.type === 'podcast'
  const isLongResume = (item.resume?.length ?? 0) > RESUME_THRESHOLD
  const displayedResume =
    isLongResume && !expanded
      ? item.resume!.slice(0, RESUME_THRESHOLD) + '…'
      : item.resume

  return (
    <div className={`bg-surface rounded-2xl border p-4 space-y-2.5 transition ${
      isPodcast ? 'border-rose-100' : 'border-border'
    }`}>

      {/* En-tête */}
      <div className="flex items-start gap-2">
        {isPodcast && (
          <span className="text-xl shrink-0 mt-0.5">🎧</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-800 text-sm leading-snug">{item.titre}</p>

          {/* Résumé — expandable si long */}
          {item.resume && (
            <div className="mt-1">
              <p className="text-xs text-muted leading-relaxed">
                {displayedResume}
              </p>
              {isLongResume && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="flex items-center gap-0.5 text-xs text-primary mt-1 hover:underline"
                >
                  {expanded ? (
                    <><ChevronUp size={12} /> Réduire</>
                  ) : (
                    <><ChevronDown size={12} /> Lire le résumé complet</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${t.color}`}>
          {t.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink size={11} />
            {isPodcast ? 'Écouter l\'épisode' : 'Voir la source'}
          </a>
        )}

        {item.type === 'evenement' && (
          <button
            onClick={() => onAddEvent(item)}
            disabled={adding || added}
            className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 ${
              added
                ? 'bg-stone-100 text-stone-500 cursor-default'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            <CalendarPlus size={11} />
            {added ? 'Ajouté ✓' : adding ? '…' : 'Ajouter aux événements'}
          </button>
        )}
      </div>
    </div>
  )
}
