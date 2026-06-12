import { createServerClient } from '@supabase/ssr'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    'Qatar': 'Catar', 'Switzerland': 'Suiza', 'Brazil': 'Brasil', 'Morocco': 'Marruecos',
    'Haiti': 'Haití', 'Scotland': 'Escocia', 'USA': 'Estados Unidos', 'Paraguay': 'Paraguay',
    'Australia': 'Australia', 'Turkey': 'Turquía', 'Germany': 'Alemania', "Curaçao": 'Curazao',
    "Côte d'Ivoire": 'Costa de Marfil', 'Ecuador': 'Ecuador', 'Netherlands': 'Países Bajos',
    'Japan': 'Japón', 'Sweden': 'Suecia', 'Tunisia': 'Túnez', 'Belgium': 'Bélgica',
    'Egypt': 'Egipto', 'IR Iran': 'Irán', 'New Zealand': 'Nueva Zelanda', 'Spain': 'España',
    'Cabo Verde': 'Cabo Verde', 'Saudi Arabia': 'Arabia Saudita', 'Uruguay': 'Uruguay',
    'France': 'Francia', 'Senegal': 'Senegal', 'Iraq': 'Irak', 'Norway': 'Noruega',
    'Argentina': 'Argentina', 'Algeria': 'Argelia', 'Austria': 'Austria', 'Jordan': 'Jordania',
    'Portugal': 'Portugal', 'Uzbekistan': 'Uzbekistán', 'Congo DR': 'Rep. Democrática del Congo',
    'Colombia': 'Colombia', 'England': 'Inglaterra', 'Croatia': 'Croacia', 'Ghana': 'Ghana',
    'Panama': 'Panamá',
  }

  try {
    // 1. Obtener los resultados en tiempo real de la API externa
    const response = await fetch('https://api.wc2026api.com/matches', {
      headers: {
        'Authorization': `Bearer ${process.env.WC2026_API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`API Externa falló con status: ${response.status}`)
    }
    
    const matches = await response.json()

    // 2. OPTIMIZACIÓN: Cargar todos los partidos locales en un único Query a Supabase
    const { data: dbMatches, error: matchError } = await supabase
      .from('matches')
      .select('id, match_number, status, home_team, away_team')
      
    if (matchError) throw new Error(`Error en Supabase local: ${matchError.message}`)

    // Convertirlo a un diccionario para acceder instantáneamente (Ej: partidosLocales[1] ...)
    const partidosLocales = {}
    dbMatches.forEach(m => {
      partidosLocales[m.match_number] = m
    })

    let actualizados = 0
    let equiposActualizados = 0
    let errores = 0

    // 3. Iterar los partidos de la API
    for (const match of matches) {
      const partido = partidosLocales[match.match_number]
      if (!partido) continue // Si no existe en la base de datos, lo ignoramos

      // Actualizar resultado si el partido terminó en la vida real, pero localmente no está "finished"
      if (match.status === 'finished' && partido.status !== 'finished') {
        const { error } = await supabase
          .from('matches')
          .update({
            home_score: match.home_score,
            away_score: match.away_score,
            status: 'finished',
          })
          .eq('id', partido.id)

        if (error) errores++
        else {
          actualizados++
          // Sincronizamos local para las siguientes comprobaciones
          partido.status = 'finished'
        }
      }

      // Actualizar equipos en eliminatorias cuando se confirmen (fase != 'group')
      if (match.round !== 'group' && match.home_team && match.away_team) {
        const homeTraducido = TRADUCCION_EQUIPOS[match.home_team] || match.home_team
        const awayTraducido = TRADUCCION_EQUIPOS[match.away_team] || match.away_team

        const necesitaActualizar =
          partido.home_team !== homeTraducido ||
          partido.away_team !== awayTraducido

        if (necesitaActualizar) {
          const { error } = await supabase
            .from('matches')
            .update({
              home_team: homeTraducido,
              away_team: awayTraducido,
            })
            .eq('id', partido.id)

          if (error) errores++
          else {
            equiposActualizados++
            // Sincronizamos local
            partido.home_team = homeTraducido
            partido.away_team = awayTraducido
          }
        }
      }
    }

    return Response.json({
      ok: true,
      actualizados,
      equiposActualizados,
      errores,
      total: matches.length,
    })

  } catch (error) {
    console.error('[Cron Error Sync Results]:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}