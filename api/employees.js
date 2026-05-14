import {
  adminClient,
  getActor,
  loginToAuthEmail,
  methodNotAllowed,
  normalizeLoginIdentifier,
  normalizeTelegramUsername,
  readJsonBody,
  sendActorError,
  sendJson
} from './_shared.js'

const profileColumns =
  'id, full_name, role, avatar_url, login_email, phone, telegram_username, language, performance_mode, created_at, updated_at'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res)

  try {
    const supabase = adminClient()
    const actor = await getActor(req, supabase)
    if (actor.error) return sendActorError(res, actor)
    if (actor.profile.role !== 'manager') return sendJson(res, 403, { error: 'Only managers can create employees' })

    const body = await readJsonBody(req)
    const fullName = String(body.full_name || '').trim()
    const login = normalizeLoginIdentifier(body.login_email)
    const authEmail = loginToAuthEmail(login)
    const authLogin = authEmail.split('@')[0]
    const password = String(body.password || '')
    const role = body.role === 'manager' ? 'manager' : 'employee'
    const phone = String(body.phone || '').trim()
    const telegramUsername = normalizeTelegramUsername(body.telegram_username)

    if (fullName.length < 2) return sendJson(res, 400, { error: 'Employee full name is required' })
    if (login.length < 3) return sendJson(res, 400, { error: 'Login must be at least 3 characters' })
    if (authLogin.length < 3 || !/[a-z0-9]/.test(authLogin)) {
      return sendJson(res, 400, { error: 'Login must include letters or numbers' })
    }
    if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' })

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, telegram_username: telegramUsername }
    })

    if (createError || !created.user) {
      return sendJson(res, 400, { error: createError?.message || 'Employee auth user was not created' })
    }

    const profilePayload = {
      id: created.user.id,
      full_name: fullName,
      login_email: login,
      phone: phone || null,
      telegram_username: telegramUsername || null,
      role,
      language: 'uz',
      performance_mode: 'balanced'
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select(profileColumns)
      .single()

    if (profileError) {
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined)
      return sendJson(res, 400, { error: profileError.message })
    }

    return sendJson(res, 201, { profile })
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Employee creation failed' })
  }
}
