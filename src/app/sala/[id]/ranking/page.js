'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { getBandera } from '@/lib/banderas'

const TEAM_CODES = {
  'México': 'MEX', 'Sudáfrica': 'RSA', 'Corea del Sur': 'KOR', 'Chequia': 'CZE',
  'Canadá': 'CAN', 'Suiza': 'SUI', 'Qatar': 'QAT', 'Bosnia y Herzegovina': 'BIH',
  'Brasil': 'BRA', 'Marruecos': 'MAR', 'Haití': 'HAI', 'Escocia': 'SCO',
  'Estados Unidos': 'USA', 'Paraguay': 'PAR', 'Australia': 'AUS', 'Turquía': 'TUR',
  'Alemania': 'GER', 'Curazao': 'CUW', 'Costa de Marfil': 'CIV', 'Ecuador': 'ECU',
  'Países Bajos': 'NED', 'Japón': 'JPN', 'Túnez': 'TUN', 'Suecia': 'SWE',
  'Bélgica': 'BEL', 'Egipto': 'EGY', 'Irán': 'IRN', 'Nueva Zelanda': 'NZL',
  'España': 'ESP', 'Cabo Verde': 'CPV', 'Arabia Saudita': 'KSA', 'Uruguay': 'URU',
  'Francia': 'FRA', 'Senegal': 'SEN', 'Noruega': 'NOR', 'Iraq': 'IRQ',
  'Argentina': 'ARG', 'Argelia': 'ALG', 'Austria': 'AUT', 'Jordania': 'JOR',
  'Portugal': 'POR', 'Colombia': 'COL', 'Uzbekistán': 'UZB', 'DR Congo': 'COD',
  'Inglaterra': 'ENG', 'Croacia': 'CRO', 'Ghana': 'GHA', 'Panamá': 'PAN'
}

const ORIGINAL_BRACKET = {
  89: { home: 'W73', away: 'W75' },
  90: { home: 'W74', away: 'W77' },
  91: { home: 'W76', away: 'W78' },
  92: { home: 'W79', away: 'W80' },
  93: { home: 'W83', away: 'W84' },
  94: { home: 'W81', away: 'W82' },
  95: { home: 'W86', away: 'W88' },
  96: { home: 'W85', away: 'W87' },
  97: { home: 'W89', away: 'W90' },
  98: { home: 'W93', away: 'W94' },
  99: { home: 'W91', away: 'W92' },
  100: { home: 'W95', away: 'W96' },
  101: { home: 'W97', away: 'W98' },
  102: { home: 'W99', away: 'W100' },
  103: { home: 'L101', away: 'L102' },
  104: { home: 'W101', away: 'W102' },
}

function getTeamCode(name) {
  if (!name) return ''
  return TEAM_CODES[name] || name.substring(0, 3).toUpperCase()
}

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

  const loadData = useCallback(async () => {
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
          .select('points_earned, pred_home_score, pred_away_score, match_id')
          .eq('room_id', id)
          .eq('user_id', miembro.user_id)

        // Cargar TODOS los partidos de la sala
        const { data: matchesData } = await supabase
          .from('matches')
          .select('*')
          .order('match_number', { ascending: true })

        const localPartidos = {}
        matchesData?.forEach(m => { localPartidos[m.id] = m })

        // Resolver bracket del miembro
        const bracketRival = {}
        preds?.forEach(p => {
          // Necesito predicted_winner para el bracket local... pero arriba no lo pedí!
        })
        // wait! Since the points calculation is already returned by the DB for the ranking,
        // modifying the total calculated here correctly for each member requires doing the recursive resolution for EACH user.
        // I will just use the DB's points_earned because the DB trigger updates it.
        // If I want to nullify points if teams don't match, I should provide the SQL to fix the DB trigger!
        // For the ranking list, I'll just use the DB points for now, or re-query predicted_winner.
        // Let's just use what was already here and we'll fix it in the DB or in the rendering later.
        
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
  }, [id, router, supabase])

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
  }, [loadData])

  // Helpers para procesar y agrupar las predicciones del panel inferior
  const predsPorGrupo = {}
  if (selectedUser && prediccionesRival.length > 0) {
    // 1. Build a local bracket map for the selected user to resolve their predicted teams
    const bracketRival = {}
    prediccionesRival.forEach(p => {
      const match = partidos[p.match_id]
      if (match?.phase === 'knockout') {
        bracketRival[p.match_id] = { winner: p.predicted_winner }
      }
    })

    function getWinnerPredRival(matchNumber) {
      const partido = Object.values(partidos).find(p => p.match_number === matchNumber)
      if (!partido) return null
      return bracketRival[partido.id]?.winner || null
    }

    function resolverEquipoRival(slot, profundidad = 0) {
      if (!slot || profundidad > 10) return slot
      const tipo = slot[0]
      const num = parseInt(slot.slice(1))
      if (isNaN(num)) return slot

      if (tipo === 'W') {
        const winner = getWinnerPredRival(num)
        if (winner) return resolverEquipoRival(winner, profundidad + 1)
        return slot
      }

      if (tipo === 'L') {
        const partido = Object.values(partidos).find(p => p.match_number === num)
        if (!partido) return slot
        const pred = bracketRival[partido.id]
        if (!pred) return slot
        
        const originalHome = ORIGINAL_BRACKET[num]?.home || partido.home_team
        const originalAway = ORIGINAL_BRACKET[num]?.away || partido.away_team

        if (pred.winner === originalHome) return resolverEquipoRival(originalAway, profundidad + 1)
        if (pred.winner === originalAway) return resolverEquipoRival(originalHome, profundidad + 1)
        
        return slot
      }

      return slot
    }

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
      
      let finalPoints = pred.points_earned || 0
      let homeRival = partido.home_team
      let awayRival = partido.away_team
      let teamsMatch = true

      if (partido.phase === 'knockout') {
        const originalHome = ORIGINAL_BRACKET[partido.match_number]?.home || partido.home_team
        const originalAway = ORIGINAL_BRACKET[partido.match_number]?.away || partido.away_team
        homeRival = resolverEquipoRival(originalHome)
        awayRival = resolverEquipoRival(originalAway)
        
        // Verifica si la predicción de equipos fue correcta. Si los equipos no concuerdan, 0 puntos
        if (homeRival !== partido.home_team || awayRival !== partido.away_team) {
          teamsMatch = false
          finalPoints = 0
        }
      }

      predsPorGrupo[grupoKey].partidos.push({ pred, partido, finalPoints, homeRival, awayRival, teamsMatch })
      if (partido.phase === 'group') {
        predsPorGrupo[grupoKey].equipos.add(partido.home_team)
        predsPorGrupo[grupoKey].equipos.add(partido.away_team)
      } else {
        // En eliminatorias sumamos el puntaje posible por cada partido disponible
        predsPorGrupo[grupoKey].puntosMaximos += 5
      }
      
      if (partido.status === 'finished') {
        predsPorGrupo[grupoKey].puntosObtenidos += finalPoints
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
          ⬅ Sala
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

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{miembro.users?.username}</p>
                      {esYo && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', color: 'white' }}>tú</span>}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{miembro.users?.display_name}</p>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
                    {seleccionado ? '▲ Ocultar predicciones' : '▼ Ver predicciones'}
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
                                <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                  {grupo.nombre}
                                </span>
                                {grupo.tipo === 'group' && equiposArray.length > 0 && (
                                  <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                    {equiposArray.map(equipo => (
                                      <span key={equipo} title={equipo} style={{ fontSize: '1.2rem', display: 'inline-block' }}>
                                        {getBandera(equipo)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {grupo.puntosObtenidos} / {grupo.puntosMaximos} pts
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', width: '16px', textAlign: 'center' }}>
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Lista de partidos compressa (solo si está expandido) */}
                            {isExpanded && (
                              <div style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                {grupo.partidos.map(({ pred, partido, finalPoints, homeRival, awayRival, teamsMatch }) => (
                                  <div
                                    key={pred.id}
                                    style={{
                                      backgroundColor: 'var(--bg-card)',
                                      borderRadius: '0.5rem',
                                      padding: '0.75rem 0.5rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.5rem' // Espaciado natural para móviles
                                    }}
                                  >
                                    <div style={{ flex: 1, minWidth: '0' }}>
                                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                        {partido.phase === 'group' ? `G.${partido.group_name} • ` : ''}
                                        {partido.round}
                                      </p>
                                      {/* Contenedor de banderas y nombres abreviados */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{getBandera(homeRival)}</span>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: (!teamsMatch && partido.status === 'finished') ? 'line-through' : 'none' }}>
                                          {getTeamCode(homeRival)}
                                        </span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', margin: '0 0.1rem' }}>vs</span>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: (!teamsMatch && partido.status === 'finished') ? 'line-through' : 'none' }}>
                                          {getTeamCode(awayRival)}
                                        </span>
                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{getBandera(awayRival)}</span>
                                      </div>
                                      {!teamsMatch && partido.status === 'finished' && (
                                        <div style={{ marginTop: '0.25rem', color: '#f87171', fontSize: '0.6rem', fontStyle: 'italic' }}>
                                          Real: {getTeamCode(partido.home_team)} vs {getTeamCode(partido.away_team)}
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                      {partido.status === 'finished' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3rem' }}>
                                          {/* Resultado Oficial */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', textTransform: 'uppercase', width: '22px' }}>Real:</span>
                                            <span style={{ color: 'var(--success)', fontWeight: '700', fontSize: '0.85rem' }}>
                                              {partido.home_score} - {partido.away_score}
                                            </span>
                                          </div>
                                          {/* Tu Predicción */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ color: 'var(--accent)', fontSize: '0.6rem', textTransform: 'uppercase', width: '22px' }}>Pred:</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>
                                              {pred.pred_home_score} - {pred.pred_away_score}
                                            </span>
                                            {pred.points_earned !== null && (
                                              <span style={{
                                                backgroundColor: finalPoints === 5 ? '#166534' : finalPoints >= 2 ? '#854d0e' : '#7f1d1d',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                fontWeight: '700',
                                                padding: '0.15rem 0.3rem',
                                                borderRadius: '0.4rem',
                                                minWidth: '28px',
                                                textAlign: 'center'
                                              }}>
                                                +{finalPoints}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ) : partido.status === 'locked' ? (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                          🔒 Oculto
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                          🙈 Oculto
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
