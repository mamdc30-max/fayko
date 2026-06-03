import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-push-secret')
  if (secret !== process.env.PUSH_SECRET) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  try {
    const { title, body, url, tag } = await req.json()

    // Initialisation au moment de l'appel (pas au build)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (!subs?.length) {
      return NextResponse.json({ sent: 0 })
    }

    const webpush = await import('web-push')
    webpush.default.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/missions',
      tag: tag  || 'veille',
    })

    let sent = 0
    const dead: string[] = []

    await Promise.allSettled(
      subs.map(async sub => {
        try {
          await webpush.default.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          sent++
        } catch (err: unknown) {
          if (
            err && typeof err === 'object' &&
            'statusCode' in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            dead.push(sub.endpoint)
          }
        }
      })
    )

    if (dead.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', dead)
    }

    return NextResponse.json({ sent, dead: dead.length })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
