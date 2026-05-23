'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, Copy, Check, Search, X, Save, UserCircle2, Paperclip } from 'lucide-react'
import { copyToClipboard, formatDate, formatPrice } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Client, Devis } from '@/lib/types'

interface ImageBlock {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
  preview: string // data URL for display
}

interface Message {
  role: 'user' | 'assistant'
  content: string | { text?: string; image?: ImageBlock }
}

// Resize + compress image to stay under 4MB base64
async function compressImage(file: File): Promise<{ base64: string; mediaType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1400
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      const preview = canvas.toDataURL('image/jpeg', 0.85)
      const base64 = preview.split(',')[1]
      URL.revokeObjectURL(objectUrl)
      resolve({ base64, mediaType: 'image/jpeg', preview })
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

interface ClientWithDevis extends Client {
  devis?: Devis[]
}

function buildClientContext(client: ClientWithDevis): string {
  const devisLines = (client.devis || [])
    .slice(0, 5)
    .map(d => `  - #${String(d.numero).padStart(3, '0')} ${d.titre} — ${formatPrice(d.total_ht)} — ${d.statut}`)
    .join('\n')

  let ctx = `--- CONTEXTE CLIENT ---
Nom : ${client.prenom} ${client.nom}`
  if (client.marque) ctx += `\nMarque : ${client.marque}`
  if (client.whatsapp) ctx += `\nWhatsApp : ${client.whatsapp}`
  if (devisLines) ctx += `\nDevis précédents :\n${devisLines}`
  if (client.derniere_synthese) {
    ctx += `\nDernière synthèse (${client.derniere_synthese_at ? formatDate(client.derniere_synthese_at) : 'date inconnue'}) :\n${client.derniere_synthese}`
  }
  ctx += `\n--- FIN CONTEXTE ---`
  return ctx
}

const makeIntro = (client?: ClientWithDevis | null) => {
  if (client) {
    const devisCount = client.devis?.length ?? 0
    return `Bonjour ! J'ai chargé le dossier de **${client.prenom} ${client.nom}**${client.marque ? ` (${client.marque})` : ''}.

${devisCount > 0 ? `Ce client a déjà ${devisCount} devis dans l'historique.` : `C'est un nouveau client, pas encore de devis.`}

On démarre la qualification. Qu'est-ce qu'il t'a demandé cette fois ?`
  }
  return `Bonjour ! Je suis là pour t'aider à préparer ta proposition avant de créer le devis.

On va travailler ensemble sur le projet de ton client : je vais te poser des questions, challenger tes hypothèses, et t'aider à identifier ce qui est vraiment prioritaire.

Pour commencer : c'est quel type de client ? Quelle est son activité ?`
}

const UNAVAILABLE = `Le chatbot n'est pas encore activé.

Pour l'activer, ajoute une clé API Anthropic dans les paramètres de ton projet Vercel (variable ANTHROPIC_API_KEY).

Tu peux obtenir une clé sur console.anthropic.com — à partir de 5$ de crédits.

En attendant, tous les autres modules de Fayko sont pleinement disponibles !`

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: makeIntro() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pendingImage, setPendingImage] = useState<ImageBlock | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Client selector
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientWithDevis | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    supabase.from('clients').select('*').order('nom').then(({ data }) => {
      if (data) setClients(data)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredClients = clients.filter(c =>
    `${c.prenom} ${c.nom} ${c.marque ?? ''}`.toLowerCase().includes(clientSearch.toLowerCase())
  )

  async function selectClient(c: Client) {
    const { data: devisData } = await supabase
      .from('devis')
      .select('*')
      .eq('client_id', c.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: clientFull } = await supabase
      .from('clients')
      .select('*')
      .eq('id', c.id)
      .single()

    const client: ClientWithDevis = {
      ...(clientFull ?? c),
      devis: devisData ?? [],
    }
    setSelectedClient(client)
    setShowSearch(false)
    setClientSearch('')
    setMessages([{ role: 'assistant', content: makeIntro(client) }])
  }

  function clearClient() {
    setSelectedClient(null)
    setMessages([{ role: 'assistant', content: makeIntro() }])
  }

  const lastMessage = messages[messages.length - 1]
  const hasSynthese = lastMessage?.role === 'assistant' && lastMessage.content.includes('Bloc 1')

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { base64, mediaType, preview } = await compressImage(file)
      setPendingImage({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 }, preview })
    } catch {
      alert('Impossible de charger cette image.')
    }
    e.target.value = ''
  }

  async function sendMessage() {
    if ((!input.trim() && !pendingImage) || loading) return

    const userMsg: Message = {
      role: 'user',
      content: pendingImage
        ? { text: input.trim() || 'Voici ce que mon client m\'a partagé.', image: pendingImage }
        : input.trim(),
    }

    // Build messages for API
    const history = messages.filter(m => m.content !== makeIntro(selectedClient) && m.content !== makeIntro())
    const apiMessages: Message[] = []

    if (selectedClient) {
      apiMessages.push({ role: 'user', content: buildClientContext(selectedClient) })
      apiMessages.push({ role: 'assistant', content: `Contexte chargé pour ${selectedClient.prenom} ${selectedClient.nom}. Prête à travailler sur ce dossier.` })
    }

    // Convert messages to Anthropic format
    const toApiFormat = (m: Message) => {
      if (typeof m.content === 'string') return { role: m.role, content: m.content }
      const blocks = []
      if (m.content.image) {
        blocks.push({ type: 'image', source: m.content.image.source })
      }
      if (m.content.text) blocks.push({ type: 'text', text: m.content.text })
      return { role: m.role, content: blocks }
    }

    const formattedHistory = history.map(toApiFormat)
    apiMessages.push(...formattedHistory, toApiFormat(userMsg))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPendingImage(null)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (res.status === 503) {
        setMessages(prev => [...prev, { role: 'assistant', content: UNAVAILABLE }])
        setLoading(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Une erreur est survenue. Réessaie.' }])
    } finally {
      setLoading(false)
    }
  }

  async function copySynthese() {
    await copyToClipboard(lastMessage.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveSynthese() {
    if (!selectedClient || !hasSynthese) return
    await supabase.from('clients').update({
      derniere_synthese: lastMessage.content,
      derniere_synthese_at: new Date().toISOString(),
    }).eq('id', selectedClient.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function reset() {
    setSelectedClient(null)
    setMessages([{ role: 'assistant', content: makeIntro() }])
    setInput('')
    setSaved(false)
    setPendingImage(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !pendingImage) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-3rem)]">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Qualification client</h1>
          <p className="text-xs text-muted">Chatbot de qualification avant devis</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-stone-700 transition px-3 py-2 rounded-xl border border-border bg-surface"
        >
          <RotateCcw size={14} /> Nouvelle session
        </button>
      </div>

      {/* Client selector */}
      <div className="mb-3">
        {!selectedClient ? (
          <div>
            {!showSearch ? (
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 text-sm text-primary font-medium px-3 py-2 rounded-xl border border-dashed border-primary/30 hover:bg-primary-light w-full transition"
              >
                <UserCircle2 size={16} /> Lier à un client existant (optionnel)
              </button>
            ) : (
              <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    autoFocus
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder="Rechercher un client…"
                    className="w-full pl-8 pr-4 py-2 text-sm border border-border rounded-xl bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {clientSearch && (
                  <div className="border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {filteredClients.map(c => (
                      <button key={c.id} onClick={() => selectClient(c)}
                        className="w-full text-left px-3 py-2 hover:bg-beige-50 text-sm border-b border-border last:border-0">
                        {c.prenom} {c.nom}
                        {c.marque && <span className="text-primary text-xs ml-2">{c.marque}</span>}
                      </button>
                    ))}
                    {filteredClients.length === 0 && <p className="px-3 py-2 text-sm text-muted">Aucun résultat</p>}
                  </div>
                )}
                <button onClick={() => setShowSearch(false)} className="text-xs text-muted">Annuler</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-primary-light border border-primary/20 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <UserCircle2 size={16} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-stone-800">{selectedClient.prenom} {selectedClient.nom}</p>
                {selectedClient.marque && <p className="text-xs text-primary">{selectedClient.marque}</p>}
              </div>
            </div>
            <button onClick={clearClient} className="text-muted hover:text-stone-700 p-1">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-surface border border-border text-stone-800 rounded-bl-sm'
            }`}>
              {typeof msg.content === 'string' ? (
                <p className="px-4 py-3 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              ) : (
                <div className="overflow-hidden">
                  {msg.content.image && (
                    <img
                      src={msg.content.image.preview}
                      alt="Pièce jointe"
                      className="w-full max-w-[280px] rounded-t-2xl object-cover"
                    />
                  )}
                  {msg.content.text && (
                    <p className="px-4 py-3 whitespace-pre-wrap leading-relaxed">{msg.content.text}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Synthèse actions */}
      {hasSynthese && (
        <div className="flex gap-2 mb-2">
          <button
            onClick={copySynthese}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-light border border-primary/20 text-primary font-semibold text-sm rounded-xl hover:bg-primary/10 transition"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copié !' : 'Copier la synthèse'}
          </button>
          {selectedClient && (
            <button
              onClick={saveSynthese}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold text-sm rounded-xl transition border ${
                saved
                  ? 'bg-green-100 border-green-200 text-green-700'
                  : 'bg-surface border-border text-stone-700 hover:border-primary/30'
              }`}
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Sauvegardé !' : 'Sauvegarder dans le dossier'}
            </button>
          )}
        </div>
      )}

      {/* Image preview */}
      {pendingImage && (
        <div className="relative mb-2 inline-block">
          <img src={pendingImage.preview} alt="À envoyer" className="h-20 rounded-xl border border-border object-cover" />
          <button
            onClick={() => setPendingImage(null)}
            className="absolute -top-2 -right-2 bg-stone-700 text-white rounded-full w-5 h-5 flex items-center justify-center"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-xl border border-border bg-surface text-muted hover:text-stone-700 hover:border-primary/30 transition shrink-0"
          title="Ajouter une image"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingImage ? "Ajoute un commentaire (optionnel)…" : "Tape ta réponse…"}
          rows={1}
          className="flex-1 border border-border rounded-xl px-4 py-3 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={sendMessage}
          disabled={(!input.trim() && !pendingImage) || loading}
          className="bg-primary text-white rounded-xl p-3 hover:bg-primary-dark transition disabled:opacity-40 shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
