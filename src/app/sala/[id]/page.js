'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function SalaPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()

  const [sala, setSala] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')

    // Cargar perfil del usuario actual
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    setCurrentUser(profile)

    // Cargar sala
    const { data: salaData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single()

    if (!salaData) return router.push('/dashboard')
    setSala(salaData)

    // Cargar miembros con sus perfiles
    const { data: miembrosData } = await supabase
      .from('room_members')
      .select(`
        id,
        user_id,
        total_points,
        joined_at,
        users (
          username,
          display_name
        )
      `)
      .eq('room_id', id)
      .order('total_points', { ascending: false })

    setMiembros(miembrosData || [])
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      await loadData()
    }
    init()
  }, [id])

  async function handleExpulsar(memberId, username) {
    if (!confirm(`¿Expulsar a ${username} de la sala?`)) return

    await supabase
      .from('room_members')
      .delete()
      .eq('id', memberId)

    loadData()
  }

  async function handleCopiarCodigo() {
    await navigator.clipboard.writeText(sala.code)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function handleAbandonar() {
  if (!confirm('¿Seguro que quieres abandonar esta sala?')) return

  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', id)
    .eq('user_id', user.id)

  router.push('/dashboard')
}

async function handleEliminarSala() {
  if (!confirm('¿Eliminar la sala permanentemente? Esta acción no se puede deshacer.')) return

  // Eliminar predicciones de la sala
  await supabase
    .from('predictions')
    .delete()
    .eq('room_id', id)

  // Eliminar miembros
  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', id)

  // Eliminar sala
  await supabase
    .from('rooms')
    .delete()
    .eq('id', id)

  router.push('/dashboard')
}

  if (loading) {
    return (
      <main style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando sala...</p>
      </main>
    )
  }

  const esAdmin = currentUser?.id === sala?.owner_id

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-secondary)',
    }}>

      {/* Navbar */}
      <nav style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          ← Dashboard
        </button>
        <span style={{
          fontWeight: '700',
          color: 'var(--text-primary)',
          fontSize: '1rem',
        }}>
          🏟️ {sala?.name}
        </span>
        <div style={{ width: '80px' }} />
      </nav>

      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>

        {/* Card código de sala */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              marginBottom: '0.25rem',
            }}>
              Código para invitar
            </p>
            <p style={{
              color: 'var(--text-primary)',
              fontWeight: '700',
              fontSize: '2rem',
              letterSpacing: '0.5rem',
            }}>
              {sala?.code}
            </p>
          </div>
          <button
            onClick={handleCopiarCodigo}
            style={{
              backgroundColor: copiado ? '#166534' : 'var(--accent)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {copiado ? '✅ Copiado' : '📋 Copiar'}
          </button>
        </div>

        {/* Botones de navegación */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => router.push(`/sala/${id}/partidos`)}
            style={{
              flex: 1,
              backgroundColor: 'var(--accent)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '1rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            ⚽ Partidos
          </button>
          <button
            onClick={() => router.push(`/sala/${id}/ranking`)}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            🏆 Ranking
          </button>
        </div>
        {/* Botones de abandonar/eliminar sala */}
        <div style={{ display: 'flex', gap: '1rem' }}>
        {!esAdmin && (
            <button
            onClick={handleAbandonar}
            style={{
                flex: 1,
                backgroundColor: 'transparent',
                color: '#fca5a5',
                border: '1px solid #7f1d1d',
                borderRadius: '0.75rem',
                padding: '0.875rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
            }}
            >
            🚪 Abandonar sala
            </button>
        )}
        {esAdmin && (
            <button
            onClick={handleEliminarSala}
            style={{
                flex: 1,
                backgroundColor: '#7f1d1d',
                color: '#ffffff',
                border: '1px solid #991b1b',
                borderRadius: '0.75rem',
                padding: '0.875rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
            }}
            >
            🗑️ Eliminar sala
            </button>
        )}
        </div>    
        {/* Fase actual */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Fase actual
            </p>
            <p style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {sala?.phase === 'group' ? '⚽ Fase de Grupos' :
               sala?.phase === 'knockout' ? '🏆 Eliminatorias' :
               '🎉 Finalizado'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Participantes
            </p>
            <p style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {miembros.length} / 50
            </p>
          </div>
        </div>

        {/* Lista de miembros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Participantes ({miembros.length})
          </h2>

          {miembros.map((miembro, index) => (
            <div
              key={miembro.id}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{
                  color: index === 0 ? '#facc15' :
                         index === 1 ? '#94a3b8' :
                         index === 2 ? '#b45309' :
                         'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '1rem',
                  width: '24px',
                }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                </span>
                <div>
                  <p style={{
                    color: 'var(--text-primary)',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                  }}>
                    {miembro.users?.username}
                    {miembro.user_id === sala?.owner_id && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        backgroundColor: 'var(--accent)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '0.25rem',
                        color: 'var(--text-primary)',
                      }}>
                        admin
                      </span>
                    )}
                  </p>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                  }}>
                    {miembro.users?.display_name}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    color: 'var(--accent)',
                    fontWeight: '700',
                    fontSize: '1.1rem',
                  }}>
                    {miembro.total_points}
                  </p>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                  }}>
                    pts
                  </p>
                </div>

                {/* Botón expulsar (solo admin, no puede expulsarse a sí mismo) */}
                {esAdmin && miembro.user_id !== currentUser?.id && (
                  <button
                    onClick={() => handleExpulsar(miembro.id, miembro.users?.username)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #7f1d1d',
                      borderRadius: '0.5rem',
                      padding: '0.35rem 0.6rem',
                      color: '#fca5a5',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Expulsar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}