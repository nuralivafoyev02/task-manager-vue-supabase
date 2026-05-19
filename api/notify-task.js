import { adminClient, getActor, getTelegramBotToken, methodNotAllowed, readJsonBody, sendActorError, sendJson } from './_shared.js'

function formatDate(date) {
  if (!date) return 'sana belgilanmagan'
  const [year, month, day] = String(date).split('-')
  if (!year || !month || !day) return String(date)
  return `${day}.${month}.${year}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res)

  try {
    const supabase = adminClient()
    const actor = await getActor(req, supabase)
    if (actor.error) return sendActorError(res, actor)

    const { taskId } = await readJsonBody(req)
    if (!taskId) return sendJson(res, 400, { error: 'taskId is required' })

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(
        `
        id,
        title,
        description,
        due_date,
        priority,
        owner_id,
        assignee_id,
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, telegram_username, telegram_chat_id)
      `
      )
      .eq('id', taskId)
      .single()

    if (taskError || !task) return sendJson(res, 404, { error: taskError?.message || 'Task was not found' })
    if (actor.profile.role !== 'manager' && task.owner_id !== actor.user.id) {
      return sendJson(res, 403, { error: 'You cannot notify this task' })
    }

    if (!task.assignee) return sendJson(res, 200, { ok: true, skipped: 'Task has no assignee' })

    const token = getTelegramBotToken()
    if (!token) {
      return sendJson(res, 500, { ok: false, error: 'Telegram bot token is not configured' })
    }

    const chatId = task.assignee.telegram_chat_id
    if (!chatId) {
      return sendJson(res, 409, {
        ok: false,
        error: 'Assignee Telegram chat is not connected',
        hint: 'Bot xodimga yozishi uchun xodim avval botga /start yuborishi kerak. Shunda webhook telegram_chat_id ni profilga bog‘laydi.'
      })
    }

    const text = [
      'Sizga yangi vazifa biriktirildi.',
      '',
      `Vazifa: ${task.title}`,
      `Muddat: ${formatDate(task.due_date)}`,
      `Ustuvorlik: ${task.priority}`,
      task.description ? `Izoh: ${task.description}` : ''
    ]
      .filter(Boolean)
      .join('\n')

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
      return sendJson(res, 502, {
        ok: false,
        error: telegramBody.description || 'Telegram message was not sent',
        hint: 'Bot foydalanuvchiga yozishi uchun xodim avval botga /start yuborgan bo‘lishi kerak.'
      })
    }

    return sendJson(res, 200, { ok: true })
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Notification failed' })
  }
}
