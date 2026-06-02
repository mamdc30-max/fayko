'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Plus, X, Check, MapPin, CalendarDays,
  ChevronDown, Pencil, FileText, Send, Trash2,
} from 'lucide-react'
import type { EvenementReseau, TypeEvenement, NoteEvenement } from '@/lib/types'

const TYPES: { value: TypeEvenement; label: string; emoji: string }[] = [
  { value: 'networking',  label: 'Networking',  emoji: '🤝' },
  { value: 'conférence',  label: 'Conférence',  emoji: '🎤' },
  { value: 'atelier',     label: 'Atelier',     emoji: '🛠️' },
  { value: 'autre',       label: 'Autre',       emoji: '📌' },
]

interface EventForm { nom: string; date_event: string; lieu: string; type: TypeEvenement }
const EMPTY_FORM: EventForm = {
  nom: '', date_event: new Date().toISOString().split('T')[0], lieu: '', type: 'networking',
}

// ─── EventCard ────────────────────────────────────────────────────────────────
interface CardProps {
  event:       EvenementReseau
  notes:       NoteEvenement[]
  noteText:    string
  savingNote:  string | null
  isOpen:      boolean
  today:       string
  onToggle:    () => void
  onEdit:      () => void
  onNoteChange:(text: string) => void
  onAddNote:   () => void
  onDeleteNote:(noteId: string) => void
  typeOf:      (e: EvenementReseau) => { emoji: string; label: string } | undefined
}

function EventCard({
  event, notes, noteText, savingNote, isOpen, today,
  onToggle, onEdit, onNoteChange, onAddNote, onDeleteNote, typeOf,
}: CardProps) {
  const t         = typeOf(event)
  const isPast    = event.date_event && event.date_event < today
  const noteCount = notes.length

  return (
    <div className={`bg-surface rounded-2xl border overflow-hidden transition-colors ${
      isOpen ? 'border-primary/40 shadow-sm' : 'border-border'
    }`}>

      {/* ── En-tête ── */}
      <div className="flex items-start gap-3 p-4">
        <span className="text-2xl shrink-0 mt-0.5">{t?.emoji ?? '📌'}</span>

        <button onClick={onToggle} className={`flex-1 text-left min-w-0 ${isPast ? 'opacity-70' : ''}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-stone-800 text-sm">{event.nom}</p>
            {noteCount > 0 && (
              <span className="bg-primary-light text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {noteCount} note{noteCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
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
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full font-medium hidden sm:inline-block ${
            isPast ? 'bg-stone-100 text-stone-500' : 'bg-primary-light text-primary'
          }`}>
            {t?.label ?? event.type}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 text-muted hover:text-stone-700 rounded-lg hover:bg-beige-100 transition"
            title="Modifier l'événement"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 text-muted hover:text-stone-700 rounded-lg hover:bg-beige-100 transition"
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* ── Panneau notes ── */}
      {isOpen && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-beige-50/40">

          {/* Input */}
          <div className="flex gap-2 items-end">
            <textarea
              autoFocus
              value={noteText}
              onChange={e => onNoteChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddNote() } }}
              placeholder="Note rapide sur cet événement…"
              rows={2}
              className="flex-1 text-sm border border-border rounded-xl px-3 py-2.5 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={onAddNote}
              disabled={!noteText.trim() || savingNote === event.id}
              className="bg-primary text-white px-3 py-2.5 rounded-xl disabled:opacity-40 hover:bg-primary-dark transition shrink-0"
              title="Ajouter"
            >
              <Send size={14} />
            </button>
          </div>

          {/* Liste */}
          {notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map(note => (
                <div
                  key={note.id}
                  className="bg-white border border-border rounded-xl px-3 py-2.5 group flex items-start gap-2"
                >
                  <FileText size={13} className="text-muted shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{note.contenu}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted">
                        {new Date(note.date_note + 'T00:00:00').toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      {note.synced_notion && (
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">
                          ✓ Notion
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition shrink-0 mt-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted text-center py-1">
              Aucune note pour cet événement — commence à écrire ci-dessus 📝
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function EvenementsPage() {
  const [events,     setEvents]     = useState<EvenementReseau[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState<EventForm>(EMPTY_FORM)
  const [editing,    setEditing]    = useState<EvenementReseau | null>(null)

  const [openEventId, setOpenEventId] = useState<string | null>(null)
  const [notesMap,    setNotesMap]    = useState<Record<string, NoteEvenement[]>>({})
  const [noteTexts,   setNoteTexts]   = useState<Record<string, string>>({})
  const [savingNote,  setSavingNote]  = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: evData }, { data: notesData }] = await Promise.all([
      supabase.from('evenements_reseau').select('*').order('date_event', { ascending: false }),
      supabase.from('notes_evenement').select('*').order('created_at', { ascending: false }),
    ])
    if (evData) setEvents(evData)
    if (notesData) {
      const map: Record<string, NoteEvenement[]> = {}
      for (const n of notesData as NoteEvenement[]) {
        if (!n.evenement_id) continue
        if (!map[n.evenement_id]) map[n.evenement_id] = []
        map[n.evenement_id].push(n)
      }
      setNotesMap(map)
    }
    setLoading(false)
  }

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }

  function openEditModal(e: EvenementReseau) {
    setEditing(e)
    setForm({ nom: e.nom, date_event: e.date_event ?? new Date().toISOString().split('T')[0], lieu: e.lieu ?? '', type: e.type })
    setShowForm(true)
  }

  async function save() {
    if (!form.nom.trim()) return
    const payload = { nom: form.nom.trim(), date_event: form.date_event || null, lieu: form.lieu.trim() || null, type: form.type }
    if (editing) {
      const { data } = await supabase.from('evenements_reseau').update(payload).eq('id', editing.id).select().single()
      if (data) setEvents(prev => prev.map(e => e.id === editing.id ? data : e))
    } else {
      const { data } = await supabase.from('evenements_reseau').insert(payload).select().single()
      if (data) setEvents(prev => [data, ...prev])
    }
    setShowForm(false)
  }

  async function addNote(event: EvenementReseau) {
    const texte = (noteTexts[event.id] ?? '').trim()
    if (!texte) return
    setSavingNote(event.id)
    const { data } = await supabase.from('notes_evenement').insert({
      evenement_id:  event.id,
      evenement_nom: event.nom,
      date_note:     new Date().toISOString().split('T')[0],
      contenu:       texte,
      synced_notion: false,
    }).select().single()
    if (data) {
      setNotesMap(prev => ({ ...prev, [event.id]: [data as NoteEvenement, ...(prev[event.id] ?? [])] }))
      setNoteTexts(prev => ({ ...prev, [event.id]: '' }))
    }
    setSavingNote(null)
  }

  async function deleteNote(eventId: string, noteId: string) {
    await supabase.from('notes_evenement').delete().eq('id', noteId)
    setNotesMap(prev => ({ ...prev, [eventId]: (prev[eventId] ?? []).filter(n => n.id !== noteId) }))
  }

  const today    = new Date().toISOString().split('T')[0]
  const typeOf   = (e: EvenementReseau) => TYPES.find(t => t.value === e.type)
  const prochains = events.filter(e => e.date_event && e.date_event >= today)
  const passes    = events.filter(e => !e.date_event || e.date_event < today)

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  const cardProps = (e: EvenementReseau) => ({
    event:        e,
    notes:        notesMap[e.id] ?? [],
    noteText:     noteTexts[e.id] ?? '',
    savingNote,
    isOpen:       openEventId === e.id,
    today,
    onToggle:     () => setOpenEventId(prev => prev === e.id ? null : e.id),
    onEdit:       () => openEditModal(e),
    onNoteChange: (text: string) => setNoteTexts(prev => ({ ...prev, [e.id]: text })),
    onAddNote:    () => addNote(e),
    onDeleteNote: (nid: string) => deleteNote(e.id, nid),
    typeOf,
  })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Événements</h1>
          <p className="text-xs text-muted mt-0.5">Tes rencontres professionnelles</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition"
        >
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {/* À venir */}
      {prochains.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
            <CalendarDays size={14} className="text-primary" /> À venir
          </h2>
          {prochains.map(e => <EventCard key={e.id} {...cardProps(e)} />)}
        </div>
      )}

      {/* Passés */}
      {passes.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-stone-700 text-sm">Passés</h2>
          {passes.map(e => <EventCard key={e.id} {...cardProps(e)} />)}
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-10 text-muted">
          <p className="text-3xl mb-3">🗓️</p>
          <p className="text-sm font-medium text-stone-700">Aucun événement pour l'instant</p>
          <p className="text-xs mt-1">Ajoute ton prochain événement réseau</p>
        </div>
      )}

      {/* Modal formulaire */}
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
                  <button
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition ${
                      form.type === t.value
                        ? 'border-primary bg-primary-light text-primary font-medium'
                        : 'border-border text-muted hover:border-primary/40'
                    }`}
                  >
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={save}
                disabled={!form.nom.trim()}
                className="flex-1 bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-dark transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Check size={16} /> {editing ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
