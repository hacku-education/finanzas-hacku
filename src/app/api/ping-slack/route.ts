import { NextResponse } from "next/server"

export async function GET() {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: "No SLACK_BOT_TOKEN" }, { status: 500 })

  const mentions = ['U020B382918', 'U0B0CGUCVDX', 'U052L6W2F6J', 'D0BR2UTGJAY']
    .map(id => `<@${id}>`).join(' ')

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Authorization": `Bearer ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "C04JUTJQ7AN",
      text: `${mentions}\n🧪 Test de notificaciones — verificando que todos reciben la alerta.`,
    }),
  })
  const data = await res.json()
  return NextResponse.json({ ok: data.ok, error: data.error || null })
}
