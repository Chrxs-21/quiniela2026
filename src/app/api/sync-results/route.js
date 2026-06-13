import { createServerClient } from '@supabase/ssr'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Permite conectarse mediante Service Role para evadir bloqueos de RLS, en caso que no uses el anon
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )

  const TRADUCCION_EQUIPOS = {
    'Mexico': 'México', 'South Africa': 'Sudáfrica', 'Korea Republic': 'Corea del Sur',
    'Czechia': 'Chequia', 'Canada': 'Canadá', 'Bosnia-Herzegovina': 'Bosnia y Herzegovina',
    'Qatar': 'Qatar', 'Switzerland': 'Suiza', 'Brazil': 'Brasil', 'Morocco': 'Marruecos',
    'Haiti': 'Haití', 'Scotland': 'Escocia', 'USA': 'Estados Unidos', 'Paraguay': 'Paraguay',
    'Australia': 'Australia', 'Turkey': 'Turquía', 'Germany': 'Alemania', "Curaçao": 'Curazao',
    "Côte d'Ivoire": 'Costa de Marfil', 'Ecuador': 'Ecuador', 'Netherlands': 'Países Bajos',
    'Japan': 'Japón', 'Sweden': 'Suecia', 'Tunisia': 'Túnez', 'Belgium': 'Bélgica',
    'Egypt': 'Egipto', 'IR Iran': 'Irán', 'New Zealand': 'Nueva Zelanda', 'Spain': 'España',
    'Cabo Verde': 'Cabo Verde', 'Saudi Arabia': 'Arabia Saudita', 'Uruguay': 'Uruguay',
    'France': 'Francia', 'Senegal': 'Senegal', 'Iraq': 'Iraq', 'Norway': 'Noruega',
    'Argentina': 'Argentina', 'Algeria': 'Argelia', 'Austria': 'Austria', 'Jordan': 'Jordania',
    'Portugal': 'Portugal', 'Uzbekistan': 'Uzbekistán', 'Congo DR': 'DR Congo',
    'Colombia': 'Colombia', 'England': 'Inglaterra', 'Croatia': 'Croacia', 'Ghana': 'Ghana',
    'Panama': 'Panamá',
  }

  try {
    const response = await fetch('https://api.wc2026api.com/matches', {
      headers: {
        'Authorization': `Bearer ${process.env.WC2026_API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`API Externa falló con status: ${response.status}`)
    }
    
    // Extracción segura del array basado en la estructura "value" del JSON de tu API
    const data = await response.json()
    const matches = data.value || data
    console.log(`Partidos recibidos de la API externa: ${matches.length}`)

    // Obtener la matriz total una sola vez
    const { data: dbMatches, error: matchError } = await supabase
      .from('matches')
      .select('id, match_number, status, home_team, away_team')
      
    if (matchError) throw new Error(`Query de lectura falló: ${matchError.message}`)

    let actualizados = 0
    let equiposActualizados = 0
    let errores = 0

    for (const match of matches) {
      let partido;
      let puntajeLocal = match.home_score ?? 0;
      let puntajeVisitante = match.away_score ?? 0;

      if (match.round === 'group') {
          // A) RUTEO HÍBRIDO - Fase de Grupos: Match por nombres de equipos
          const homeTraducido = TRADUCCION_EQUIPOS[match.home_team] || match.home_team
          const awayTraducido = TRADUCCION_EQUIPOS[match.away_team] || match.away_team
          
          partido = dbMatches.find(p => {
             // Coincidencia Lineal
            if (p.home_team === homeTraducido && p.away_team === awayTraducido) return true;
            
             // Coincidencia Invertida (Previene que la API ponga al Visitante primero y entregue los goles al revés)
            if (p.home_team === awayTraducido && p.away_team === homeTraducido) {
              puntajeLocal = match.away_score ?? 0
              puntajeVisitante = match.home_score ?? 0
              return true
            }
            return false
          })
      } else {
          // B) RUTEO HÍBRIDO - Eliminatorias: Match cronológico atado a la llave
          partido = dbMatches.find(p => p.match_number === match.match_number)
      }

      // Evadir partidos inexistente
      if (!partido) continue 

      // Sincronización de Scorelets - "completed" de la API == "finished" nuestro
      if (match.status === 'completed' && partido.status !== 'finished') {
        const { error } = await supabase
          .from('matches')
          .update({
            home_score: puntajeLocal,
            away_score: puntajeVisitante,
            status: 'finished',
          })
          .eq('id', partido.id)

        if (error) {
          console.error(`Fallo guardando resultado del Match #${match.match_number}:`, error)
          errores++
        } else {
          actualizados++
          partido.status = 'finished' // Local Mutation para no repetir en el bucle
        }
      }

      // Sincronización de Equipos a brackets de ronda final
      if (match.round !== 'group' && match.home_team && match.away_team) {
        const homeKnockoutTraducido = TRADUCCION_EQUIPOS[match.home_team] || match.home_team
        const awayKnockoutTraducido = TRADUCCION_EQUIPOS[match.away_team] || match.away_team

        if (partido.home_team !== homeKnockoutTraducido || partido.away_team !== awayKnockoutTraducido) {
          const { error } = await supabase
            .from('matches')
            .update({
              home_team: homeKnockoutTraducido,
              away_team: awayKnockoutTraducido,
            })
            .eq('id', partido.id)

          if (error) {
            errores++
          } else {
            equiposActualizados++
            partido.home_team = homeKnockoutTraducido
            partido.away_team = awayKnockoutTraducido
          }
        }
      }
    }

    return Response.json({
      ok: true,
      resultadosActualizados: actualizados,
      equiposRevelados: equiposActualizados,
      erroresTotales: errores,
      totalProcesados: matches.length,
    })

  } catch (error) {
    console.error('[CRON JOB ERROR]:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}