'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)



  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')

    // Cargar perfil
    const { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    // Cargar salas del usuario
    const { data: roomsData } = await supabase
      .from('room_members')
      .select(`
        joined_at,
        total_points,
        rooms (
          id,
          name,
          code,
          phase,
          owner_id
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })

    setProfile(profileData)
    setRooms(roomsData || [])
    setLoading(false)
  }

useEffect(() => {
  let mounted = true

  async function init() {
    await loadData()
  }

  if (mounted) init()

  return () => {
    mounted = false
  }
}, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
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
        <p style={{ color: 'var(--text-secondary)' }}>Cargando...</p>
      </main>
    )
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🏆</span>
          <span style={{
            fontWeight: '700',
            color: 'var(--text-primary)',
            fontSize: '1rem',
          }}>
            Quiniela 2026
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{
              color: 'var(--text-primary)',
              fontWeight: '600',
              fontSize: '0.9rem',
            }}>
              {profile?.username}
            </p>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}>
              {profile?.display_name}
            </p>
          </div>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            border: '2px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            }}>
            {profile?.username?.charAt(0).toUpperCase()}
        </div>
          <button
            onClick={handleSignOut}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.75rem',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Salir
          </button>
        </div>
      </nav>

      {/* Contenido */}
      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => router.push('/sala/crear')}
            style={{
              flex: 1,
              backgroundColor: 'var(--accent)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.875rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            ➕ Crear sala
          </button>
          <button
            onClick={() => router.push('/sala/unirse')}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.875rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            🔗 Unirse a sala
          </button>
        </div>

        {/* Lista de salas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Mis Salas ({rooms.length})
          </h2>

          {rooms.length === 0 ? (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '1rem',
              padding: '3rem',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚽</p>
              <p style={{
                color: 'var(--text-primary)',
                fontWeight: '600',
                marginBottom: '0.5rem',
              }}>
                No estás en ninguna sala
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Crea una sala o únete con un código
              </p>
            </div>
          ) : (
            rooms.map((member) => (
              <div
                key={member.rooms.id}
                onClick={() => router.push(`/sala/${member.rooms.id}`)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '1rem',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div>
                  <p style={{
                    color: 'var(--text-primary)',
                    fontWeight: '600',
                    fontSize: '1rem',
                    marginBottom: '0.25rem',
                  }}>
                    {member.rooms.name}
                  </p>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                  }}>
                    Código: {member.rooms.code} · {
                      member.rooms.phase === 'group' ? '⚽ Fase de Grupos' :
                      member.rooms.phase === 'knockout' ? '🏆 Eliminatorias' :
                      '🎉 Finalizado'
                    }
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    color: 'var(--accent)',
                    fontWeight: '700',
                    fontSize: '1.25rem',
                  }}>
                    {member.total_points}
                  </p>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                  }}>
                    puntos
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </main>
  )
}