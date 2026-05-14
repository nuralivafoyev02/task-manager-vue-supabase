import { adminClient, methodNotAllowed, normalizeTelegramUsername, readJsonBody, sendJson } from './_shared.js'

async function sendBotMessage(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  }).catch(() => undefined)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res)

  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    const headerSecret = req.headers['x-telegram-bot-api-secret-token']
    const urlSecret = new URL(req.url || '/api/telegram-webhook', `https://${req.headers.host}`).searchParams.get('secret')

    if (secret && headerSecret !== secret && urlSecret !== secret) {
      return sendJson(res, 401, { error: 'Invalid webhook secret' })
    }

    const update = await readJsonBody(req)
    const message = update.message || update.edited_message
    const chatId = message?.chat?.id
    const username = normalizeTelegramUsername(message?.from?.username)

    if (!chatId || !username) {
      return sendJson(res, 200, { ok: true, skipped: 'No Telegram username/chat in update' })
    }

    const supabase = adminClient()
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: String(chatId),
        telegram_verified_at: new Date().toISOString()
      })
      .eq('telegram_username', username)
      .select('id, full_name')
      .maybeSingle()

    if (error) return sendJson(res, 500, { error: error.message })

    if (!profile) {
      await sendBotMessage(
        chatId,
        'Username profilingizda topilmadi. Rahbaringiz xodim profilida Telegram username maydonini to‘g‘ri kiritganini tekshirsin.'
      )
      return sendJson(res, 200, { ok: true, linked: false })
    }

    await sendBotMessage(chatId, 'Telegram profilingiz task manager bilan bog‘landi. Endi yangi vazifalar shu yerga keladi.')
    return sendJson(res, 200, { ok: true, linked: true })
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Webhook failed' })
  }
}
