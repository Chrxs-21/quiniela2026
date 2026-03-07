'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()

  const [tab, setTab] = useState('partidos')
  const [sala, setSala] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [miembros, setMiembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(null)
  const [faseGrupos, setFaseGrupos] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  // Estados para edición de resultados
  const [editando, setEditando] = useState(null)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)

  // Estado para edición de equipos knockout
  const [editandoEquipo, setEditandoEquipo] = useState(null)
  const [nuevoNombre, setNuevoNombre] = useState('')

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')

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

    // Verificar que es admin
    if (salaData?.owner_id !== user.id) {
      router.push(`/sala/${id}`)
      return
    }

    setSala(salaData)

    // Cargar partidos
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .order('match_number', { ascending: true })

    setPartidos(matchesData || [])

    // Cargar miembros
    const { data: miembrosData } = await supabase
      .from('room_members')
      .select(`
        id,
        user_id,
        total_points,
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
    async function init() { await loadData() }
    init()
  }, [id])

  function mostrarMensaje(texto, tipo = 'success') {
    setMensaje({ texto, tipo })
    setTimeout(() => setMensaje(null), 3000)
  }

  function abrirEdicion(partido) {
    setEditando(partido.id)
    setHomeScore(partido.home_score ?? 0)
    setAwayScore(partido.away_score ?? 0)
  }

  async function handleGuardarResultado(partido) {
    setGuardando(partido.id)

    const { error } = await supabase
      .from('matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'finished',
      })
      .eq('id', partido.id)

    if (error) {
      mostrarMensaje('Error al guardar resultado', 'error')
    } else {
      mostrarMensaje(`✅ Resultado guardado: ${partido.home_team} ${homeScore}-${awayScore} ${partido.away_team}`)
    }

    setEditando(null)
    setGuardando(null)
    await loadData()
  }

async function handleBloquear(partido) {
    const nuevoStatus = partido.status === 'locked' ? 'scheduled' : 'locked'

    await supabase
      .from('matches')
      .update({ status: nuevoStatus })
      .eq('id', partido.id)

    mostrarMensaje(nuevoStatus === 'locked' ? '🔒 Partido bloqueado' : '🔓 Partido desbloqueado')
    await loadData()
  }

  async function handleActivarEliminatorias() {
    if (!confirm('¿Activar fase de eliminatorias? Los usuarios podrán hacer predicciones.')) return

    await supabase
      .from('rooms')
      .update({ knockout_unlocked: true, phase: 'knockout' })
      .eq('id', id)

    mostrarMensaje('🏆 Fase de eliminatorias activada')
    await loadData()
  }

  async function handleDesactivarEliminatorias() {
    if (!confirm('¿Desactivar fase de eliminatorias?')) return

    await supabase
      .from('rooms')
      .update({ knockout_unlocked: false, phase: 'group' })
      .eq('id', id)

    mostrarMensaje('⚽ Fase de grupos reactivada')
    await loadData()
  }

  async function handleActualizarEquipo(partido, lado) {
    if (!nuevoNombre.trim()) return
    setGuardando(partido.id)

    const campo = lado === 'home' ? 'home_team' : 'away_team'

    await supabase
      .from('matches')
      .update({ [campo]: nuevoNombre.trim() })
      .eq('id', partido.id)

    mostrarMensaje(`✅ Equipo actualizado a: ${nuevoNombre}`)
    setEditandoEquipo(null)
    setNuevoNombre('')
    setGuardando(null)
    await loadData()
  }

  async function handleExpulsar(miembro) {
    if (!confirm(`¿Expulsar a ${miembro.users?.username} de la sala?`)) return

    await supabase
      .from('room_members')
      .delete()
      .eq('id', miembro.id)

    mostrarMensaje(`✅ ${miembro.users?.username} fue expulsado`)
    await loadData()
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
        <p style={{ color: 'var(--text-secondary)' }}>Cargando panel admin...</p>
      </main>
    )
  }

  const partidosGrupos = partidos.filter(p => p.phase === 'group')
  const partidosKnockout = partidos.filter(p => p.phase === 'knockout')

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
          onClick={() => router.push(`/sala/${id}`)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          ← Sala
        </button>
        <span style={{
          fontWeight: '700',
          color: 'var(--text-primary)',
          fontSize: '1rem',
        }}>
          ⚙️ Panel Admin
        </span>
        <div style={{ width: '60px' }} />
      </nav>

      {/* Tabs */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        display: 'flex',
        justifyContent: 'center',
      }}>
        {[
          { key: 'partidos', label: '📋 Partidos' },
          { key: 'eliminatorias', label: '🏆 Eliminatorias' },
          { key: 'miembros', label: '👥 Miembros' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '1rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: tab === t.key ? '700' : '400',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mensaje flotante */}
      {mensaje && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: mensaje.tipo === 'error' ? '#7f1d1d' : '#166534',
          color: 'white',
          padding: '0.875rem 1.5rem',
          borderRadius: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: '600',
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {mensaje.texto}
        </div>
      )}

      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>

        {/* ========== TAB: PARTIDOS ========== */}
        {tab === 'partidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Selector fase */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setFaseGrupos(true)}
                style={{
                  flex: 1,
                  backgroundColor: faseGrupos ? 'var(--accent)' : 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ⚽ Grupos ({partidosGrupos.length})
              </button>
              <button
                onClick={() => setFaseGrupos(false)}
                style={{
                  flex: 1,
                  backgroundColor: !faseGrupos ? 'var(--accent)' : 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                🏆 Knockout ({partidosKnockout.length})
              </button>
            </div>

            {/* Lista de partidos */}
            {(faseGrupos ? partidosGrupos : partidosKnockout).map(partido => (
              <div
                key={partido.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${
                    partido.status === 'finished' ? '#166534' :
                    partido.status === 'locked' ? '#854d0e' :
                    'var(--border)'
                  }`,
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Info del partido */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      marginBottom: '0.25rem',
                    }}>
                      {partido.phase === 'group' ? `Grupo ${partido.group_name} · ` : ''}
                      {partido.round} · #{partido.match_number}
                    </p>
                    <p style={{
                      color: 'var(--text-primary)',
                      fontWeight: '600',
                      fontSize: '0.95rem',
                    }}>
                      {partido.home_team} vs {partido.away_team}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '0.4rem',
                    backgroundColor:
                      partido.status === 'finished' ? '#166534' :
                      partido.status === 'locked' ? '#854d0e' :
                      'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}>
                    {partido.status === 'finished' ? '✅ Finalizado' :
                     partido.status === 'locked' ? '🔒 Bloqueado' :
                     '🕐 Pendiente'}
                  </span>
                </div>

                {/* Resultado actual si existe */}
                {partido.status === 'finished' && (
                  <p style={{
                    color: 'var(--success)',
                    fontWeight: '700',
                    fontSize: '1rem',
                    textAlign: 'center',
                  }}>
                    {partido.home_score} - {partido.away_score}
                  </p>
                )}

                {/* Editor de resultado */}
                {editando === partido.id ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1rem',
                    }}>
                      {[
                        { value: homeScore, setValue: setHomeScore, label: partido.home_team },
                        { value: awayScore, setValue: setAwayScore, label: partido.away_team },
                      ].map((equipo, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}>
                          <span style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            textAlign: 'center',
                            maxWidth: '80px',
                          }}>
                            {equipo.label}
                          </span>
                          <button
                            onClick={() => equipo.setValue(v => Math.min(v + 1, 20))}
                            style={{
                              width: '36px', height: '36px',
                              backgroundColor: 'var(--accent)',
                              border: 'none', borderRadius: '0.5rem',
                              color: 'white', fontSize: '1.1rem',
                              cursor: 'pointer', fontWeight: '700',
                            }}
                          >+</button>
                          <span style={{
                            color: 'var(--text-primary)',
                            fontWeight: '700',
                            fontSize: '2rem',
                            minWidth: '40px',
                            textAlign: 'center',
                          }}>
                            {equipo.value}
                          </span>
                          <button
                            onClick={() => equipo.setValue(v => Math.max(v - 1, 0))}
                            style={{
                              width: '36px', height: '36px',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              borderRadius: '0.5rem',
                              color: 'var(--text-primary)',
                              fontSize: '1.1rem',
                              cursor: 'pointer', fontWeight: '700',
                            }}
                          >-</button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleGuardarResultado(partido)}
                        disabled={guardando === partido.id}
                        style={{
                          flex: 1,
                          backgroundColor: 'var(--accent)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.75rem',
                          padding: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        {guardando === partido.id ? 'Guardando...' : '✅ Confirmar resultado'}
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.75rem',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => abrirEdicion(partido)}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.75rem',
                        padding: '0.65rem',
                        fontSize: '0.82rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      {partido.status === 'finished' ? '✏️ Editar resultado' : '⚽ Cargar resultado'}
                    </button>
                    <button
                      onClick={() => handleBloquear(partido)}
                      style={{
                        flex: 1,
                        backgroundColor: partido.status === 'locked' ? '#854d0e' : 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: `1px solid ${partido.status === 'locked' ? '#a16207' : 'var(--border)'}`,
                        borderRadius: '0.75rem',
                        padding: '0.65rem',
                        fontSize: '0.82rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      {partido.status === 'locked' ? '🔓 Desbloquear' : '🔒 Bloquear'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ========== TAB: ELIMINATORIAS ========== */}
        {tab === 'eliminatorias' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Card estado actual */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${sala?.knockout_unlocked ? '#166534' : 'var(--border)'}`,
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
                  Estado actual
                </p>
                <p style={{
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  fontSize: '1rem',
                }}>
                  {sala?.knockout_unlocked ? '🏆 Eliminatorias activas' : '⚽ Fase de grupos activa'}
                </p>
              </div>
              <button
                onClick={sala?.knockout_unlocked ? handleDesactivarEliminatorias : handleActivarEliminatorias}
                style={{
                  backgroundColor: sala?.knockout_unlocked ? '#7f1d1d' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {sala?.knockout_unlocked ? '⚽ Desactivar' : '🏆 Activar'}
              </button>
            </div>

            {/* Nota informativa */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '1rem',
              padding: '1rem 1.25rem',
            }}>
              <p style={{
                color: 'var(--warning)',
                fontSize: '0.82rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
              }}>
                ⚠️ Recuerda al cargar resultados:
              </p>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                lineHeight: '1.6',
              }}>
                En partidos que vayan a tiempo extra, carga el resultado al final de los <strong style={{ color: 'var(--text-primary)' }}>120 minutos</strong>. Los penales <strong style={{ color: 'var(--text-primary)' }}>no cuentan</strong>.
              </p>
            </div>

            {/* Actualizar equipos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Actualizar equipos clasificados
              </h3>

              {partidosKnockout.map(partido => (
                <div
                  key={partido.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                  }}>
                    #{partido.match_number} · {partido.round}
                  </p>

                  {/* Equipo local */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}>
                    <span style={{
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      flex: 1,
                      fontWeight: '600',
                    }}>
                      {partido.home_team}
                    </span>
                    {editandoEquipo === `${partido.id}-home` ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flex: 2 }}>
                        <input
                          type="text"
                          placeholder="Nuevo nombre..."
                          value={nuevoNombre}
                          onChange={e => setNuevoNombre(e.target.value)}
                          style={{
                            flex: 1,
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleActualizarEquipo(partido, 'home')}
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          ✅
                        </button>
                        <button
                          onClick={() => setEditandoEquipo(null)}
                          style={{
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditandoEquipo(`${partido.id}-home`)
                          setNuevoNombre(partido.home_team)
                        }}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.5rem',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Editar
                      </button>
                    )}
                  </div>

                  {/* Equipo visitante */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}>
                    <span style={{
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      flex: 1,
                      fontWeight: '600',
                    }}>
                      {partido.away_team}
                    </span>
                    {editandoEquipo === `${partido.id}-away` ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flex: 2 }}>
                        <input
                          type="text"
                          placeholder="Nuevo nombre..."
                          value={nuevoNombre}
                          onChange={e => setNuevoNombre(e.target.value)}
                          style={{
                            flex: 1,
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleActualizarEquipo(partido, 'away')}
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          ✅
                        </button>
                        <button
                          onClick={() => setEditandoEquipo(null)}
                          style={{
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditandoEquipo(`${partido.id}-away`)
                          setNuevoNombre(partido.away_team)
                        }}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.5rem',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== TAB: MIEMBROS ========== */}
        {tab === 'miembros' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              textAlign: 'center',
            }}>
              {miembros.length} / 50 participantes
            </p>

            {miembros.map((miembro, index) => {
              const esAdmin = miembro.user_id === sala?.owner_id
              return (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      color: 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      minWidth: '24px',
                    }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <p style={{
                          color: 'var(--text-primary)',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                        }}>
                          {miembro.users?.username}
                        </p>
                        {esAdmin && (
                          <span style={{
                            fontSize: '0.7rem',
                            backgroundColor: 'var(--accent)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '0.25rem',
                            color: 'white',
                          }}>
                            admin
                          </span>
                        )}
                      </div>
                      <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                      }}>
                        {miembro.users?.display_name}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{
                      color: 'var(--accent)',
                      fontWeight: '700',
                      fontSize: '1.1rem',
                    }}>
                      {miembro.total_points} pts
                    </span>
                    {!esAdmin && (
                      <button
                        onClick={() => handleExpulsar(miembro)}
                        style={{
                          backgroundColor: '#7f1d1d',
                          color: 'white',
                          border: '1px solid #991b1b',
                          borderRadius: '0.5rem',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Expulsar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </main>
  )
}