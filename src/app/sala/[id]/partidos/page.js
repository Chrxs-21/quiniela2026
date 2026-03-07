'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function PartidosPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()

  const [grupos, setGrupos] = useState({})
  const [predicciones, setPredicciones] = useState({})
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null)
  const [modalPartido, setModalPartido] = useState(null)
  const [predHome, setPredHome] = useState(0)
  const [predAway, setPredAway] = useState(0)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    setCurrentUser(user)

    // Cargar partidos de grupos
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('phase', 'group')
      .order('match_number', { ascending: true })

    // Agrupar por grupo
    const grouped = {}
    matches?.forEach(match => {
      if (!grouped[match.group_name]) grouped[match.group_name] = []
      grouped[match.group_name].push(match)
    })
    setGrupos(grouped)

    // Cargar predicciones del usuario en esta sala
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('room_id', id)
      .eq('user_id', user.id)

    // Convertir a objeto por match_id para acceso rápido
    const predsMap = {}
    preds?.forEach(p => { predsMap[p.match_id] = p })
    setPredicciones(predsMap)

    setLoading(false)
  }

  useEffect(() => {
    async function init() { await loadData() }
    init()
  }, [id])

  function abrirModal(partido) {
    const pred = predicciones[partido.id]
    setPredHome(pred ? pred.pred_home_score : 0)
    setPredAway(pred ? pred.pred_away_score : 0)
    setModalPartido(partido)
  }

  async function handleGuardarPrediccion() {
    if (!modalPartido) return
    setGuardando(true)

    const existing = predicciones[modalPartido.id]

    if (existing) {
      // Actualizar predicción existente
      await supabase
        .from('predictions')
        .update({
          pred_home_score: predHome,
          pred_away_score: predAway,
        })
        .eq('id', existing.id)
    } else {
      // Crear nueva predicción
      await supabase
        .from('predictions')
        .insert({
          room_id: id,
          user_id: currentUser.id,
          match_id: modalPartido.id,
          pred_home_score: predHome,
          pred_away_score: predAway,
        })
    }

    await loadData()
    setGuardando(false)
    setModalPartido(null)
  }

  function getEstadoPartido(partido) {
    if (partido.status === 'finished') return 'finished'
    if (partido.status === 'locked') return 'locked'
    if (predicciones[partido.id]) return 'predicted'
    return 'pending'
  }

  function getEstadoColor(estado) {
    if (estado === 'finished') return '#4a3872'
    if (estado === 'locked') return '#4a3872'
    if (estado === 'predicted') return '#166534'
    return 'var(--border)'
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
        <p style={{ color: 'var(--text-secondary)' }}>Cargando partidos...</p>
      </main>
    )
  }

  const letrasGrupos = Object.keys(grupos).sort()

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
          onClick={() => {
            if (grupoSeleccionado) setGrupoSeleccionado(null)
            else router.push(`/sala/${id}`)
          }}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          ← {grupoSeleccionado ? 'Grupos' : 'Sala'}
        </button>
        <span style={{
          fontWeight: '700',
          color: 'var(--text-primary)',
          fontSize: '1rem',
        }}>
          {grupoSeleccionado ? `Grupo ${grupoSeleccionado}` : '⚽ Fase de Grupos'}
        </span>
        <div style={{ width: '60px' }} />
      </nav>

      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
      }}>

        {/* Vista: Cuadrícula de grupos */}
        {!grupoSeleccionado && (
          <div>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}>
              Selecciona un grupo para hacer tus predicciones
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}>
              {letrasGrupos.map(letra => {
                const partidos = grupos[letra]
                const totalPreds = partidos.filter(p => predicciones[p.id]).length
                const completo = totalPreds === 6

                return (
                  <div
                    key={letra}
                    onClick={() => setGrupoSeleccionado(letra)}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: `1px solid ${completo ? '#166534' : 'var(--border)'}`,
                      borderRadius: '1rem',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = completo ? '#166534' : 'var(--border)'}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}>
                      <span style={{
                        color: 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '1.1rem',
                      }}>
                        Grupo {letra}
                      </span>
                      {completo && (
                        <span style={{ fontSize: '1rem' }}>✅</span>
                      )}
                    </div>

                    {/* Equipos del grupo */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}>
                      {[...new Set(partidos.flatMap(p => [p.home_team, p.away_team]))].slice(0, 4).map(equipo => (
                        <span key={equipo} style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.8rem',
                        }}>
                          {equipo}
                        </span>
                      ))}
                    </div>

                    {/* Progreso de predicciones */}
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.25rem',
                      }}>
                        <span style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                        }}>
                          Predicciones
                        </span>
                        <span style={{
                          color: completo ? 'var(--success)' : 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                        }}>
                          {totalPreds}/6
                        </span>
                      </div>
                      <div style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '999px',
                        height: '4px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          backgroundColor: completo ? 'var(--success)' : 'var(--accent)',
                          width: `${(totalPreds / 6) * 100}%`,
                          height: '100%',
                          borderRadius: '999px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Vista: Partidos del grupo seleccionado */}
        {grupoSeleccionado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Jornadas */}
            {[1, 2, 3].map(jornada => {
              const partidosJornada = grupos[grupoSeleccionado]?.slice((jornada - 1) * 2, jornada * 2)
              return (
                <div key={jornada}>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.5rem',
                    marginTop: jornada > 1 ? '1rem' : '0',
                  }}>
                    Jornada {jornada}
                  </p>

                  {partidosJornada?.map(partido => {
                    const estado = getEstadoPartido(partido)
                    const pred = predicciones[partido.id]
                    const bloqueado = estado === 'locked' || estado === 'finished'

                    return (
                      <div
                        key={partido.id}
                        onClick={() => !bloqueado && abrirModal(partido)}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: `1px solid ${getEstadoColor(estado)}`,
                          borderRadius: '0.75rem',
                          padding: '1rem 1.25rem',
                          cursor: bloqueado ? 'default' : 'pointer',
                          marginBottom: '0.5rem',
                          transition: 'border-color 0.2s',
                        }}
                      >
                        {/* Equipos */}
                        <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        }}>
                        <span style={{
                            color: 'var(--text-primary)',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            flex: 1,
                        }}>
                            {partido.home_team}
                        </span>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            minWidth: '100px',
                            justifyContent: 'center',
                        }}>
                            {/* Número izquierdo */}
                            <span style={{
                            color: (estado === 'predicted' || estado === 'finished')
                                ? 'var(--text-primary)' : 'transparent',
                            fontWeight: '700',
                            fontSize: '1.5rem',
                            minWidth: '24px',
                            textAlign: 'center',
                            }}>
                            {estado === 'predicted' && pred?.pred_home_score}
                            {estado === 'finished' && (pred ? pred.pred_home_score : partido.home_score)}
                            </span>

                            <span style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            }}>
                            vs
                            </span>

                            {/* Número derecho */}
                            <span style={{
                            color: (estado === 'predicted' || estado === 'finished')
                                ? 'var(--text-primary)' : 'transparent',
                            fontWeight: '700',
                            fontSize: '1.5rem',
                            minWidth: '24px',
                            textAlign: 'center',
                            }}>
                            {estado === 'predicted' && pred?.pred_away_score}
                            {estado === 'finished' && (pred ? pred.pred_away_score : partido.away_score)}
                            </span>
                        </div>

                        <span style={{
                            color: 'var(--text-primary)',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            flex: 1,
                            textAlign: 'right',
                        }}>
                            {partido.away_team}
                        </span>
                        </div>

                        {/* Estado y predicción */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '0.5rem',
                        }}>
                          <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                          }}>
                            {new Date(partido.match_date).toLocaleDateString('es', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                            <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                            {estado === 'pending' && (
                                <span style={{ color: 'var(--accent)' }}>+ Predecir</span>
                            )}
                            {estado === 'locked' && (
                                <span style={{ color: 'var(--muted)' }}>🔒 Cerrado</span>
                            )}
                            {estado === 'predicted' && (
                                <span style={{ color: 'var(--success)' }}>✅ Predicción guardada</span>
                            )}
                            {estado === 'finished' && !pred && (
                                <span style={{ color: 'var(--text-secondary)' }}>Sin predicción</span>
                            )}
                            </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de predicción */}
      {modalPartido && (
        <div
          onClick={() => setModalPartido(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '1.5rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '360px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            {/* Título del partido */}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                marginBottom: '0.5rem',
              }}>
                Grupo {modalPartido.group_name} · {new Date(modalPartido.match_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </p>
              <p style={{
                color: 'var(--text-primary)',
                fontWeight: '700',
                fontSize: '1.1rem',
              }}>
                {modalPartido.home_team} vs {modalPartido.away_team}
              </p>
            </div>

            {/* Selector de goles */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.5rem',
            }}>

              {/* Equipo local */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <span style={{
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  maxWidth: '80px',
                }}>
                  {modalPartido.home_team}
                </span>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <button
                    onClick={() => setPredHome(v => Math.min(v + 1, 20))}
                    style={{
                      width: '40px', height: '40px',
                      backgroundColor: 'var(--accent)',
                      border: 'none', borderRadius: '0.5rem',
                      color: 'white', fontSize: '1.25rem',
                      cursor: 'pointer', fontWeight: '700',
                    }}
                  >+</button>
                  <span style={{
                    color: 'var(--text-primary)',
                    fontWeight: '700',
                    fontSize: '2.5rem',
                    minWidth: '48px',
                    textAlign: 'center',
                  }}>
                    {predHome}
                  </span>
                  <button
                    onClick={() => setPredHome(v => Math.max(v - 1, 0))}
                    style={{
                      width: '40px', height: '40px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      color: 'var(--text-primary)',
                      fontSize: '1.25rem',
                      cursor: 'pointer', fontWeight: '700',
                    }}
                  >-</button>
                </div>
              </div>

              <span style={{
                color: 'var(--text-secondary)',
                fontSize: '1.5rem',
                fontWeight: '700',
              }}>
                -
              </span>

              {/* Equipo visitante */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <span style={{
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  maxWidth: '80px',
                }}>
                  {modalPartido.away_team}
                </span>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <button
                    onClick={() => setPredAway(v => Math.min(v + 1, 20))}
                    style={{
                      width: '40px', height: '40px',
                      backgroundColor: 'var(--accent)',
                      border: 'none', borderRadius: '0.5rem',
                      color: 'white', fontSize: '1.25rem',
                      cursor: 'pointer', fontWeight: '700',
                    }}
                  >+</button>
                  <span style={{
                    color: 'var(--text-primary)',
                    fontWeight: '700',
                    fontSize: '2.5rem',
                    minWidth: '48px',
                    textAlign: 'center',
                  }}>
                    {predAway}
                  </span>
                  <button
                    onClick={() => setPredAway(v => Math.max(v - 1, 0))}
                    style={{
                      width: '40px', height: '40px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      color: 'var(--text-primary)',
                      fontSize: '1.25rem',
                      cursor: 'pointer', fontWeight: '700',
                    }}
                  >-</button>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleGuardarPrediccion}
                disabled={guardando}
                style={{
                  backgroundColor: guardando ? 'var(--border)' : 'var(--accent)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  padding: '0.875rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: guardando ? 'not-allowed' : 'pointer',
                }}
              >
                {guardando ? 'Guardando...' : '✅ Guardar Predicción'}
              </button>
              <button
                onClick={() => setModalPartido(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  padding: '0.875rem',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}