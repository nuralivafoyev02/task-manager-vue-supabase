import { createClient } from '@supabase/supabase-js'

export function sendJson(res, status, body) {
  res.status(status).json(body)
}

export function methodNotAllowed(req, res, allowed = ['POST']) {
  if (req.method === 'GET' && acceptsHtml(req)) return sendNotFoundPage(res)

  res.setHeader('Allow', allowed.join(', '))
  return sendJson(res, 405, { error: `Method ${req.method} is not allowed` })
}

export function acceptsHtml(req) {
  return String(req.headers.accept || '').includes('text/html')
}

export function sendNotFoundPage(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(404).send(`<!doctype html>
<html lang="uz">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sahifa topilmadi</title>
    <style>
      :root { color: #111827; background: #f6f9fc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      main { width: min(100%, 520px); padding: 28px; border: 1px solid #dbe5f1; border-radius: 8px; background: #fff; text-align: center; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); }
      strong { color: #1769e0; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; }
      h1 { margin: 10px 0; font-size: 34px; letter-spacing: 0; }
      p { margin: 0 0 20px; color: #64748b; line-height: 1.6; }
      a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; border-radius: 8px; background: #1769e0; color: #fff; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <strong>404</strong>
      <h1>Sahifa topilmadi</h1>
      <p>Bu manzil foydalanuvchi sahifasi emas yoki o‘chirilgan.</p>
      <a href="/">Bosh sahifaga qaytish</a>
    </main>
  </body>
</html>`)
}

export function normalizeTelegramUsername(value = '') {
  return String(value).trim().replace(/^@+/, '').toLowerCase()
}

export function normalizeLoginIdentifier(value = '') {
  return String(value).trim().toLowerCase()
}

export function loginToAuthEmail(value = '') {
  const login = normalizeLoginIdentifier(value)
  if (login.includes('@')) return login
  return `${login.replace(/[^a-z0-9._-]+/g, '-') || 'user'}@task-manager.local`
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
