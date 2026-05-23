'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, Copy, Check } from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const INTRO = `Bonjour ! Je suis là pour t'aider à qualifier le projet de ton client avant de créer le devis.

Je vais te poser quelques questions sur son activité et ses besoins réels. Tu seras ensuite guidée vers les bons supports.

Pour commencer : quelle est l'activité de ton client ?`

const UNAVAILABLE = `Le chatbot n'est pas encore activé.

Pour l'activer, ajoute une clé API Anthropic dans les paramètres de ton projet Vercel (variable ANTHROPIC_API_KEY).

Tu peux obtenir une clé sur console.anthropic.com — à partir de 5$ de crédits.

En attendant, tous les autres modules de Fayko sont pleinement disponibles !`

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: INTRO },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const lastMessage = messages[messages.length - 1]
  const hasSynthese = lastMessage?.role === 'assistant' && lastMessage.content.includes('Bloc 1')

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages.filter(m => m.content !== INTRO), userMsg]
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (res.status === 503) {
        setMessages(prev => [...prev, { role: 'assistant', content: UNAVAILABLE }])
        setLoading(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      const assistantMsg: Message = { role: 'assistant', content: '' }
      setMessages(prev => [...prev, assistantMsg])

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

  function reset() {
    setMessages([{ role: 'assistant', content: INTRO }])
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between mb-4">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-surface border border-border text-stone-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Synthèse copy button */}
      {hasSynthese && (
        <button
          onClick={copySynthese}
          className="flex items-center justify-center gap-2 w-full py-3 mb-2 bg-primary-light border border-primary/20 text-primary font-semibold text-sm rounded-xl hover:bg-primary/10 transition"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Synthèse copiée !' : 'Copier la synthèse'}
        </button>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tape ta réponse…"
          rows={1}
          className="flex-1 border border-border rounded-xl px-4 py-3 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="bg-primary text-white rounded-xl p-3 hover:bg-primary-dark transition disabled:opacity-40 shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
