'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }

    setLoading(true)
    const { error: signupError } = await supabase.auth.signUp({ email, password })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold text-stone-800">Compte créé !</h2>
          <p className="text-sm text-muted">
            Un email de confirmation t'a été envoyé à <strong>{email}</strong>.
            Clique sur le lien pour activer ton compte, puis connecte-toi.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-primary text-white font-semibold rounded-xl py-3 text-sm hover:bg-primary-dark transition"
          >
            Aller à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-1">Fayko</h1>
          <p className="text-muted text-sm">Crée ton compte</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                placeholder="ton@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-semibold rounded-xl py-3 text-sm hover:bg-primary-dark transition disabled:opacity-60"
            >
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-4">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
