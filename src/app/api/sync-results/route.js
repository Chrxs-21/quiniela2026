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
    'Mexico': 'México',
    'South Africa': 'Sudáfrica',
    'Korea Republic': 'Corea del Sur',
    'Czechia': 'Chequia',
    'Canada': 'Canadá',
    'Bosnia-Herzegovina': 'Bosnia y Herzegovina',
    'Qatar': 'Qatar',
    'Switzerland': 'Suiza',
    'Brazil': 'Brasil',
    'Morocco': 'Marruecos',
    'Haiti': 'Haití',
    'Scotland': 'Escocia',
    'USA': 'Estados Unidos',
    'Paraguay': 'Paraguay',
    'Australia': 'Australia',
    'Turkey': 'Turquía',
    'Germany': 'Alemania',
    "Curaçao": 'Curazao',
    "Côte d'Ivoire": 'Costa de Marfil',
    'Ecuador': 'Ecuador',
    'Netherlands': 'Países Bajos',
    'Japan': 'Japón',
    'Sweden': 'Suecia',
    'Tunisia': 'Túnez',
    'Belgium': 'Bélgica',
    'Egypt': 'Egipto',
    'IR Iran': 'Irán',
    'New Zealand': 'Nueva Zelanda',
    'Spain': 'España',
    'Cabo Verde': 'Cabo Verde',
    'Saudi Arabia': 'Arabia Saudita',
    'Uruguay': 'Uruguay',
    'France': 'Francia',
    'Senegal': 'Senegal',
    'Iraq': 'Iraq',
    'Norway': 'Noruega',
    'Argentina': 'Argentina',
    'Algeria': 'Argelia',
    'Austria': 'Austria',
    'Jordan': 'Jordania',
    'Portugal': 'Portugal',
    'Uzbekistan': 'Uzbekistán',
    'Congo DR': 'DR Congo',
    'Colombia': 'Colombia',
    'England': 'Inglaterra',
    'Croatia': 'Croacia',
    'Ghana': 'Ghana',
    'Panama': 'Panamá',
  }

  try {
    const response = await fetch('https://api.wc2026api.com/matches', {
      headers: {
        'Authorization': `Bearer ${process.env.WC2026_API_KEY}`,
      },
    })

    const matches = await response.json()

    let actualizados = 0
    let equiposActualizados = 0
    let errores = 0

    for (const match of matches) {
      const { data: partido } = await supabase
        .from('matches')
        .select('*')
        .eq('match_number', match.match_number)
        .maybeSingle()

      if (!partido) continue

      // Actualizar resultado si el partido terminó
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
        else actualizados++
      }

      // Actualizar equipos en eliminatorias cuando se confirmen
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
          else equiposActualizados++
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
    return Response.json({ error: error.message }, { status: 500 })
  }
}