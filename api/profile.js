import { adminClient, getActor, loginToAuthEmail, methodNotAllowed, normalizeLoginIdentifier, readJsonBody, sendActorError, sendJson } from './_shared.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return methodNotAllowed(req, res, ['PATCH'])

  try {
    const supabase = adminClient()
    const actor = await getActor(req, supabase)
    if (actor.error) return sendActorError(res, actor)

    const body = await readJsonBody(req)
    const login = body.login === undefined ? undefined : normalizeLoginIdentifier(body.login)
    const password = body.password === undefined ? undefined : String(body.password || '')
    const updatePayload = {}

    if (login !== undefined) {
      if (login.length < 3) return sendJson(res, 400, { error: 'Login must be at least 3 characters' })
      updatePayload.email = loginToAuthEmail(login)
    }

    if (password !== undefined && password.trim()) {
      if (password.trim().length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' })
      updatePayload.password = password.trim()
    }

    if (!Object.keys(updatePayload).length) return sendJson(res, 200, { ok: true })

    const { error: authError } = await supabase.auth.admin.updateUserById(actor.user.id, updatePayload)
    if (authError) return sendJson(res, 400, { error: authError.message })

    if (login !== undefined) {
      const { error: profileError } = await supabase.from('profiles').update({ login_email: login }).eq('id', actor.user.id)
      if (profileError) return sendJson(res, 400, { error: profileError.message })
    }

    return sendJson(res, 200, { ok: true })
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Profile update failed' })
  }
}
