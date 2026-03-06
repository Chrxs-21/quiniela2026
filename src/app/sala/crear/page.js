'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function CrearSalaPage() {
  const supabase = createClient()
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCrear() {
    setError('')

    if (!nombre.trim()) {
      setError('Ponle un nombre a tu sala')
      return
    }
    if (nombre.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Crear la sala
    const { data: sala, error: salaError } = await supabase
      .from('rooms')
      .insert({
        name: nombre.trim(),
        code: generateCode(),
        owner_id: user.id,
        phase: 'group',
      })
      .select()
      .single()

    if (salaError) {
    setError(salaError.message)
    setLoading(false)
    return
    }

    // Unir al creador como miembro automáticamente
    await supabase
      .from('room_members')
      .insert({
        room_id: sala.id,
        user_id: user.id,
        total_points: 0,
      })

    router.push(`/sala/${sala.id}`)
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
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏟️</div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}>
            Crear Sala
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Invita hasta 50 amigos con el código que se generará
          </p>
        </div>

        {/* Campo nombre */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Nombre de la sala
          </label>
          <input
            type="text"
            placeholder="ej: La Quiniela de la Oficina"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
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
        </div>

        {/* Info */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            ℹ️ Al crear la sala:
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            • Se genera un código único para invitar amigos
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            • Tú serás el administrador
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            • Máximo 50 participantes
          </p>
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

        {/* Botones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handleCrear}
            disabled={loading}
            style={{
              backgroundColor: loading ? 'var(--border)' : 'var(--accent)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {loading ? 'Creando...' : '🏟️ Crear Sala'}
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.875rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            ← Volver
          </button>
        </div>

      </div>
    </main>
  )
}