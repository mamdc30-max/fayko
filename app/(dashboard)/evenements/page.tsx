'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Plus, X, Check, MapPin, CalendarDays } from 'lucide-react'
import type { EvenementReseau, TypeEvenement } from '@/lib/types'

const TYPES: { value: TypeEvenement; label: string; emoji: string }[] = [
  { value: 'networking',  label: 'Networking',  emoji: '🤝' },
  { value: 'conférence',  label: 'Conférence',  emoji: '🎤' },
  { value: 'atelier',     label: 'Atelier',     emoji: '🛠️' },
  { value: 'autre',       label: 'Autre',       emoji: '📌' },
]

interface EventForm {
  nom: string
  date_event: string
  lieu: string
  type: TypeEvenement
}

const EMPTY_FORM: EventForm = {
  nom: '',
  date_event: new Date().toISOString().split('T')[0],
  lieu: '',
  type: 'networking',
}

export default function EvenementsPage() {
  const [events, setEvents] = useState<EvenementReseau[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EventForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<EvenementReseau | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('evenements_reseau')
      .select('*')
      .order('date_event', { ascending: false })
    if (data) setEvents(data)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(e: EvenementReseau) {
    setEditing(e)
    setForm({
      nom: e.nom,
      date_event: e.date_event ?? new Date().toISOString().split('T')[0],
      lieu: e.lieu ?? '',
      type: e.type,
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.nom.trim()) return
    const payload = {
      nom: form.nom.trim(),
      date_event: form.date_event || null,
      lieu: form.lieu.trim() || null,
      type: form.type,
    }
    if (editing) {
      const { data } = await supabase.from('evenements_reseau').update(payload).eq('id', editing.id).select().single()
      if (data) setEvents(prev => prev.map(e => e.id === editing.id ? data : e))
    } else {
      const { data } = await supabase.from('evenements_reseau').insert(payload).select().single()
      if (data) setEvents(prev => [data, ...prev])
    }
    setShowForm(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const prochains = events.filter(e => e.date_event && e.date_event >= today)
  const passes = events.filter(e => !e.date_event || e.date_event < today)

  const typeOf = (e: EvenementReseau) => TYPES.find(t => t.value === e.type)

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Événements</h1>
          <p className="text-xs text-muted mt-0.5">Tes rencontres professionnelles</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition">
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {/* Prochains */}
      {prochains.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
            <CalendarDays size={14} className="text-primary" /> À venir
          </h2>
          {prochains.map(e => (
            <EventCard key={e.id} event={e} typeOf={typeOf} onEdit={openEdit} today={today} />
          ))}
        </div>
      )}

      {/* Passés */}
      {passes.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-stone-700 text-sm">Passés</h2>
          {passes.map(e => (
            <EventCard key={e.id} event={e} typeOf={typeOf} onEdit={openEdit} today={today} />
          ))}
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-10 text-muted">
          <p className="text-3xl mb-3">🗓️</p>
          <p className="text-sm font-medium text-stone-700">Aucun événement pour l'instant</p>
          <p className="text-xs mt-1">Ajoute ton prochain événement réseau</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center">
          <div className="bg-surface w-full max-w-lg rounded-t-3xl md:rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-stone-800">{editing ? 'Modifier' : 'Nouvel événement'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Nom de l'événement *</label>
              <input
                autoFocus
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="ex: Paris Business Forum"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.date_event}
                  onChange={e => setForm(f => ({ ...f, date_event: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Lieu</label>
                <input
                  value={form.lieu}
                  onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
                  placeholder="ex: Paris, Lyon…"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => (
                  <button key={t.value}
                    onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition ${form.type === t.value ? 'border-primary bg-primary-light text-primary font-medium' : 'border-border text-muted hover:border-primary/40'}`}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={!form.nom.trim()}
                className="flex-1 bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-dark transition disabled:opacity-40 flex items-center justify-center gap-2">
                <Check size={16} /> {editing ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EventCard({
  event, typeOf, onEdit, today
}: {
  event: EvenementReseau
  typeOf: (e: EvenementReseau) => { emoji: string; label: string } | undefined
  onEdit: (e: EvenementReseau) => void
  today: string
}) {
  const t = typeOf(event)
  const isPast = event.date_event && event.date_event < today

  return (
    <button onClick={() => onEdit(event)}
      className={`w-full text-left bg-surface rounded-2xl border border-border p-4 flex items-start gap-3 hover:border-primary/30 transition ${isPast ? 'opacity-70' : ''}`}>
      <span className="text-2xl shrink-0 mt-0.5">{t?.emoji ?? '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-800 text-sm">{event.nom}</p>
        <div className="flex items-center gap-3 mt-1">
          {event.date_event && (
            <span className="text-xs text-muted flex items-center gap-1">
              <CalendarDays size={11} /> {formatDate(event.date_event)}
            </span>
          )}
          {event.lieu && (
            <span className="text-xs text-muted flex items-center gap-1">
              <MapPin size={11} /> {event.lieu}
            </span>
          )}
        </div>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${isPast ? 'bg-stone-100 text-stone-500' : 'bg-primary-light text-primary'}`}>
        {t?.label ?? event.type}
      </span>
    </button>
  )
}
