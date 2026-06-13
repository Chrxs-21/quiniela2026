/* src/app/api/sync-results/route.js */
import { createServerClient } from '@supabase/ssr'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    
    // 1. Manejar el payload correctamente (el array viene dentro de .value)
    const parsedData = await response.json()
    const matches = Array.isArray(parsedData.value) ? parsedData.value : parsedData
    
    // 2. Traer todos los partidos de Supabase
    const { data: dbMatches, error: matchError } = await supabase
      .from('matches')
      .select('id, match_number, status, home_team, away_team, phase')
      
    if (matchError) throw new Error(`Error BD local: ${matchError.message}`)

    let actualizados = 0
    let equiposActualizados = 0
    let errores = 0

    // 3. Iterar cada partido devuelto de la API Externa
    for (const match of matches) {
      let partido = null
      
      const homeTraducido = TRADUCCION_EQUIPOS[match.home_team] || match.home_team
      const awayTraducido = TRADUCCION_EQUIPOS[match.away_team] || match.away_team

      if (match.round === 'group') {
        // En Fase Grupos: Validar por nombres de equipo saltando el match_number desfasado
        partido = dbMatches.find(m => 
          m.phase === 'group' && 
          ((m.home_team === homeTraducido && m.away_team === awayTraducido) || 
           (m.home_team === awayTraducido && m.away_team === homeTraducido))
        )
      } else {
        // En Knockout: Validar por standard FIFA match_number ya que no hay equipos reales 
        partido = dbMatches.find(m => m.match_number === match.match_number && m.phase === 'knockout')
      }

      if (!partido) continue 

      let finalHomeScore = match.home_score;
      let finalAwayScore = match.away_score;
      
      // Si el partido está cruzado en BD (Nuestro Away es su Home) de antemano, invertimos los goles cruzados
      if (match.round === 'group' && partido.home_team === awayTraducido && partido.away_team === homeTraducido) {
        finalHomeScore = match.away_score;
        finalAwayScore = match.home_score;
      }

      // 4. SOLUCIÓN ESTADO: La API manda status 'completed'
      if (match.status === 'completed' && partido.status !== 'finished') {
        const { error } = await supabase
          .from('matches')
          .update({
            home_score: finalHomeScore,
            away_score: finalAwayScore,
            status: 'finished', // El Trigger local se reactivará al pasar a finished
          })
          .eq('id', partido.id)

        if (error) errores++
        else {
          actualizados++
          partido.status = 'finished'
        }
      }

      // 5. SOLUCIÓN EQUIPOS KNOCKOUT: Poblar los vacíos cuando los decidan.
      if (match.round !== 'group' && match.home_team && match.away_team) {
        if (partido.home_team !== homeTraducido || partido.away_team !== awayTraducido) {
          const { error } = await supabase
            .from('matches')
            .update({
              home_team: homeTraducido,
              away_team: awayTraducido,
            })
            .eq('id', partido.id)

          if (error) errores++
          else equiposActualizados++
        }
      }
    }

    return Response.json({
      ok: true, actualizados, equiposActualizados, errores, total: matches.length
    })

  } catch (error) {
    console.error('[Error Sync]:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}