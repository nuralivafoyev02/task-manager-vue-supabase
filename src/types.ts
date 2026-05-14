export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'canceled' | 'overdue'
export type PersistedTaskStatus = Exclude<TaskStatus, 'overdue'>
export type TaskPriority = 'low' | 'medium' | 'high'
export type UserRole = 'employee' | 'manager'
export type AppLanguage = 'uz' | 'ru' | 'uz_cyrl'
export type PerformanceMode = 'balanced' | 'compact'
export type ViewKey = 'dashboard' | 'tasks' | 'employees' | 'calendar' | 'settings'
export type StatusFilter = 'all' | PersistedTaskStatus | 'overdue'
export type ThemeMode = 'light' | 'dark'
export type ToastType = 'success' | 'error' | 'info'
export type ToastItem = { id: number; type: ToastType; message: string; startX?: number }

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole | null
  avatar_url: string | null
  login_email: string | null
  phone: string | null
  telegram_username: string | null
  telegram_chat_id?: string | null
  language: AppLanguage | null
  performance_mode: PerformanceMode | null
  created_at?: string
  updated_at?: string
}

export interface Project {
  id: string
  owner_id: string
  title: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  owner_id: string
  assignee_id: string | null
  project_id: string | null
  title: string
  description: string | null
  status: PersistedTaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
  project?: Pick<Project, 'id' | 'title' | 'color'> | null
  assignee?: Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_url' | 'phone' | 'telegram_username'> | null
  checklist?: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  task_id: string
  title: string
  is_done: boolean
  sort_order: number
  created_at: string
}

export interface ActivityItem {
  id: string
  task_id: string | null
  user_id: string
  action: string
  note: string | null
  created_at: string
}

export interface EmployeeCreatePayload {
  full_name: string
  login_email: string
  password: string
  phone?: string
  telegram_username?: string
  role: UserRole
}
