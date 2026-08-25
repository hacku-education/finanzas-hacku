import { NextResponse } from "next/server"

// Este handler no usaba ninguna función dinámica (sin `request`, sin cookies/headers),
// así que Next.js lo trataba como ruta estática: la ejecutaba UNA vez y servía esa
// misma respuesta cacheada para siempre — incluido el POST a Slack, que solo se
// disparó realmente la primera vez. `force-dynamic` obliga a ejecutar (y a llamar
// a Slack) en cada request. Sin esto, este endpoint de diagnóstico da falsos "ok:true".
export const dynamic = 'force-dynamic'

export async function GET() {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: "No SLACK_BOT_TOKEN" }, { status: 500 })

  const mentions = ['U020B382918', 'U0B0CGUCVDX', 'U052L6W2F6J', 'U0BQ4HYGMMY']
    .map(id => `<@${id}>`).join(' ')

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Authorization": `Bearer ${botToken}`, "Content-Type": "application/json" },
    cache: 'no-store',
    body: JSON.stringify({
      channel: "C04JUTJQ7AN",
      text: `${mentions}\n🧪 Test de notificaciones — verificando que todos reciben la alerta. (${new Date().toISOString()})`,
    }),
  })
  const data = await res.json()
  return NextResponse.json({
    ok: data.ok,
    error: data.error || null,
    channel: data.channel || null,
    ts: data.ts || null,
    message: data.message?.text || null,
    warning: data.warning || null,
    response_metadata: data.response_metadata || null,
  })
}
