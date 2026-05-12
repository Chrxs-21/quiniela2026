export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/matches?select=id&limit=1`,
      {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    )

    if (response.ok) {
      return Response.json({ ok: true, timestamp: new Date().toISOString() })
    } else {
      return Response.json({ error: 'DB not responding' }, { status: 500 })
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}