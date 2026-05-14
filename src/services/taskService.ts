import { supabase } from '../lib/supabase'
import type {
  ActivityItem,
  AppLanguage,
  ChecklistItem,
  EmployeeCreatePayload,
  PerformanceMode,
  Profile,
  Project,
  Task,
  TaskPriority,
  PersistedTaskStatus,
  UserRole
} from '../types'

const profileColumns =
  'id, full_name, role, avatar_url, login_email, phone, telegram_username, language, performance_mode, created_at, updated_at'

const taskSelect = `
  *,
  project:projects(id, title, color),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name, role, avatar_url, phone, telegram_username)
`

export function normalizeTelegramUsername(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

export function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase()
}

export function loginToAuthEmail(value: string) {
  const login = normalizeLoginIdentifier(value)
  if (login.includes('@')) return login
  return `${login.replace(/[^a-z0-9._-]+/g, '-') || 'user'}@task-manager.local`
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.access_token || ''
}

async function readApiError(response: Response) {
  try {
    const body = await response.json()
    return body?.error || body?.message || response.statusText
  } catch {
    return response.statusText
  }
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: loginToAuthEmail(email), password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function loadProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(profileColumns)
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error
  return data as Profile | null
}

export async function loadProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(profileColumns)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data || []) as Profile[]
}

export async function upsertProfile(payload: {
  full_name: string
  phone?: string
  telegram_username?: string
  language: AppLanguage
  performance_mode: PerformanceMode
}) {
  const user = await getCurrentUser()
  if (!user) throw new Error('User session not found')

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        full_name: payload.full_name,
        login_email: user.email || null,
        phone: payload.phone || null,
        telegram_username: payload.telegram_username ? normalizeTelegramUsername(payload.telegram_username) : null,
        language: payload.language,
        performance_mode: payload.performance_mode
      },
      { onConflict: 'id' }
    )
    .select(profileColumns)
    .single()

  if (error) throw error
  return data as Profile
}

export async function updateEmployeeProfile(
  employeeId: string,
  payload: {
    full_name: string
    login_email?: string
    phone?: string
    telegram_username?: string
    role: UserRole
  }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: payload.full_name,
      login_email: payload.login_email || null,
      phone: payload.phone || null,
      telegram_username: payload.telegram_username ? normalizeTelegramUsername(payload.telegram_username) : null,
      role: payload.role
    })
    .eq('id', employeeId)
    .select(profileColumns)
    .single()

  if (error) throw error
  return data as Profile
}

export async function createEmployee(payload: EmployeeCreatePayload) {
  const token = await getAccessToken()
  const response = await fetch('/api/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      ...payload,
      telegram_username: payload.telegram_username ? normalizeTelegramUsername(payload.telegram_username) : ''
    })
  })

  if (!response.ok) throw new Error(await readApiError(response))
  const body = await response.json()
  return body.profile as Profile
}

export async function loadProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createProject(payload: Pick<Project, 'title' | 'description' | 'color'>) {
  const user = await getCurrentUser()
  if (!user) throw new Error('User session not found')

  const { data, error } = await supabase
    .from('projects')
    .insert({ ...payload, owner_id: user.id })
    .select('*')
    .single()

  if (error) throw error
  return data as Project
}

export async function loadTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(taskSelect)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const tasks = (data || []) as Task[]
  if (!tasks.length) return []

  const taskIds = tasks.map((task) => task.id)
  const { data: checklist, error: checklistError } = await supabase
    .from('task_checklist_items')
    .select('*')
    .in('task_id', taskIds)
    .order('sort_order', { ascending: true })

  if (checklistError) throw checklistError

  const byTask = new Map<string, ChecklistItem[]>()
  ;(checklist || []).forEach((item) => {
    const list = byTask.get(item.task_id) || []
    list.push(item)
    byTask.set(item.task_id, list)
  })

  return tasks.map((task) => ({ ...task, checklist: byTask.get(task.id) || [] }))
}

export async function createTask(payload: {
  title: string
  description?: string
  assignee_id?: string | null
  project_id?: string | null
  priority: TaskPriority
  status: PersistedTaskStatus
  due_date?: string | null
  checklist?: string[]
}) {
  const user = await getCurrentUser()
  if (!user) throw new Error('User session not found')

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      owner_id: user.id,
      assignee_id: payload.assignee_id || null,
      title: payload.title,
      description: payload.description || null,
      project_id: payload.project_id || null,
      priority: payload.priority,
      status: payload.status,
      due_date: payload.due_date || null
    })
    .select(taskSelect)
    .single()

  if (error) throw error

  const cleanChecklist = (payload.checklist || []).map((title) => title.trim()).filter(Boolean)
  if (cleanChecklist.length) {
    const { error: checklistError } = await supabase.from('task_checklist_items').insert(
      cleanChecklist.map((title, index) => ({ task_id: task.id, title, sort_order: index + 1 }))
    )
    if (checklistError) throw checklistError
  }

  await addActivity(task.id, 'task.created', `Task created: ${task.title}`)
  notifyTaskAssignment(task.id).catch((error) => {
    console.warn('Telegram notification was not sent:', error instanceof Error ? error.message : error)
  })

  return task as Task
}

export async function updateTaskStatus(task: Task, status: PersistedTaskStatus) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', task.id)
    .select(taskSelect)
    .single()

  if (error) throw error
  await addActivity(task.id, 'task.status_changed', `Status changed to ${status}`)
  return data as Task
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}

export async function updateChecklistItem(id: string, isDone: boolean) {
  const { error } = await supabase
    .from('task_checklist_items')
    .update({ is_done: isDone })
    .eq('id', id)

  if (error) throw error
}

export async function loadActivity(): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from('task_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) throw error
  return data || []
}

export async function addActivity(taskId: string | null, action: string, note?: string) {
  const user = await getCurrentUser()
  if (!user) return

  const { error } = await supabase.from('task_activity').insert({
    task_id: taskId,
    user_id: user.id,
    action,
    note: note || null
  })

  if (error) console.warn('Activity was not saved:', error.message)
}

export async function notifyTaskAssignment(taskId: string) {
  const token = await getAccessToken()
  if (!token) return

  const response = await fetch('/api/notify-task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ taskId })
  })

  if (!response.ok) throw new Error(await readApiError(response))
  return response.json()
}
