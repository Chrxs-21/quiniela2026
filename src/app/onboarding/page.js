'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')

    // Validaciones básicas
    if (!username.trim() || !displayName.trim()) {
      setError('Por favor llena todos los campos')
      return
    }
    if (username.length < 3) {
      setError('El username debe tener al menos 3 caracteres')
      return
    }
    if (username.includes(' ')) {
      setError('El username no puede tener espacios')
      return
    }

    setLoading(true)

    // Verificar que el username no esté tomado
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle()

    if (existing) {
      setError('Ese username ya está en uso, elige otro')
      setLoading(false)
      return
    }

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()

    // Guardar perfil en public.users
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        username: username.toLowerCase(),
        display_name: displayName.trim(),
        avatar_url: user.user_metadata?.avatar_url || null,
      })

    if (insertError) {
      setError('Hubo un error, intenta de nuevo')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-secondary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '1.5rem',
        padding: '3rem 2.5rem',
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>

        {/* Título */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👤</div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}>
            Crea tu perfil
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Así te verán los demás en el ranking
          </p>
        </div>

        {/* Campo Username */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Username
          </label>
          <input
            type="text"
            placeholder="ej: cr7fan, golazo_mx"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={20}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.875rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
              width: '100%',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
            Mínimo 3 caracteres, sin espacios. Este será tu nombre en el ranking.
          </span>
        </div>

        {/* Campo Nombre Real */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Nombre real
          </label>
          <input
            type="text"
            placeholder="ej: Carlos Rodríguez"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={40}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.875rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
              width: '100%',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
            Aparecerá en el ranking debajo de tu username.
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: '#3d1515',
            border: '1px solid #7f1d1d',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Botón */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: loading ? 'var(--border)' : 'var(--accent)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.875rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? 'Guardando...' : 'Entrar a la Quiniela 🏆'}
        </button>

      </div>
    </main>
  )
}