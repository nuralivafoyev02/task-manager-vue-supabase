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

async function getActor(request, supabase) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: json({ error: 'Authorization token is missing' }, 401) }

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return { error: json({ error: 'Invalid session' }, 401) }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile) return { error: json({ error: 'Profile was not found' }, 403) }
  return { user: userData.user, profile }
}

function formatDate(date) {
  if (!date) return 'sana belgilanmagan'
  return new Intl.DateTimeFormat('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(date))
}

export async function onRequestPost(context) {
  try {
    const supabase = adminClient(context.env)
    const actor = await getActor(context.request, supabase)
    if (actor.error) return actor.error

    const { taskId } = await context.request.json()
    if (!taskId) return json({ error: 'taskId is required' }, 400)

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        owner_id,
        assignee_id,
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, telegram_username, telegram_chat_id)
      `)
      .eq('id', taskId)
      .single()

    if (taskError || !task) return json({ error: taskError?.message || 'Task was not found' }, 404)
    if (actor.profile.role !== 'manager' && task.owner_id !== actor.user.id) {
      return json({ error: 'You cannot notify this task' }, 403)
    }

    if (!task.assignee) return json({ ok: true, skipped: 'Task has no assignee' })
    if (!context.env.TELEGRAM_BOT_TOKEN) return json({ ok: true, skipped: 'Telegram bot token is not configured' })

    const username = task.assignee.telegram_username
    const chatId = task.assignee.telegram_chat_id || (username ? `@${username}` : '')
    if (!chatId) return json({ ok: true, skipped: 'Assignee Telegram username/chat is missing' })

    const text = [
      `Sizga yangi vazifa biriktirildi.`,
      ``,
      `Vazifa: ${task.title}`,
      `Muddat: ${formatDate(task.due_date)}`,
      `Ustuvorlik: ${task.priority}`,
      task.description ? `Izoh: ${task.description}` : ''
    ]
      .filter(Boolean)
      .join('\n')

    const telegramResponse = await fetch(`https://api.telegram.org/bot${context.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    })

    const telegramBody = await telegramResponse.json().catch(() => ({}))
    if (!telegramResponse.ok) {
      return json(
        {
          ok: false,
          error: telegramBody.description || 'Telegram message was not sent',
          hint: 'Bot foydalanuvchiga yozishi uchun xodim avval botga /start yuborgan bo‘lishi kerak.'
        },
        502
      )
    }

    return json({ ok: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Notification failed' }, 500)
  }
}
