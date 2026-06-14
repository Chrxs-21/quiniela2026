'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { getBandera } from '@/lib/banderas'

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
  const [gruposExpandidos, setGruposExpandidos] = useState({})

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
      setGruposExpandidos({}) // Reset al cerrar
      return
    }

    setSelectedUser(miembro)
    setLoadingPreds(true)
    setGruposExpandidos({}) // Reset al cambiar de usuario

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('room_id', id)
      .eq('user_id', miembro.user_id)
      .order('created_at', { ascending: true })

    setPrediccionesRival(preds || [])
    setLoadingPreds(false)
  }

  function toggleGrupo(grupoNombre) {
    setGruposExpandidos(prev => ({
      ...prev,
      [grupoNombre]: !prev[grupoNombre]
    }))
  }

  useEffect(() => {
    async function init() { await loadData() }
    init()
  }, [id])

  // Helpers para procesar y agrupar las predicciones del panel inferior
  const predsPorGrupo = {}
  if (selectedUser && prediccionesRival.length > 0) {
    prediccionesRival.forEach(pred => {
      const partido = partidos[pred.match_id]
      if (!partido) return
      
      let grupoKey = 'Eliminatorias'
      let orden = 99
      if (partido.phase === 'group') {
         grupoKey = `Grupo ${partido.group_name}`
         orden = partido.group_name.charCodeAt(0)
      }

      if (!predsPorGrupo[grupoKey]) {
        predsPorGrupo[grupoKey] = {
          nombre: grupoKey,
          tipo: partido.phase === 'group' ? 'group' : 'knockout',
          partidos: [],
          equipos: new Set(),
          puntosObtenidos: 0,
          puntosMaximos: partido.phase === 'group' ? 30 : 0, // En grupos el max siempre es 30pts (6 partidos)
          orden
        }
      }
      
      predsPorGrupo[grupoKey].partidos.push({ pred, partido })
      if (partido.phase === 'group') {
        predsPorGrupo[grupoKey].equipos.add(partido.home_team)
        predsPorGrupo[grupoKey].equipos.add(partido.away_team)
      } else {
        // En eliminatorias sumamos el puntaje posible por cada partido disponible
        predsPorGrupo[grupoKey].puntosMaximos += 5
      }
      
      if (partido.status === 'finished') {
        predsPorGrupo[grupoKey].puntosObtenidos += (pred.points_earned || 0)
      }
    })
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando ranking...</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>

      {/* Navbar */}
      <nav style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => router.push(`/sala/${id}`)}
          style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}
        >
          ⬅️ Sala
        </button>
        <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '1rem' }}>🏆 Ranking</span>
        <div style={{ width: '60px' }} />
      </nav>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
          {sala?.name} • {ranking.length} participantes
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: index < 3 ? '1.5rem' : '1rem', fontWeight: '700', color: 'var(--text-secondary)', minWidth: '32px', textAlign: 'center' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                  </span>

                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)', flexShrink: 0 }}>
                    {miembro.users?.username?.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1rem' }}>{miembro.users?.username}</p>
                      {esYo && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', color: 'var(--text-primary)' }}>tú</span>}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{miembro.users?.display_name}</p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '1.5rem' }}>{miembro.total_points}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>pts</p>
                  </div>
                </div>

                {/* Estadísticas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { label: 'Exactas', value: miembro.stats.exactas, color: 'var(--success)' },
                    { label: 'Tendencia', value: miembro.stats.tendencias, color: 'var(--warning)' },
                    { label: 'Falladas', value: miembro.stats.falladas, color: '#f87171' },
                    { label: 'Total pred', value: miembro.stats.total, color: 'var(--text-secondary)' },
                  ].map(stat => (
                    <div key={stat.label} style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', padding: '0.5rem', textAlign: 'center' }}>
                      <p style={{ color: stat.color, fontWeight: '700', fontSize: '1.1rem' }}>{stat.value}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Barra de progreso */}
                {totalCalculados > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ height: '6px', borderRadius: '999px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', display: 'flex' }}>
                      <div style={{ width: `${(miembro.stats.exactas / totalCalculados) * 100}%`, backgroundColor: 'var(--success)' }} />
                      <div style={{ width: `${(miembro.stats.tendencias / totalCalculados) * 100}%`, backgroundColor: 'var(--warning)' }} />
                      <div style={{ width: `${(miembro.stats.falladas / totalCalculados) * 100}%`, backgroundColor: '#f87171' }} />
                    </div>
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {seleccionado ? '👀 Ocultar predicciones' : '👀 Ver predicciones'}
                  </span>
                </div>
              </div>

              {/* Panel de predicciones agrupado */}
              {seleccionado && (
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--accent)',
                  borderTop: 'none',
                  borderRadius: '0 0 1rem 1rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  {loadingPreds ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>Cargando predicciones...</p>
                  ) : prediccionesRival.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No ha hecho predicciones aún</p>
                  ) : (
                    Object.values(predsPorGrupo)
                      .sort((a, b) => a.orden - b.orden)
                      .map(grupo => {
                        const isExpanded = gruposExpandidos[grupo.nombre]
                        const equiposArray = Array.from(grupo.equipos)

                        return (
                          <div key={grupo.nombre} style={{ backgroundColor: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            {/* Cabecera del Grupo */}
                            <div 
                              onClick={() => toggleGrupo(grupo.nombre)}
                              style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', backgroundColor: 'var(--bg-secondary)', transition: 'background-color 0.2s' }}
                              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(124, 92, 191, 0.1)'}
                              onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                            >
                              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>
                                  {grupo.nombre}
                                </span>
                                {grupo.tipo === 'group' && equiposArray.length > 0 && (
                                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                                    {equiposArray.map(equipo => (
                                      <span key={equipo} title={equipo} style={{ fontSize: '1.2rem', display: 'inline-block' }}>
                                        {getBandera(equipo)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {grupo.puntosObtenidos} / {grupo.puntosMaximos} pts
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', width: '16px', textAlign: 'center' }}>
                                  {isExpanded ? '🔼' : '🔽'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Lista de partidos (solo si está expandido) */}
                            {isExpanded && (
                              <div style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                {grupo.partidos.map(({ pred, partido }) => (
                                  <div
                                    key={pred.id}
                                    style={{
                                      backgroundColor: 'var(--bg-card)',
                                      borderRadius: '0.5rem',
                                      padding: '0.75rem 1rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      borderLeft: partido.status === 'finished' ? 
                                        (pred.points_earned === 5 ? '4px solid var(--success)' : 
                                         pred.points_earned >= 2 ? '4px solid var(--warning)' : 
                                         '4px solid #f87171') : 'none'
                                    }}
                                  >
                                    <div style={{ flex: 1 }}>
                                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginBottom: '0.2rem' }}>
                                        {partido.phase === 'group' ? `Grupo ${partido.group_name} • ` : ''}
                                        {partido.round}
                                      </p>
                                      <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ fontSize: '1rem' }}>{getBandera(partido.home_team)}</span>
                                        {partido.home_team}
                                        <span style={{ color: 'var(--text-secondary)', margin: '0 0.2rem' }}>vs</span>
                                        {partido.away_team}
                                        <span style={{ fontSize: '1rem' }}>{getBandera(partido.away_team)}</span>
                                      </p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                                      {partido.status === 'finished' ? (
                                        <>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border)', paddingRight: '1rem' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginBottom: '0.1rem' }}>Pred</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.1rem' }}>
                                              {pred.pred_home_score} - {pred.pred_away_score}
                                            </span>
                                          </div>
                                          
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginBottom: '0.1rem' }}>Real</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.1rem' }}>
                                              {partido.home_score} - {partido.away_score}
                                            </span>
                                          </div>

                                          {pred.points_earned !== null && (
                                            <span style={{
                                              backgroundColor: pred.points_earned === 5 ? '#166534' : pred.points_earned >= 2 ? '#854d0e' : '#7f1d1d',
                                              color: 'white',
                                              fontSize: '0.75rem',
                                              fontWeight: '700',
                                              padding: '0.25rem 0.5rem',
                                              borderRadius: '0.4rem',
                                              minWidth: '50px',
                                              textAlign: 'center',
                                              marginLeft: '0.5rem'
                                            }}>
                                              +{pred.points_earned}pts
                                            </span>
                                          )}
                                        </>
                                      ) : partido.status === 'locked' ? (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                          🔒 Se revela pronto
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                          💬 Esperando resultado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
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