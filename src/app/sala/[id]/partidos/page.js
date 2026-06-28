'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { getBandera } from '@/lib/banderas'

const RONDAS_ORDER = ['R32', 'R16', 'QF', 'SF', '3rd', 'final']
const RONDAS_LABEL = {
  'R32': '16vos de Final',
  'R16': '8vos de Final',
  'QF': 'Cuartos de Final',
  'SF': 'Semifinales',
  '3rd': 'Tercer Lugar',
  'final': 'Final',
}

export default function PartidosPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()

  const [tab, setTab] = useState('groups')
  const [grupos, setGrupos] = useState({})
  const [knockout, setKnockout] = useState({})
  const [predicciones, setPredicciones] = useState({})
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null)
  const [modalPartido, setModalPartido] = useState(null)
  const [predHome, setPredHome] = useState(0)
  const [predAway, setPredAway] = useState(0)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [sala, setSala] = useState(null)
  const [knockoutUnlocked, setKnockoutUnlocked] = useState(false)
  const [modalPuntosGrupos, setModalPuntosGrupos] = useState(false)
  const [modalPuntosKnockout, setModalPuntosKnockout] = useState(false)
  const [bracketPreds, setBracketPreds] = useState({})
  const [modalKnockout, setModalKnockout] = useState(null)
  const [predHomeK, setPredHomeK] = useState(0)
  const [predAwayK, setPredAwayK] = useState(0)
  const [ganadorManual, setGanadorManual] = useState(null)
  const [guardandoKnockout, setGuardandoKnockout] = useState(false)

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    setCurrentUser(user)

    const { data: salaData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setSala(salaData)

    const fechaDesbloqueo = new Date('2026-07-02')
    const hoy = new Date()
    const unlocked = salaData?.knockout_unlocked || hoy >= fechaDesbloqueo
    setKnockoutUnlocked(unlocked)

    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .order('match_number', { ascending: true })

    const grouped = {}
    const knockoutByRound = {}

    matches?.forEach(match => {
      if (match.phase === 'group') {
        if (!grouped[match.group_name]) grouped[match.group_name] = []
        grouped[match.group_name].push(match)
      } else {
        if (!knockoutByRound[match.round]) knockoutByRound[match.round] = []
        knockoutByRound[match.round].push(match)
      }
    })

    const roundsDesc = ['final', 'SF', 'QF', 'R16', 'R32']
    for (let i = 0; i < roundsDesc.length - 1; i++) {
      const currentRound = roundsDesc[i]
      const prevRound = roundsDesc[i + 1]
      
      if (knockoutByRound[currentRound] && knockoutByRound[prevRound]) {
        const expectedOrder = []
        knockoutByRound[currentRound].forEach(match => {
          if (match.home_team?.startsWith('W')) {
            expectedOrder.push(parseInt(match.home_team.substring(1)))
          }
          if (match.away_team?.startsWith('W')) {
            expectedOrder.push(parseInt(match.away_team.substring(1)))
          }
        })
        
        if (expectedOrder.length > 0) {
          knockoutByRound[prevRound].sort((a, b) => {
            const idxA = expectedOrder.indexOf(a.match_number)
            const idxB = expectedOrder.indexOf(b.match_number)
            if (idxA !== -1 && idxB !== -1) return idxA - idxB
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
            return a.match_number - b.match_number
          })
        }
      }
    }

    setGrupos(grouped)
    setKnockout(knockoutByRound)

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('room_id', id)
      .eq('user_id', user.id)

    const predsMap = {}
    preds?.forEach(p => { predsMap[p.match_id] = p })
    setPredicciones(predsMap)

    const bracketMap = {}
    preds?.filter(p => {
      const match = matches?.find(m => m.id === p.match_id)
      return match?.phase === 'knockout'
    }).forEach(p => {
      bracketMap[p.match_id] = {
        home: p.pred_home_score,
        away: p.pred_away_score,
        winner: p.predicted_winner,
      }
    })
    setBracketPreds(bracketMap)
    setLoading(false)
  }

  useEffect(() => {
    async function init() { await loadData() }
    init()
  }, [id])

  useEffect(() => {
    const timer = setTimeout(() => {
      const vioGrupos = localStorage.getItem('vio_puntos_grupos')
      const vioKnockout = localStorage.getItem('vio_puntos_knockout')
      if (!vioGrupos && tab === 'groups') {
        setModalPuntosGrupos(true)
        localStorage.setItem('vio_puntos_grupos', 'true')
      }
      if (!vioKnockout && tab === 'knockout') {
        setModalPuntosKnockout(true)
        localStorage.setItem('vio_puntos_knockout', 'true')
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [tab])

  function abrirModal(partido) {
    if (!knockoutUnlocked && partido.phase === 'knockout') return
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
      await supabase
        .from('predictions')
        .update({ pred_home_score: predHome, pred_away_score: predAway })
        .eq('id', existing.id)
    } else {
      await supabase.from('predictions').insert({
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

  function getWinnerPred(matchNumber) {
    const partido = Object.values(knockout).flat().find(p => p.match_number === matchNumber)
    if (!partido) return null
    const pred = bracketPreds[partido.id]
    if (!pred) return null
    return pred.winner
  }

  function resolverEquipo(slot, profundidad = 0) {
    if (!slot || profundidad > 10) return slot
    const tipo = slot[0]
    const num = parseInt(slot.slice(1))
    if (isNaN(num)) return slot

    if (tipo === 'W') {
      const winner = getWinnerPred(num)
      if (winner) return resolverEquipo(winner, profundidad + 1)
      return slot
    }

    if (tipo === 'L') {
      const partido = Object.values(knockout).flat().find(p => p.match_number === num)
      if (!partido) return slot
      const pred = bracketPreds[partido.id]
      if (!pred) return slot
      const homeResuelto = resolverEquipo(partido.home_team, profundidad + 1)
      const awayResuelto = resolverEquipo(partido.away_team, profundidad + 1)
      if (pred.winner === homeResuelto) return awayResuelto
      if (pred.winner === awayResuelto) return homeResuelto
      return slot
    }

    return slot
  }

  function abrirModalKnockout(partido) {
    if (!knockoutUnlocked) return
    if (partido.status === 'locked' || partido.status === 'finished') return

    const homeResuelto = resolverEquipo(partido.home_team)
    const awayResuelto = resolverEquipo(partido.away_team)
    const homeEsSlot = homeResuelto.startsWith('W') || homeResuelto.startsWith('L')
    const awayEsSlot = awayResuelto.startsWith('W') || awayResuelto.startsWith('L')

    if (homeEsSlot || awayEsSlot) return

    const pred = bracketPreds[partido.id]
    setPredHomeK(pred?.home ?? 0)
    setPredAwayK(pred?.away ?? 0)
    setGanadorManual(pred?.winner ?? null)
    setModalKnockout(partido)
  }

  function calcularGanadorAuto(home, away, homeTeam, awayTeam) {
    if (home > away) return homeTeam
    if (away > home) return awayTeam
    return null
  }

  function limpiarCascada(matchNumber) {
    const allKnockout = Object.values(knockout).flat()
    const afectados = new Set()
    let porProcesar = [matchNumber]

    while (porProcesar.length > 0) {
      const actual = porProcesar.pop()
      const wSlot = `W${actual}`
      const lSlot = `L${actual}`

      allKnockout.forEach(p => {
        if (p.home_team === wSlot || p.away_team === wSlot ||
            p.home_team === lSlot || p.away_team === lSlot) {
          if (!afectados.has(p.match_number)) {
            afectados.add(p.match_number)
            porProcesar.push(p.match_number)
          }
        }
      })
    }

    setBracketPreds(prev => {
      const nuevo = { ...prev }
      allKnockout.forEach(p => {
        if (afectados.has(p.match_number)) delete nuevo[p.id]
      })
      return nuevo
    })
  }

  async function handleGuardarKnockout() {
    if (!modalKnockout) return
    const ganador = ganadorManual || calcularGanadorAuto(predHomeK, predAwayK, modalKnockout.home_team, modalKnockout.away_team)
    if (predHomeK === predAwayK && !ganadorManual) return

    setGuardandoKnockout(true)

    const predAnterior = bracketPreds[modalKnockout.id]
    if (predAnterior && predAnterior.winner !== ganador) {
      limpiarCascada(modalKnockout.match_number)
    }

    setBracketPreds(prev => ({
      ...prev,
      [modalKnockout.id]: { home: predHomeK, away: predAwayK, winner: ganador },
    }))

    const existing = predicciones[modalKnockout.id]
    if (existing) {
      await supabase.from('predictions').update({
        pred_home_score: predHomeK,
        pred_away_score: predAwayK,
        predicted_winner: ganador,
      }).eq('id', existing.id)
    } else {
      await supabase.from('predictions').insert({
        room_id: id,
        user_id: currentUser.id,
        match_id: modalKnockout.id,
        pred_home_score: predHomeK,
        pred_away_score: predAwayK,
        predicted_winner: ganador,
      })
    }

    await loadData()
    setGuardandoKnockout(false)
    setModalKnockout(null)
    setGanadorManual(null)
  }

  function getEstadoPartido(partido) {
    if (partido.status === 'finished') return 'finished'
    if (partido.status === 'locked') return 'locked'
    if (partido.match_date && new Date(partido.match_date) <= new Date()) return 'locked'
    if (predicciones[partido.id]) return 'predicted'
    return 'pending'
  }

  function getEstadoColor(estado) {
    if (estado === 'finished') return '#4a3872'
    if (estado === 'locked') return '#4a3872'
    if (estado === 'predicted') return '#166534'
    return 'var(--border)'
  }

  function calcularTablaGrupo(letra) {
    const partidos = grupos[letra] || []
    const equipos = {}

    partidos.forEach(p => {
      if (!equipos[p.home_team]) equipos[p.home_team] = { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
      if (!equipos[p.away_team]) equipos[p.away_team] = { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
    })

    partidos.forEach(p => {
      const pred = predicciones[p.id]
      if (!pred) return

      const homeGoles = pred.pred_home_score
      const awayGoles = pred.pred_away_score

      equipos[p.home_team].pj++
      equipos[p.away_team].pj++
      equipos[p.home_team].gf += homeGoles
      equipos[p.home_team].gc += awayGoles
      equipos[p.away_team].gf += awayGoles
      equipos[p.away_team].gc += homeGoles

      if (homeGoles > awayGoles) {
        equipos[p.home_team].g++
        equipos[p.home_team].pts += 3
        equipos[p.away_team].p++
      } else if (awayGoles > homeGoles) {
        equipos[p.away_team].g++
        equipos[p.away_team].pts += 3
        equipos[p.home_team].p++
      } else {
        equipos[p.home_team].e++
        equipos[p.away_team].e++
        equipos[p.home_team].pts++
        equipos[p.away_team].pts++
      }
    })

    return Object.entries(equipos)
      .map(([nombre, stats]) => ({ nombre, ...stats, dg: stats.gf - stats.gc }))
      .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf)
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando partidos...</p>
      </main>
    )
  }

  const letrasGrupos = Object.keys(grupos).sort()

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>

      {/* Navbar */}
      <nav style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => { if (grupoSeleccionado) setGrupoSeleccionado(null); else router.push(`/sala/${id}`) }}
          style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}
        >
          ← {grupoSeleccionado ? 'Grupos' : 'Sala'}
        </button>
        <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '1rem' }}>⚽ Partidos</span>
        <div style={{ width: '60px' }} />
      </nav>

      {/* Tabs */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', justifyContent: 'center' }}>
        {[
          { key: 'groups', label: '🏟️ Fase de Grupos' },
          { key: 'knockout', label: '🏆 Eliminatorias' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setGrupoSeleccionado(null) }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '1rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: tab === t.key ? '700' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Botón sistema de puntos */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 1.5rem 0', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => tab === 'groups' ? setModalPuntosGrupos(true) : setModalPuntosKnockout(true)}
          style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          ℹ️ Ver sistema de puntos
        </button>
      </div>

      {/* =================== FASE DE GRUPOS =================== */}
      {tab === 'groups' && (
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

          {/* Grid de grupos */}
          {!grupoSeleccionado && (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Selecciona un grupo para hacer tus predicciones
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {letrasGrupos.map(letra => {
                  const partidos = grupos[letra]
                  const totalPreds = partidos.filter(p => predicciones[p.id]).length
                  const completo = totalPreds === 6

                  return (
                    <div
                      key={letra}
                      onClick={() => setGrupoSeleccionado(letra)}
                      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${completo ? '#166834' : 'var(--border)'}`, borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseOut={e => e.currentTarget.style.borderColor = completo ? '#166834' : 'var(--border)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.1rem' }}>Grupo {letra}</span>
                        {completo && <span>✓</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {[...new Set(partidos.flatMap(p => [p.home_team, p.away_team]))].slice(0, 4).map(equipo => (
                          <span key={equipo} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{equipo}</span>
                        ))}
                      </div>
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Predicciones</span>
                          <span style={{ color: completo ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600' }}>{totalPreds}/6</span>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ backgroundColor: completo ? 'var(--success)' : 'var(--accent)', width: `${(totalPreds / 6) * 100}%`, height: '100%', borderRadius: '999px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Vista de grupo seleccionado */}
          {grupoSeleccionado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* Tabla predicha del grupo */}
              {(() => {
                const tabla = calcularTablaGrupo(grupoSeleccionado)
                const hayPredicciones = tabla.some(e => e.pj > 0)
                if (!hayPredicciones) return null

                return (
                  <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem' }}>📊</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tu tabla predicha
                      </span>
                    </div>

                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 32px 32px 32px 32px 36px', padding: '0.4rem 1rem', borderBottom: '1px solid var(--border)' }}>
                      {['Equipo', 'PJ', 'G', 'E', 'P', 'DG', 'Pts'].map(h => (
                        <span key={h} style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: '700', textAlign: h === 'Equipo' ? 'left' : 'center' }}>{h}</span>
                      ))}
                    </div>

                    {/* Filas */}
                    {tabla.map((equipo, index) => (
                      <div
                        key={equipo.nombre}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 32px 32px 32px 32px 32px 36px', padding: '0.5rem 1rem', borderBottom: index < tabla.length - 1 ? '1px solid var(--border)' : 'none', backgroundColor: index < 2 ? 'rgba(124, 92, 191, 0.08)' : 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: index < 2 ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: '700', minWidth: '12px' }}>{index + 1}</span>
                          <span style={{ fontSize: '0.85rem' }}>{getBandera(equipo.nombre)}</span>
                          <span style={{ color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: index < 2 ? '700' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {equipo.nombre}
                          </span>
                        </div>
                        {[equipo.pj, equipo.g, equipo.e, equipo.p, equipo.dg].map((val, i) => (
                          <span key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textAlign: 'center' }}>{val}</span>
                        ))}
                        <span style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: '700', textAlign: 'center' }}>{equipo.pts}</span>
                      </div>
                    ))}

                    <div style={{ padding: '0.4rem 1rem', backgroundColor: 'var(--bg-secondary)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                        ℹ️ Los 2 primeros clasifican • DG = Diferencia de goles
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Jornadas */}
              {[1, 2, 3].map(jornada => {
                const todosPartidos = grupos[grupoSeleccionado] || []
                const ordenados = [...todosPartidos].sort((a, b) => a.match_number - b.match_number)
                const partidosJornada = ordenados.slice((jornada - 1) * 2, jornada * 2)

                return (
                  <div key={jornada}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', marginTop: jornada > 1 ? '1rem' : '0' }}>
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
                          style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${getEstadoColor(estado)}`, borderRadius: '0.75rem', padding: '1rem 1.25rem', cursor: bloqueado ? 'default' : 'pointer', marginBottom: '0.5rem' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem', flex: 1 }}>{partido.home_team}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '100px', justifyContent: 'center' }}>
                              <span style={{ color: (estado === 'predicted' || estado === 'finished') ? 'var(--text-primary)' : 'transparent', fontWeight: '700', fontSize: '1.5rem', minWidth: '24px', textAlign: 'center' }}>
                                {estado === 'predicted' && pred?.pred_home_score}
                                {estado === 'finished' && (pred ? pred.pred_home_score : partido.home_score)}
                              </span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>vs</span>
                              <span style={{ color: (estado === 'predicted' || estado === 'finished') ? 'var(--text-primary)' : 'transparent', fontWeight: '700', fontSize: '1.5rem', minWidth: '24px', textAlign: 'center' }}>
                                {estado === 'predicted' && pred?.pred_away_score}
                                {estado === 'finished' && (pred ? pred.pred_away_score : partido.away_score)}
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem', flex: 1, textAlign: 'right' }}>{partido.away_team}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {new Date(partido.match_date).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                              {estado === 'pending' && <span style={{ color: 'var(--accent)' }}>+ Predecir</span>}
                              {estado === 'locked' && <span style={{ color: 'var(--muted)' }}>🔒 Cerrado</span>}
                              {estado === 'predicted' && <span style={{ color: 'var(--success)' }}>✓ Guardado</span>}
                              {estado === 'finished' && pred && <span style={{ color: 'var(--text-secondary)' }}>{pred.points_earned ?? '0'} pts</span>}
                              {estado === 'finished' && !pred && <span style={{ color: 'var(--text-secondary)' }}>Sin pred</span>}
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
      )}

      {/* =================== ELIMINATORIAS =================== */}
      {tab === 'knockout' && (
        <div style={{ position: 'relative' }}>
          {!knockoutUnlocked && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 10, 30, 0.85)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', minHeight: '400px' }}>
              <span style={{ fontSize: '3rem' }}>🔒</span>
              <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.25rem', textAlign: 'center' }}>Eliminatorias bloqueadas</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', maxWidth: '300px' }}>
                Se desbloqueará cuando se confirmen los clasificados o el 2 de Julio 2026
              </p>
            </div>
          )}

          <div style={{ overflowX: 'auto', padding: '2rem 1.5rem', filter: knockoutUnlocked ? 'none' : 'blur(3px)' }}>
            <div style={{ display: 'flex', gap: '2.5rem', minWidth: 'max-content', alignItems: 'stretch', paddingBottom: '1rem' }}>
              {RONDAS_ORDER.map((ronda, rondaIndex) => {
                if (ronda === 'Third Place') return null;

                return (
                  <div key={ronda} style={{ display: 'flex', flexDirection: 'column', minWidth: '220px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '1.5rem' }}>
                      {RONDAS_LABEL[ronda]}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-around', gap: '1rem' }}>
                      {knockout[ronda]?.map(partido => {
                        const estado = getEstadoPartido(partido)
                        const predK = bracketPreds[partido.id]
                        const homeResuelto = resolverEquipo(partido.home_team)
                        const awayResuelto = resolverEquipo(partido.away_team)
                        const tienePred = !!predK
                        const bloqueado = !knockoutUnlocked || estado === 'locked' || estado === 'finished'
                        const borderColor = estado === 'finished' ? '#4a3872' : tienePred ? '#166534' : 'var(--border)'

                        return (
                          <div key={partido.id} style={{ position: 'relative' }}>
                            <div
                              onClick={() => !bloqueado && abrirModalKnockout(partido)}
                              style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', cursor: bloqueado ? 'default' : 'pointer', transition: 'border-color 0.2s', position: 'relative', zIndex: 2 }}
                              onMouseOver={e => { if (!bloqueado) e.currentTarget.style.borderColor = 'var(--accent)' }}
                              onMouseOut={e => { e.currentTarget.style.borderColor = borderColor }}
                            >
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginBottom: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
                                {new Date(partido.match_date).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <span style={{ color: predK?.winner === homeResuelto ? 'var(--success)' : 'var(--text-primary)', fontSize: '0.8rem', fontWeight: predK?.winner === homeResuelto ? '700' : '600' }}>
                                  {predK?.winner === homeResuelto && '✓ '}{homeResuelto}
                                </span>
                                {tienePred && <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{predK.home}</span>}
                              </div>
                              <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0.4rem 0' }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: predK?.winner === awayResuelto ? 'var(--success)' : 'var(--text-primary)', fontSize: '0.8rem', fontWeight: predK?.winner === awayResuelto ? '700' : '600' }}>
                                  {predK?.winner === awayResuelto && '✓ '}{awayResuelto}
                                </span>
                                {tienePred && <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{predK.away}</span>}
                              </div>
                              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                                {!tienePred && knockoutUnlocked && estado !== 'locked' && estado !== 'finished' && (() => {
                                  const homeR = resolverEquipo(partido.home_team)
                                  const awayR = resolverEquipo(partido.away_team)
                                  const pendiente = homeR.startsWith('W') || homeR.startsWith('L') || awayR.startsWith('W') || awayR.startsWith('L')
                                  return pendiente
                                    ? <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>⏳ Equipos por definir</span>
                                    : <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>+ Predecir</span>
                                })()}
                                {tienePred && estado !== 'finished' && <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>✓ Guardado</span>}
                                {estado === 'locked' && <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>🔒 Cerrado</span>}
                                {estado === 'finished' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{predicciones[partido.id]?.points_earned ?? '0'} pts</span>}
                              </div>
                            </div>

                            {/* Flecha conectora */}
                            {ronda !== 'Final' && (
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                right: '-1.8rem',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-secondary)',
                                opacity: 0.4,
                                fontSize: '1.2rem',
                                zIndex: 1,
                                pointerEvents: 'none'
                              }}>
                                →
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Tercer lugar */}
              {knockout['Third Place'] && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '220px', marginLeft: '2rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '1.5rem' }}>
                    {RONDAS_LABEL['Third Place']}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'flex-start', gap: '1rem' }}>
                    {knockout['Third Place']?.map(partido => {
                      const estado = getEstadoPartido(partido)
                      const predK = bracketPreds[partido.id]
                      const homeResuelto = resolverEquipo(partido.home_team)
                      const awayResuelto = resolverEquipo(partido.away_team)
                      const tienePred = !!predK
                      const bloqueado = !knockoutUnlocked || estado === 'locked' || estado === 'finished'
                      const borderColor = estado === 'finished' ? '#4a3872' : tienePred ? '#166534' : 'var(--border)'

                      return (
                        <div
                          key={partido.id}
                          onClick={() => !bloqueado && abrirModalKnockout(partido)}
                          style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', cursor: bloqueado ? 'default' : 'pointer', transition: 'border-color 0.2s', marginTop: 'auto', marginBottom: 'auto' }}
                        >
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginBottom: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
                            {new Date(partido.match_date).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span style={{ color: predK?.winner === homeResuelto ? 'var(--success)' : 'var(--text-primary)', fontSize: '0.8rem', fontWeight: predK?.winner === homeResuelto ? '700' : '600' }}>
                              {predK?.winner === homeResuelto && '✓ '}{homeResuelto}
                            </span>
                            {tienePred && <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{predK.home}</span>}
                          </div>
                          <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0.4rem 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: predK?.winner === awayResuelto ? 'var(--success)' : 'var(--text-primary)', fontSize: '0.8rem', fontWeight: predK?.winner === awayResuelto ? '700' : '600' }}>
                              {predK?.winner === awayResuelto && '✓ '}{awayResuelto}
                            </span>
                            {tienePred && <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{predK.away}</span>}
                          </div>
                          <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                            {!tienePred && knockoutUnlocked && estado !== 'locked' && estado !== 'finished' && (() => {
                              const homeR = resolverEquipo(partido.home_team)
                              const awayR = resolverEquipo(partido.away_team)
                              const pendiente = homeR.startsWith('W') || homeR.startsWith('L') || awayR.startsWith('W') || awayR.startsWith('L')
                              return pendiente
                                ? <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>⏳ Equipos por definir</span>
                                : <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>+ Predecir</span>
                            })()}
                            {tienePred && estado !== 'finished' && <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>✓ Guardado</span>}
                            {estado === 'locked' && <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>🔒 Cerrado</span>}
                            {estado === 'finished' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{predicciones[partido.id]?.points_earned ?? '0'} pts</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal predicción knockout */}
      {modalKnockout && (
        <div onClick={() => { setModalKnockout(null); setGanadorManual(null) }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.1rem' }}>
                {resolverEquipo(modalKnockout.home_team)} vs {resolverEquipo(modalKnockout.away_team)}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
              {[
                { value: predHomeK, setValue: (v) => { setPredHomeK(v); setGanadorManual(null) }, label: resolverEquipo(modalKnockout.home_team) },
                { value: predAwayK, setValue: (v) => { setPredAwayK(v); setGanadorManual(null) }, label: resolverEquipo(modalKnockout.away_team) },
              ].map((equipo, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '2rem' }}>{getBandera(equipo.label)}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.75rem', textAlign: 'center', maxWidth: '80px' }}>{equipo.label}</span>
                  </div>
                  <button onClick={() => equipo.setValue(Math.min(equipo.value + 1, 20))} style={{ width: '40px', height: '40px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'white', fontSize: '1.25rem', cursor: 'pointer', fontWeight: '700' }}>+</button>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '2.5rem', minWidth: '48px', textAlign: 'center' }}>{equipo.value}</span>
                  <button onClick={() => equipo.setValue(Math.max(equipo.value - 1, 0))} style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '1.25rem', cursor: 'pointer', fontWeight: '700' }}>-</button>
                </div>
              ))}
            </div>

            {predHomeK === predAwayK && (
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ color: 'var(--warning)', fontSize: '0.82rem', fontWeight: '600', textAlign: 'center' }}>⚠️ Empate en 120min 👉 ¿Quién avanza en tiempo extra?</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[resolverEquipo(modalKnockout.home_team), resolverEquipo(modalKnockout.away_team)].map(equipo => (
                    <button
                      key={equipo}
                      onClick={() => setGanadorManual(equipo)}
                      style={{ flex: 1, backgroundColor: ganadorManual === equipo ? 'var(--accent)' : 'var(--bg-card)', color: ganadorManual === equipo ? 'white' : 'var(--text-secondary)', border: `1px solid ${ganadorManual === equipo ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '0.5rem', padding: '0.6rem', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {equipo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleGuardarKnockout}
                disabled={guardandoKnockout || (predHomeK === predAwayK && !ganadorManual)}
                style={{ backgroundColor: (guardandoKnockout || (predHomeK === predAwayK && !ganadorManual)) ? 'var(--border)' : 'var(--accent)', color: 'var(--text-primary)', border: 'none', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '1rem', fontWeight: '600', cursor: (guardandoKnockout || (predHomeK === predAwayK && !ganadorManual)) ? 'not-allowed' : 'pointer' }}
              >
                {guardandoKnockout ? 'Guardando...' : predHomeK === predAwayK && !ganadorManual ? 'Selecciona quién avanza' : '💾 Guardar Predicción'}
              </button>
              <button onClick={() => { setModalKnockout(null); setGanadorManual(null) }} style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '0.95rem', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de predicción grupos */}
      {modalPartido && (
        <div onClick={() => setModalPartido(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {modalPartido.phase === 'group' ? `Grupo ${modalPartido.group_name} • ` : ''}
                {new Date(modalPartido.match_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </p>
              <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.1rem' }}>
                {modalPartido.home_team} vs {modalPartido.away_team}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
              {[
                { value: predHome, setValue: setPredHome, label: modalPartido.home_team },
                { value: predAway, setValue: setPredAway, label: modalPartido.away_team },
              ].map((equipo, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '2rem' }}>{getBandera(equipo.label)}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.75rem', textAlign: 'center', maxWidth: '80px' }}>{equipo.label}</span>
                  </div>
                  <button onClick={() => equipo.setValue(v => Math.min(v + 1, 20))} style={{ width: '40px', height: '40px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'white', fontSize: '1.25rem', cursor: 'pointer', fontWeight: '700' }}>+</button>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '2.5rem', minWidth: '48px', textAlign: 'center' }}>{equipo.value}</span>
                  <button onClick={() => equipo.setValue(v => Math.max(v - 1, 0))} style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '1.25rem', cursor: 'pointer', fontWeight: '700' }}>-</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={handleGuardarPrediccion} disabled={guardando} style={{ backgroundColor: guardando ? 'var(--border)' : 'var(--accent)', color: 'var(--text-primary)', border: 'none', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '1rem', fontWeight: '600', cursor: guardando ? 'not-allowed' : 'pointer' }}>
                {guardando ? 'Guardando...' : '💾 Guardar Predicción'}
              </button>
              <button onClick={() => setModalPartido(null)} style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '0.95rem', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal puntos fase de grupos */}
      {modalPuntosGrupos && (
        <div onClick={() => setModalPuntosGrupos(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>ℹ️</div>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.25rem', marginBottom: '0.25rem' }}>Sistema de Puntos</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Fase de Grupos</p>
            </div>
            {[
              { pts: 5, icon: '🎯', titulo: 'Resultado Exacto', desc: 'Predijiste 2-1 y fue 2-1' },
              { pts: 3, icon: '🔥', titulo: 'Ganador + Goles / Empate', desc: 'Acertaste ganador y goles de un equipo, o acertaste empate (ej. predijiste 1-1, fue 2-2).' },
              { pts: 2, icon: '✅', titulo: 'Solo tendencia correcta', desc: 'Predijiste 2-1, fue 3-0 (solo acertaste ganador)' },
              { pts: 0, icon: '❌', titulo: 'Incorrecto', desc: 'Predijiste 2-1, fue 0-1' },
            ].map(item => (
              <div key={item.pts} style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>{item.titulo}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{item.desc}</p>
                </div>
                <span style={{ color: item.pts === 5 ? 'var(--success)' : item.pts === 3 ? 'var(--warning)' : item.pts === 2 ? 'var(--accent)' : '#f87171', fontWeight: '700', fontSize: '1.25rem', minWidth: '40px', textAlign: 'right' }}>{item.pts}pts</span>
              </div>
            ))}
            <button onClick={() => setModalPuntosGrupos(false)} style={{ backgroundColor: 'var(--accent)', color: 'var(--text-primary)', border: 'none', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
              ¡Entendido! 👍
            </button>
          </div>
        </div>
      )}

      {/* Modal puntos eliminatorias */}
      {modalPuntosKnockout && (
        <div onClick={() => setModalPuntosKnockout(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏆</div>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.25rem', marginBottom: '0.25rem' }}>Sistema de Puntos</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Fase de Eliminatorias</p>
            </div>
            {[
              { pts: 5, icon: '🎯', titulo: 'Resultado Exacto', desc: 'Predijiste 2-1 y fue 2-1' },
              { pts: 3, icon: '🔥', titulo: 'Ganador + Goles / Empate', desc: 'Acertaste ganador y goles de un equipo, o acertaste empate (ej. predijiste 1-1, fue 2-2).' },
              { pts: 2, icon: '✅', titulo: 'Solo tendencia correcta', desc: 'Predijiste 2-1, fue 3-0 (solo acertaste ganador)' },
              { pts: 0, icon: '❌', titulo: 'Incorrecto', desc: 'Predijiste 2-1, fue 0-1' },
            ].map(item => (
              <div key={item.pts} style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>{item.titulo}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{item.desc}</p>
                </div>
                <span style={{ color: item.pts === 5 ? 'var(--success)' : item.pts === 3 ? 'var(--warning)' : item.pts === 2 ? 'var(--accent)' : '#f87171', fontWeight: '700', fontSize: '1.25rem', minWidth: '40px', textAlign: 'right' }}>{item.pts}pts</span>
              </div>
            ))}
            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ color: 'var(--warning)', fontSize: '0.82rem', fontWeight: '600' }}>⚠️ Reglas especiales de eliminatorias:</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5' }}>
                • Los partidos pueden durar hasta <strong style={{ color: 'var(--text-primary)' }}>120 minutos</strong> (tiempo extra incluido).
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5' }}>
                • Los puntos se calculan con el resultado al final de los <strong style={{ color: 'var(--text-primary)' }}>120 minutos</strong>. Los penales <strong style={{ color: 'var(--text-primary)' }}>no cuentan</strong>.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5' }}>
                • Si predices empate y el partido va a penales, tu predicción de empate <strong style={{ color: 'var(--text-primary)' }}>sí cuenta</strong> si el marcador quedó empatado en 120 min.
              </p>
            </div>
            <button onClick={() => setModalPuntosKnockout(false)} style={{ backgroundColor: 'var(--accent)', color: 'var(--text-primary)', border: 'none', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
              ¡Entendido! 👍
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
