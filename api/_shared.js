import { createClient } from '@supabase/supabase-js'

export function sendJson(res, status, body) {
  res.status(status).json(body)
}

export function methodNotAllowed(req, res, allowed = ['POST']) {
  res.setHeader('Allow', allowed.join(', '))
  return sendJson(res, 405, { error: `Method ${req.method} is not allowed` })
}

export function normalizeTelegramUsername(value = '') {
  return String(value).trim().replace(/^@+/, '').toLowerCase()
}

export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server env vars are missing')

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export async function getActor(req, supabase) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: { status: 401, body: { error: 'Authorization token is missing' } } }

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return { error: { status: 401, body: { error: 'Invalid session' } } }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile) return { error: { status: 403, body: { error: 'Profile was not found' } } }
  return { user: userData.user, profile }
}

export function sendActorError(res, actor) {
  return sendJson(res, actor.error.status, actor.error.body)
}
