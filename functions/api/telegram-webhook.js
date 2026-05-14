import { createClient } from '@supabase/supabase-js'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

function adminClient(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server env vars are missing')

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

function normalizeTelegramUsername(value = '') {
  return String(value).trim().replace(/^@+/, '').toLowerCase()
}

async function sendBotMessage(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  }).catch(() => undefined)
}

export async function onRequestPost(context) {
  try {
    const secret = context.env.TELEGRAM_WEBHOOK_SECRET
    const headerSecret = context.request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    const urlSecret = new URL(context.request.url).searchParams.get('secret')

    if (secret && headerSecret !== secret && urlSecret !== secret) {
      return json({ error: 'Invalid webhook secret' }, 401)
    }

    const update = await context.request.json()
    const message = update.message || update.edited_message
    const chatId = message?.chat?.id
    const username = normalizeTelegramUsername(message?.from?.username)

    if (!chatId || !username) {
      return json({ ok: true, skipped: 'No Telegram username/chat in update' })
    }

    const supabase = adminClient(context.env)
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: String(chatId),
        telegram_verified_at: new Date().toISOString()
      })
      .eq('telegram_username', username)
      .select('id, full_name')
      .maybeSingle()

    if (error) return json({ error: error.message }, 500)

    if (!profile) {
      await sendBotMessage(
        context.env,
        chatId,
        'Username profilingizda topilmadi. Rahbaringiz xodim profilida Telegram username maydonini to‘g‘ri kiritganini tekshirsin.'
      )
      return json({ ok: true, linked: false })
    }

    await sendBotMessage(context.env, chatId, 'Telegram profilingiz task manager bilan bog‘landi. Endi yangi vazifalar shu yerga keladi.')
    return json({ ok: true, linked: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Webhook failed' }, 500)
  }
}
