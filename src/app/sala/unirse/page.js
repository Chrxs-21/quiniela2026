'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function UnirseSalaPage() {
  const supabase = createClient()
  const router = useRouter()

  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUnirse() {
    setError('')

    if (!codigo.trim()) {
      setError('Ingresa el código de la sala')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Buscar la sala por código
    const { data: sala } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', codigo.toUpperCase())
      .single()

    if (!sala) {
      setError('Código incorrecto, verifica e intenta de nuevo')
      setLoading(false)
      return
    }

    // Verificar si ya es miembro
    const { data: yaEsMiembro } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', sala.id)
      .eq('user_id', user.id)
      .single()

    if (yaEsMiembro) {
      router.push(`/sala/${sala.id}`)
      return
    }

    // Verificar límite de 50 personas
    const { count } = await supabase
      .from('room_members')
      .select('id', { count: 'exact' })
      .eq('room_id', sala.id)

    if (count >= 50) {
      setError('Esta sala ya está llena (máximo 50 participantes)')
      setLoading(false)
      return
    }

    // Unirse a la sala
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
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔗</div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}>
            Unirse a Sala
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Ingresa el código que te compartió el creador de la sala
          </p>
        </div>

        {/* Campo código */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Código de la sala
          </label>
          <input
            type="text"
            placeholder="ej: ABC123"
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            maxLength={6}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.875rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '1.5rem',
              fontWeight: '700',
              letterSpacing: '0.5rem',
              outline: 'none',
              width: '100%',
              textAlign: 'center',
            }}
          />
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
            onClick={handleUnirse}
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
            {loading ? 'Buscando sala...' : '🔗 Unirse'}
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