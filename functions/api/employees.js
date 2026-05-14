import { createClient } from '@supabase/supabase-js'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

function normalizeTelegramUsername(value = '') {
  return String(value).trim().replace(/^@+/, '').toLowerCase()
}

function envValue(env, key, fallbackKey) {
  return env[key] || (fallbackKey ? env[fallbackKey] : undefined)
}

function adminClient(env) {
  const url = envValue(env, 'SUPABASE_URL', 'VITE_SUPABASE_URL')
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server env vars are missing')

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

async function getManager(request, supabase) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: json({ error: 'Authorization token is missing' }, 401) }

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return { error: json({ error: 'Invalid session' }, 401) }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || profile?.role !== 'manager') {
    return { error: json({ error: 'Only managers can create employees' }, 403) }
  }

  return { user: userData.user, profile }
}

export async function onRequestPost(context) {
  try {
    const supabase = adminClient(context.env)
    const manager = await getManager(context.request, supabase)
    if (manager.error) return manager.error

    const body = await context.request.json()
    const fullName = String(body.full_name || '').trim()
    const loginEmail = String(body.login_email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const role = body.role === 'manager' ? 'manager' : 'employee'
    const phone = String(body.phone || '').trim()
    const telegramUsername = normalizeTelegramUsername(body.telegram_username)

    if (fullName.length < 2) return json({ error: 'Employee full name is required' }, 400)
    if (!loginEmail.includes('@')) return json({ error: 'Valid login email is required' }, 400)
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, telegram_username: telegramUsername }
    })

    if (createError || !created.user) {
      return json({ error: createError?.message || 'Employee auth user was not created' }, 400)
    }

    const profilePayload = {
      id: created.user.id,
      full_name: fullName,
      login_email: loginEmail,
      phone: phone || null,
      telegram_username: telegramUsername || null,
      role,
      language: 'uz',
      performance_mode: 'balanced'
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('id, full_name, role, avatar_url, login_email, phone, telegram_username, language, performance_mode, created_at, updated_at')
      .single()

    if (profileError) {
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined)
      return json({ error: profileError.message }, 400)
    }

    return json({ profile }, 201)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Employee creation failed' }, 500)
  }
}
