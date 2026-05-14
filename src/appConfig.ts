import type { ViewKey } from './types'

export const VIEW_KEYS: ViewKey[] = ['dashboard', 'tasks', 'employees', 'calendar', 'settings']

export const STORAGE_KEYS = {
  activeView: 'task-manager-active-view',
  theme: 'task-manager-theme'
} as const
