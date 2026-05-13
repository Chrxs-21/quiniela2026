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

  try {
    const response = await fetch('https://api.wc2026api.com/matches?status=finished', {
      headers: {
        'Authorization': `Bearer ${process.env.WC2026_API_KEY}`,
      },
    })

    const matches = await response.json()

    let actualizados = 0
    let errores = 0

    for (const match of matches) {
      const { data: partido } = await supabase
        .from('matches')
        .select('*')
        .eq('match_number', match.match_number)
        .maybeSingle()

      if (!partido) continue
      if (partido.status === 'finished') continue

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

    return Response.json({ ok: true, actualizados, errores, total: matches.length })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}