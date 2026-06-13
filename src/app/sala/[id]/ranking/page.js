'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { getBandera } from '@/lib/banderas' // <-- Necesitamos importar las banderas

export default function RankingPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()

  const [ranking, setRanking] = useState([])
  const [sala, setSala] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [prediccionesRival, setPrediccionesRival] = useState([])
  const [partidos, setPartidos] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingPreds, setLoadingPreds] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({}) // <-- Estado para controlar los acordeones de grupos

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    setCurrentUser(user)

    // Cargar sala
    const { data: salaData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setSala(salaData)

    // Cargar miembros con estadísticas
    const { data: miembros } = await supabase
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

    // Para cada miembro calcular estadísticas
    const rankingConStats = await Promise.all(
      miembros.map(async (miembro) => {
        const { data: preds } = await supabase
          .from('predictions')
          .select('points_earned, pred_home_score, pred_away_score')
          .eq('room_id', id)
          .eq('user_id', miembro.user_id)

        const total = preds?.length || 0
        const exactas = preds?.filter(p => p.points_earned === 5).length || 0
        const tendencias = preds?.filter(p => p.points_earned === 2 || p.points_earned === 3).length || 0
        const falladas = preds?.filter(p => p.points_earned === 0).length || 0
        const sinCalc = preds?.filter(p => p.points_earned === null).length || 0

        return {
          ...miembro,
          stats: { total, exactas, tendencias, falladas, sinCalc }
        }
      })
    )

    setRanking(rankingConStats)

    // Cargar partidos para el panel de predicciones
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .order('match_number', { ascending: true })

    const matchesMap = {}
    matchesData?.forEach(m => { matchesMap[m.id] = m })
    setPartidos(matchesMap)

    setLoading(false)
  }

  async function verPredicciones(miembro) {
    if (selectedUser?.user_id === miembro.user_id) {
      setSelectedUser(null)
      setPrediccionesRival([])
      setExpandedGroups({}) // Reseteamos los acordeones si se cierra
      return
    }

    setSelectedUser(miembro)
    setExpandedGroups({}) // Ocultamos los acordeones al abrir un nuevo usuario
    setLoadingPreds(true)

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('room_id', id)
      .eq('user_id', miembro.user_id)
      .order('created_at', { ascending: true })

    setPrediccionesRival(preds || [])
    setLoadingPreds(false)
  }

  // Función para abrir/cerrar un grupo en el acordeón
  function toggleGroup(groupName) {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))
  }

  useEffect(() => {
    async function init() { await loadData() }
    init()
  }, [id])

  if (loading) {
    return (
      <main style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando ranking...</p>
      </main>
    )
  }

  // Tarjeta individual para mostrar el resultado de la predicción 
  function PredictionCard({ pred, partido }) {
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ flex: 1 }}>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.7rem',
            marginBottom: '0.2rem',
          }}>
            {partido.phase === 'group' ? `Grupo ${partido.group_name} · ` : ''}
            {partido.round}
          </p>
          <p style={{
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <span>{getBandera(partido.home_team)}</span> {partido.home_team} 
            <span style={{ color: 'var(--text-secondary)', fontWeight: '400' }}>vs</span> 
            {partido.away_team} <span>{getBandera(partido.away_team)}</span>
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          {partido.status === 'finished' ? (
            <>
              <span style={{
                color: 'var(--text-primary)',
                fontWeight: '700',
                fontSize: '1.1rem',
              }}>
                {pred.pred_home_score} - {pred.pred_away_score}
              </span>
              {pred.points_earned !== null && (
                <span style={{
                  backgroundColor:
                    pred.points_earned === 5 ? '#166534' :
                    pred.points_earned >= 2 ? '#854d0e' :
                    '#7f1d1d',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.4rem',
                }}>
                  +{pred.points_earned}pts
                </span>
              )}
            </>
          ) : partido.status === 'locked' ? (
            <span style={{
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontStyle: 'italic',
            }}>
              🔒 Se revela al terminar
            </span>
          ) : (
            <span style={{
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontStyle: 'italic',
            }}>
              🕒 Se revela al terminar
            </span>
          )}
        </div>
      </div>
    )
  }

  // Sistema que procesa, agrupa y renderiza los acordeones dinámicamente
  function renderPrediccionesAgrupadas() {
    const agrupadas = { Grupos: {}, Eliminatorias: {} }
    const equiposPorGrupo = {}

    prediccionesRival.forEach(pred => {
      const partido = partidos[pred.match_id]
      if (!partido) return

      if (partido.phase === 'group') {
        const gName = `Grupo ${partido.group_name}`
        if (!agrupadas.Grupos[gName]) agrupadas.Grupos[gName] = []
        agrupadas.Grupos[gName].push({ pred, partido })

        // Recolectamos los equipos para sacar luego sus banderas
        if (!equiposPorGrupo[gName]) equiposPorGrupo[gName] = new Set()
        equiposPorGrupo[gName].add(partido.home_team)
        equiposPorGrupo[gName].add(partido.away_team)
      } else {
        const rName = partido.round
        if (!agrupadas.Eliminatorias[rName]) agrupadas.Eliminatorias[rName] = []
        agrupadas.Eliminatorias[rName].push({ pred, partido })
      }
    })

    const gruposKeys = Object.keys(agrupadas.Grupos).sort()
    const elimKeys = Object.keys(agrupadas.Eliminatorias)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* Renderizado de los Grupos */}
        {gruposKeys.map(groupName => {
          const isOpen = expandedGroups[groupName]
          const equiposSet = equiposPorGrupo[groupName]
          // Obtenemos solo array de 4 banderas
          const banderas = Array.from(equiposSet).slice(0, 4).map(team => getBandera(team)).join(' ')

          return (
            <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => toggleGroup(groupName)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: isOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' }}>
                      {groupName}
                    </span>
                    <span style={{ fontSize: '1.1rem', letterSpacing: '0.2rem' }}>{banderas}</span>
                 </div>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                   {isOpen ? '▲ Ocultar' : '▼ Ver'}
                 </span>
              </button>
              
              {isOpen && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.5rem', 
                  padding: '0 0.25rem 0.5rem 0.25rem' 
                }}>
                  {agrupadas.Grupos[groupName].sort((a,b) => a.partido.match_number - b.partido.match_number).map(({ pred, partido }) => (
                    <PredictionCard key={pred.id} pred={pred} partido={partido} />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Renderizado de las Eliminatorias */}
        {elimKeys.map(roundName => {
          const isOpen = expandedGroups[roundName]
          return (
            <div key={roundName} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => toggleGroup(roundName)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: isOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' }}>
                      Eliminatorias - {roundName}
                    </span>
                 </div>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                   {isOpen ? '▲ Ocultar' : '▼ Ver'}
                 </span>
              </button>
              
              {isOpen && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.5rem', 
                  padding: '0 0.25rem 0.5rem 0.25rem' 
                }}>
                  {agrupadas.Eliminatorias[roundName].sort((a,b) => a.partido.match_number - b.partido.match_number).map(({ pred, partido }) => (
                    <PredictionCard key={pred.id} pred={pred} partido={partido} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
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
          🏆 Ranking
        </span>
        <div style={{ width: '60px' }} />
      </nav>

      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>

        {/* Título sala */}
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}>
          {sala?.name} · {ranking.length} participantes
        </p>

        {/* Lista de ranking */}
        {ranking.map((miembro, index) => {
          const esYo = miembro.user_id === currentUser?.id
          const seleccionado = selectedUser?.user_id === miembro.user_id
          const totalCalculados = miembro.stats.exactas + miembro.stats.tendencias + miembro.stats.falladas

          return (
            <div key={miembro.id}>
              {/* Card del jugador */}
              <div
                onClick={() => verPredicciones(miembro)}
                style={{
                  backgroundColor: esYo ? '#2d1f5e' : 'var(--bg-card)',
                  border: `1px solid ${seleccionado ? 'var(--accent)' : esYo ? '#5b3fa6' : 'var(--border)'}`,
                  borderRadius: seleccionado ? '1rem 1rem 0 0' : '1rem',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {/* Fila principal */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1rem',
                }}>
                  {/* Posición */}
                  <span style={{
                    fontSize: index < 3 ? '1.5rem' : '1rem',
                    fontWeight: '700',
                    color: 'var(--text-secondary)',
                    minWidth: '32px',
                    textAlign: 'center',
                  }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                  </span>

                  {/* Avatar inicial */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '1rem',
                    color: 'white',
                    flexShrink: 0,
                  }}>
                    {miembro.users?.username?.charAt(0).toUpperCase()}
                  </div>

                  {/* Nombre */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <p style={{
                        color: 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '1rem',
                      }}>
                        {miembro.users?.username}
                      </p>
                      {esYo && (
                        <span style={{
                          fontSize: '0.7rem',
                          backgroundColor: 'var(--accent)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.25rem',
                          color: 'white',
                        }}>
                          tú
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

                  {/* Puntos */}
                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      color: 'var(--accent)',
                      fontWeight: '700',
                      fontSize: '1.5rem',
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
                </div>

                {/* Estadísticas */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  gap: '0.5rem',
                }}>
                  {[
                    { label: 'Exactas', value: miembro.stats.exactas, color: 'var(--success)' },
                    { label: 'Tendencia', value: miembro.stats.tendencias, color: 'var(--warning)' },
                    { label: 'Falladas', value: miembro.stats.falladas, color: '#f87171' },
                    { label: 'Total pred', value: miembro.stats.total, color: 'var(--text-secondary)' },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '0.5rem',
                        padding: '0.5rem',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{
                        color: stat.color,
                        fontWeight: '700',
                        fontSize: '1.1rem',
                      }}>
                        {stat.value}
                      </p>
                      <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.65rem',
                      }}>
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Barra de progreso */}
                {totalCalculados > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{
                      height: '6px',
                      borderRadius: '999px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                    }}>
                      <div style={{
                        width: `${(miembro.stats.exactas / totalCalculados) * 100}%`,
                        backgroundColor: 'var(--success)',
                      }} />
                      <div style={{
                        width: `${(miembro.stats.tendencias / totalCalculados) * 100}%`,
                        backgroundColor: 'var(--warning)',
                      }} />
                      <div style={{
                        width: `${(miembro.stats.falladas / totalCalculados) * 100}%`,
                        backgroundColor: '#f87171',
                      }} />
                    </div>
                  </div>
                )}

                {/* Indicador expandible */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '0.75rem',
                }}>
                  <span style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                  }}>
                    {seleccionado ? '▲ Ocultar predicciones' : '▼ Ver predicciones'}
                  </span>
                </div>
              </div>

              {/* Panel de predicciones expandible MODIFICADO AQUÍ */}
              {seleccionado && (
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--accent)',
                  borderTop: 'none',
                  borderRadius: '0 0 1rem 1rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}>
                  {loadingPreds ? (
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      padding: '1rem',
                    }}>
                      Cargando predicciones...
                    </p>
                  ) : prediccionesRival.length === 0 ? (
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      padding: '1rem',
                    }}>
                      No ha hecho predicciones aún
                    </p>
                  ) : (
                    renderPrediccionesAgrupadas()
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}