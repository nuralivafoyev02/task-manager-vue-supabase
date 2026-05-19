<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { STORAGE_KEYS, VIEW_KEYS } from './appConfig'
import CancelTaskModal from './components/CancelTaskModal.vue'
import StatusBadge from './components/StatusBadge.vue'
import ToastStack from './components/ToastStack.vue'
import { useToasts } from './composables/useToasts'
import { localeName as getLocaleName, translate } from './i18n'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  createEmployee,
  createTask,
  deleteTask,
  loadActivity,
  loadProfile,
  loadProfiles,
  loadTasks,
  normalizeLoginIdentifier,
  normalizeTelegramUsername,
  signInWithPassword,
  signOut,
  updateAccountCredentials,
  updateChecklistItem,
  updateTask,
  updateTaskStatus,
  upsertProfile
} from './services/taskService'
import {
  displayTelegram,
  formatDate,
  formatDay as formatDayNumber,
  getInitialsFromName,
  toIsoDate
} from './utils/formatters'
import type {
  ActivityItem,
  AppLanguage,
  EmployeeCreatePayload,
  PerformanceMode,
  PersistedTaskStatus,
  Profile,
  StatusFilter,
  Task,
  TaskPriority,
  TaskStatus,
  ThemeMode,
  UserRole,
  ViewKey
} from './types'

type SettingsSectionKey = 'profile' | 'security' | 'appearance' | 'account'
type CompletedArchiveMode = 'week' | 'month'

const savedView = localStorage.getItem(STORAGE_KEYS.activeView) as ViewKey | null
const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) as ThemeMode | null

const activeView = ref<ViewKey>(savedView && VIEW_KEYS.includes(savedView) ? savedView : 'dashboard')
const loading = ref(true)
const backgroundRefreshing = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const noticeMessage = ref('')
const mobileMenuOpen = ref(false)
const sessionReady = ref(false)
const isAuthenticated = ref(false)
const employeePasswordVisible = ref(false)
const settingsPasswordVisible = ref(false)
const currentPath = ref(window.location.pathname)
const profileMenuOpen = ref(false)
const themeMode = ref<ThemeMode>(savedTheme === 'dark' ? 'dark' : 'light')
const { toasts, showToast, dismissToast } = useToasts()
let refreshPromise: Promise<void> | null = null

const profile = ref<Profile | null>(null)
const employees = ref<Profile[]>([])
const tasks = ref<Task[]>([])
const activity = ref<ActivityItem[]>([])
const selectedTaskId = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref<StatusFilter>('all')
const showTaskComposer = ref(false)
const showEmployeeComposer = ref(false)
const editingTaskId = ref<string | null>(null)
const taskActionMenuId = ref<string | null>(null)
const savingTaskIds = ref(new Set<string>())
const cancelDialogTask = ref<Task | null>(null)
const cancelReason = ref('')
const selectedCalendarDate = ref(toIsoDate(new Date()))
const calendarCursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const activeSettingsSection = ref<SettingsSectionKey>('profile')
const completedArchiveMode = ref<CompletedArchiveMode>('week')
const selectedCompletedFolderId = ref<string | null>(null)

const authForm = reactive({
  email: '',
  password: ''
})

const taskForm = reactive({
  title: '',
  description: '',
  assignee_id: '',
  priority: 'medium' as TaskPriority,
  status: 'todo' as PersistedTaskStatus,
  due_date: toIsoDate(new Date()),
  checklistText: ''
})

const employeeForm = reactive<EmployeeCreatePayload>({
  full_name: '',
  login_email: '',
  password: '',
  phone: '',
  telegram_username: '',
  role: 'employee'
})

const settingsForm = reactive({
  full_name: '',
  login: '',
  phone: '',
  telegram_username: '',
  avatar_url: '',
  language: 'uz' as AppLanguage,
  performance_mode: 'balanced' as PerformanceMode,
  password: ''
})

const isManager = computed(() => profile.value?.role === 'manager')
const isNotFoundRoute = computed(() => !['/', '/index.html'].includes(currentPath.value))
const currentLanguage = computed<AppLanguage>(() => settingsForm.language || profile.value?.language || 'uz')
const todayIso = computed(() => toIsoDate(new Date()))
const activeTasks = computed(() => tasks.value.filter((task) => task.status !== 'completed' && task.status !== 'canceled'))
const completedTasks = computed(() => tasks.value.filter((task) => task.status === 'completed'))
const canceledTasks = computed(() => tasks.value.filter((task) => task.status === 'canceled'))
const overdueTasks = computed(() => tasks.value.filter((task) => isOverdue(task)))

const navItems = computed<Array<{ key: ViewKey; label: string; icon: string }>>(() => {
  const base: Array<{ key: ViewKey; label: string; icon: string }> = isManager.value
    ? [
      { key: 'dashboard', label: t('dashboard'), icon: 'bi-speedometer2' },
      { key: 'tasks', label: t('tasks'), icon: 'bi-check2-square' },
      { key: 'employees', label: t('employees'), icon: 'bi-people' },
      { key: 'calendar', label: t('calendar'), icon: 'bi-calendar3' }
    ]
    : [
      { key: 'tasks', label: t('tasks'), icon: 'bi-check2-square' },
      { key: 'calendar', label: t('calendar'), icon: 'bi-calendar3' }
    ]

  return [...base, { key: 'settings', label: t('settings'), icon: 'bi-gear' }]
})

const assigneeOptions = computed(() => {
  const list = employees.value.length ? employees.value : profile.value ? [profile.value] : []
  return [...list].sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')))
})

const employeeMap = computed(() => new Map(employees.value.map((employee) => [employee.id, employee])))

const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let list = [...tasks.value]

  if (query) {
    const terms = query.split(/\s+/).filter(Boolean)
    list = list.filter((task) => {
      const assignee = task.assignee?.full_name || employeeMap.value.get(task.assignee_id || '')?.full_name || ''
      const haystack = [task.title, task.description, assignee, task.priority, task.status, formatDate(task.due_date)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }

  if (statusFilter.value === 'overdue') list = list.filter((task) => isOverdue(task))
  else if (statusFilter.value !== 'all') list = list.filter((task) => task.status === statusFilter.value)

  if (activeView.value === 'dashboard') return list.slice(0, 8)
  return list
})

const selectedTask = computed(() => {
  return tasks.value.find((task) => task.id === selectedTaskId.value) || filteredTasks.value[0] || null
})

const pageTitle = computed(() => {
  if (activeView.value === 'dashboard') return t('dashboard')
  if (activeView.value === 'employees') return t('employees')
  if (activeView.value === 'calendar') return t('calendar')
  if (activeView.value === 'settings') return t('settings')
  return t('tasks')
})

const pageDescription = computed(() => {
  if (activeView.value === 'employees') return t('employeesDescription')
  if (activeView.value === 'calendar') return t('calendarDescription')
  if (activeView.value === 'settings') return t('settingsDescription')
  if (activeView.value === 'tasks') return isManager.value ? t('tasksDescriptionManager') : t('tasksDescriptionEmployee')
  return t('dashboardDescription')
})

const calendarTitle = computed(() => {
  return `${String(calendarCursor.value.getMonth() + 1).padStart(2, '0')}.${calendarCursor.value.getFullYear()}`
})

const localeName = computed(() => getLocaleName(currentLanguage.value))

const calendarDays = computed(() => {
  const start = new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth(), 1)
  const gridStart = new Date(start)
  const mondayOffset = (start.getDay() + 6) % 7
  gridStart.setDate(start.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const iso = toIsoDate(date)
    const dayTasks = tasks.value.filter((task) => task.due_date === iso)
    const avatars = uniqueProfiles(dayTasks)

    return {
      date,
      iso,
      tasks: dayTasks,
      avatars,
      currentMonth: date.getMonth() === calendarCursor.value.getMonth(),
      today: iso === todayIso.value
    }
  })
})

const selectedCalendarTasks = computed(() => tasks.value.filter((task) => task.due_date === selectedCalendarDate.value))
const weekdayLabels = computed(() => t('weekdays').split(','))
const settingsSections = computed<Array<{ key: SettingsSectionKey; label: string; icon: string }>>(() => [
  { key: 'profile', label: t('profile'), icon: 'bi-person' },
  { key: 'security', label: t('security'), icon: 'bi-shield-lock' },
  { key: 'appearance', label: t('appearance'), icon: 'bi-palette' },
  { key: 'account', label: t('account'), icon: 'bi-person-badge' }
])
const completedTaskFolders = computed(() => buildCompletedFolders(completedArchiveMode.value))
const selectedCompletedFolder = computed(() => {
  if (!selectedCompletedFolderId.value) return null
  return completedTaskFolders.value.find((folder) => folder.id === selectedCompletedFolderId.value) || null
})

function t(key: string) {
  return translate(currentLanguage.value, key)
}

function resetMessages() {
  errorMessage.value = ''
  noticeMessage.value = ''
}

function setTheme(mode: ThemeMode) {
  themeMode.value = mode
}

function goHome() {
  window.history.replaceState({}, '', '/')
  currentPath.value = '/'
}

function isOverdue(task: Task) {
  return Boolean(task.due_date && task.due_date < todayIso.value && task.status !== 'completed' && task.status !== 'canceled')
}

function taskDisplayStatus(task: Task): TaskStatus {
  return isOverdue(task) ? 'overdue' : task.status
}

function statusLabel(status: TaskStatus) {
  return t(status)
}

function getTaskCompletionDate(task: Task) {
  const source = task.completed_at || task.updated_at || task.created_at
  return source ? new Date(source) : null
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  return start
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function buildCompletedFolders(mode: CompletedArchiveMode) {
  const folders = new Map<
    string,
    {
      id: string
      label: string
      range: string
      count: number
      tasks: Task[]
      sortTime: number
    }
  >()

  completedTasks.value.forEach((task) => {
    const completedDate = getTaskCompletionDate(task)
    if (!completedDate || Number.isNaN(completedDate.getTime())) return

    const start = mode === 'week' ? startOfWeek(completedDate) : new Date(completedDate.getFullYear(), completedDate.getMonth(), 1)
    const end = mode === 'week' ? addDays(start, 6) : new Date(completedDate.getFullYear(), completedDate.getMonth() + 1, 0)
    const id = mode === 'week' ? `week-${toIsoDate(start)}` : `month-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
    const label =
      mode === 'week'
        ? `${formatDate(toIsoDate(start))} - ${formatDate(toIsoDate(end))}`
        : new Intl.DateTimeFormat(localeName.value, { month: 'long', year: 'numeric' }).format(start)
    const range = mode === 'week' ? t('weeklyFolder') : t('monthlyFolder')
    const existing = folders.get(id)

    if (existing) {
      existing.count += 1
      existing.tasks.push(task)
    } else {
      folders.set(id, {
        id,
        label,
        range,
        count: 1,
        tasks: [task],
        sortTime: start.getTime()
      })
    }
  })

  return [...folders.values()]
    .map((folder) => ({
      ...folder,
      tasks: [...folder.tasks].sort((a, b) => {
        const aTime = getTaskCompletionDate(a)?.getTime() || 0
        const bTime = getTaskCompletionDate(b)?.getTime() || 0
        return bTime - aTime
      })
    }))
    .sort((a, b) => b.sortTime - a.sortTime)
}

function showCancelReason(task: Task, event?: MouseEvent) {
  if (taskDisplayStatus(task) !== 'canceled') return
  event?.stopPropagation()
  showToast('info', `${t('cancelReason')}: ${task.cancel_reason || t('cancelReasonEmpty')}`)
}

function priorityLabel(priority: TaskPriority) {
  return t(priority)
}

function roleLabel(role?: UserRole | null) {
  return t(role || 'employee')
}

function formatDay(date: Date) {
  return formatDayNumber(date, localeName.value)
}

function getInitials(name?: string | null) {
  return getInitialsFromName(name, profile.value?.full_name || authForm.email || 'U')
}

function uniqueProfiles(dayTasks: Task[]) {
  const map = new Map<string, Profile | Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_url'>>()
  dayTasks.forEach((task) => {
    const fromTask = task.assignee
    const fromEmployees = task.assignee_id ? employeeMap.value.get(task.assignee_id) : null
    const assignee = fromTask || fromEmployees
    if (assignee?.id) map.set(assignee.id, assignee)
  })
  return [...map.values()].slice(0, 4)
}

function selectView(key: ViewKey) {
  activeView.value = key
  mobileMenuOpen.value = false
  profileMenuOpen.value = false
}

function selectSettingsSection(key: SettingsSectionKey) {
  activeSettingsSection.value = key
}

function setCompletedArchiveMode(mode: CompletedArchiveMode) {
  completedArchiveMode.value = mode
  selectedCompletedFolderId.value = null
}

function previousMonth() {
  calendarCursor.value = new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth() - 1, 1)
}

function nextMonth() {
  calendarCursor.value = new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth() + 1, 1)
}

function fillSettingsForm() {
  settingsForm.full_name = profile.value?.full_name || ''
  settingsForm.login = profile.value?.login_email || ''
  settingsForm.phone = profile.value?.phone || ''
  settingsForm.telegram_username = profile.value?.telegram_username || ''
  settingsForm.avatar_url = profile.value?.avatar_url || ''
  settingsForm.language = profile.value?.language || 'uz'
  settingsForm.performance_mode = 'balanced'
  settingsForm.password = ''
}

function resetTaskForm(task?: Task) {
  Object.assign(taskForm, {
    title: task?.title || '',
    description: task?.description || '',
    assignee_id: task?.assignee_id || (isManager.value ? assigneeOptions.value[0]?.id || '' : profile.value?.id || ''),
    priority: task?.priority || 'medium',
    status: task?.status || 'todo',
    due_date: task?.due_date || todayIso.value,
    checklistText: task?.checklist?.map((item) => item.title).join('\n') || ''
  })
  editingTaskId.value = task?.id || null
}

function resetEmployeeForm() {
  Object.assign(employeeForm, {
    full_name: '',
    login_email: '',
    password: '',
    phone: '',
    telegram_username: '',
    role: 'employee'
  })
  employeePasswordVisible.value = false
}

async function refreshData(options: { showLoader?: boolean; clearMessages?: boolean } = {}) {
  if (refreshPromise) return refreshPromise

  const showLoader = options.showLoader ?? false
  const clearMessages = options.clearMessages ?? false

  refreshPromise = (async () => {
    if (showLoader) loading.value = true
    else backgroundRefreshing.value = true
    if (clearMessages) resetMessages()

    try {
      profile.value = await loadProfile()
      fillSettingsForm()

      if (profile.value) {
        employees.value = await loadProfiles()
        tasks.value = await loadTasks()
        activity.value = await loadActivity()
        selectedTaskId.value = selectedTask.value?.id || null

        if (!isManager.value && activeView.value !== 'tasks' && activeView.value !== 'calendar' && activeView.value !== 'settings') {
          activeView.value = 'tasks'
        }
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : t('dataLoadError')
    } finally {
      if (showLoader) loading.value = false
      backgroundRefreshing.value = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function initializeAuth() {
  if (!isSupabaseConfigured) {
    loading.value = false
    sessionReady.value = true
    return
  }

  const { data } = await supabase.auth.getSession()
  isAuthenticated.value = Boolean(data.session)
  sessionReady.value = true

  supabase.auth.onAuthStateChange((_event, session) => {
    isAuthenticated.value = Boolean(session)
    if (session) refreshData({ showLoader: !profile.value })
    else loading.value = false
  })

  if (data.session) await refreshData({ showLoader: true })
  else loading.value = false
}

async function handleLogin() {
  resetMessages()
  if (normalizeLoginIdentifier(authForm.email).length < 1 || authForm.password.length < 1) {
    errorMessage.value = t('loginRequired')
    return
  }

  saving.value = true
  try {
    await signInWithPassword(authForm.email.trim().toLowerCase(), authForm.password)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('loginFailed')
  } finally {
    saving.value = false
  }
}

async function handleLogout() {
  await signOut()
  isAuthenticated.value = false
  profile.value = null
  tasks.value = []
  employees.value = []
}

async function submitTask() {
  resetMessages()
  if (!taskForm.title.trim()) {
    errorMessage.value = t('taskTitleRequired')
    return
  }
  if (!isManager.value) taskForm.assignee_id = profile.value?.id || ''
  if (!taskForm.assignee_id) {
    errorMessage.value = t('assigneeRequired')
    return
  }

  saving.value = true
  try {
    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      assignee_id: taskForm.assignee_id,
      priority: taskForm.priority,
      status: taskForm.status,
      due_date: taskForm.due_date || null,
      checklist: taskForm.checklistText.split('\n')
    }

    if (editingTaskId.value) await updateTask(editingTaskId.value, payload)
    else await createTask(payload)

    showTaskComposer.value = false
    noticeMessage.value = editingTaskId.value ? t('taskUpdated') : t('taskSaved')
    resetTaskForm()
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('taskCreateError')
  } finally {
    saving.value = false
  }
}

function startEditTask(task: Task) {
  resetMessages()
  taskActionMenuId.value = null
  activeView.value = 'tasks'
  showTaskComposer.value = true
  resetTaskForm(task)
}

async function submitEmployee() {
  resetMessages()
  if (!isManager.value) return

  if (!employeeForm.full_name.trim() || normalizeLoginIdentifier(employeeForm.login_email).length < 3 || employeeForm.password.length < 6) {
    errorMessage.value = t('employeeValidation')
    return
  }

  saving.value = true
  try {
    await createEmployee({
      ...employeeForm,
      full_name: employeeForm.full_name.trim(),
      login_email: normalizeLoginIdentifier(employeeForm.login_email),
      telegram_username: normalizeTelegramUsername(employeeForm.telegram_username || '')
    })
    noticeMessage.value = t('employeeCreated')
    showEmployeeComposer.value = false
    resetEmployeeForm()
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('employeeCreateError')
  } finally {
    saving.value = false
  }
}

async function changeStatus(task: Task, status: PersistedTaskStatus) {
  if (savingTaskIds.value.has(task.id)) return
  resetMessages()
  const previousTask = { ...task, checklist: task.checklist ? [...task.checklist] : [] }
  setTaskSaving(task.id, true)
  patchTask(task.id, {
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    cancel_reason: status === 'canceled' ? task.cancel_reason : status === 'todo' || status === 'in_progress' ? null : task.cancel_reason
  })

  try {
    const updatedTask = await updateTaskStatus(task, status)
    patchTask(task.id, updatedTask)
    loadActivity()
      .then((items) => {
        activity.value = items
      })
      .catch(() => undefined)
  } catch (error) {
    patchTask(task.id, previousTask)
    errorMessage.value = error instanceof Error ? error.message : t('statusError')
  } finally {
    setTaskSaving(task.id, false)
  }
}

function patchTask(taskId: string, patch: Partial<Task>) {
  tasks.value = tasks.value.map((currentTask) =>
    currentTask.id === taskId ? { ...currentTask, ...patch, checklist: currentTask.checklist } : currentTask
  )
}

function setTaskSaving(taskId: string, isSaving: boolean) {
  const next = new Set(savingTaskIds.value)
  if (isSaving) next.add(taskId)
  else next.delete(taskId)
  savingTaskIds.value = next
}

function isTaskSaving(task: Task) {
  return savingTaskIds.value.has(task.id)
}

function cancelTask(task: Task) {
  resetMessages()
  taskActionMenuId.value = null
  cancelDialogTask.value = task
  cancelReason.value = task.cancel_reason || ''
}

function closeCancelDialog() {
  cancelDialogTask.value = null
  cancelReason.value = ''
}

async function confirmCancelTask() {
  const task = cancelDialogTask.value
  if (!task) return

  const reason = cancelReason.value.trim()
  if (!reason) {
    errorMessage.value = t('cancelReasonRequired')
    return
  }

  resetMessages()
  saving.value = true
  setTaskSaving(task.id, true)
  try {
    const updatedTask = await updateTaskStatus(task, 'canceled', reason)
    patchTask(task.id, updatedTask)
    noticeMessage.value = t('taskCanceled')
    closeCancelDialog()
    loadActivity()
      .then((items) => {
        activity.value = items
      })
      .catch(() => undefined)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('cannotCancel')
  } finally {
    saving.value = false
    setTaskSaving(task.id, false)
  }
}

async function removeTask(task: Task) {
  resetMessages()
  taskActionMenuId.value = null

  try {
    await deleteTask(task.id)
    tasks.value = tasks.value.filter((currentTask) => currentTask.id !== task.id)
    await refreshData()
    noticeMessage.value = t('taskDeleted')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('taskDeleteError')
  }
}

async function toggleChecklist(itemId: string, checked: boolean) {
  try {
    await updateChecklistItem(itemId, checked)
    tasks.value = tasks.value.map((task) => ({
      ...task,
      checklist: task.checklist?.map((item) => (item.id === itemId ? { ...item, is_done: checked } : item)) || []
    }))
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('checklistError')
  }
}

async function saveSettings() {
  resetMessages()
  if (settingsForm.password.trim() && settingsForm.password.trim().length < 6) {
    errorMessage.value = t('passwordValidation')
    return
  }

  saving.value = true

  try {
    const nextLogin = normalizeLoginIdentifier(settingsForm.login || '')
    const loginChanged = nextLogin && nextLogin !== profile.value?.login_email
    if (loginChanged || settingsForm.password.trim()) {
      await updateAccountCredentials({
        login: loginChanged ? nextLogin : undefined,
        password: settingsForm.password.trim() || undefined
      })
    }

    profile.value = await upsertProfile({
      full_name: settingsForm.full_name.trim() || 'User',
      login_email: nextLogin || profile.value?.login_email || '',
      phone: settingsForm.phone.trim(),
      telegram_username: normalizeTelegramUsername(settingsForm.telegram_username || ''),
      avatar_url: settingsForm.avatar_url || null,
      language: settingsForm.language,
      performance_mode: 'balanced'
    })

    fillSettingsForm()
    noticeMessage.value = loginChanged ? t('loginUpdated') : t('profileSaved')
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('profileSaveError')
  } finally {
    saving.value = false
  }
}

function handleAvatarFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    settingsForm.avatar_url = String(reader.result || '')
  }
  reader.readAsDataURL(file)
  input.value = ''
}

onMounted(initializeAuth)

watch(activeView, (view) => {
  localStorage.setItem(STORAGE_KEYS.activeView, view)
})

watch(themeMode, (mode) => {
  localStorage.setItem(STORAGE_KEYS.theme, mode)
})

watch(noticeMessage, (message) => {
  if (message) showToast('success', message)
})

watch(errorMessage, (message) => {
  if (message) showToast('error', message)
})
</script>

<template>
  <main
    :class="['app-shell', `theme-${themeMode}`]">
    <ToastStack :toasts="toasts" @dismiss="dismissToast" />
    <CancelTaskModal
      v-model:reason="cancelReason"
      :task="cancelDialogTask"
      :saving="saving"
      :t="t"
      @close="closeCancelDialog"
      @confirm="confirmCancelTask"
    />
    <Transition name="fade">
      <button
        v-if="taskActionMenuId"
        class="task-menu-scrim"
        :aria-label="t('close')"
        @click="taskActionMenuId = null"
      ></button>
    </Transition>

    <section v-if="isNotFoundRoute" class="not-found-screen">
      <div class="not-found-panel">
        <span>404</span>
        <h1>{{ t('notFoundTitle') }}</h1>
        <p>{{ t('notFoundText') }}</p>
        <button class="primary-button fit" @click="goHome">
          <i class="bi bi-house-door"></i>
          {{ t('home') }}
        </button>
      </div>
    </section>

    <section v-else-if="!isSupabaseConfigured" class="auth-screen">
      <div class="auth-panel">
        <div class="brand-mark"><i class="bi bi-check2"></i></div>
        <h1>{{ t('supabaseMissingTitle') }}</h1>
        <p>{{ t('supabaseMissingText') }}</p>
        <code>cp .env.example .env</code>
      </div>
    </section>

    <section v-else-if="sessionReady && !isAuthenticated" class="auth-screen">
      <form class="auth-panel" @submit.prevent="handleLogin">
        <div class="brand-row center">
          <div class="brand-mark"><i class="bi bi-check2"></i></div>
          <strong>{{ t('appName') }}</strong>
        </div>
        <h1>{{ t('loginTitle') }}</h1>
        <p>{{ t('loginHelp') }}</p>

        <label>{{ t('email') }}</label>
        <input v-model="authForm.email" type="text" autocomplete="username" placeholder="ali.valiyev" />

        <label>{{ t('password') }}</label>
        <input v-model="authForm.password" type="password" autocomplete="current-password" placeholder="••••••••" />

        <button class="primary-button full" :disabled="saving">
          <i class="bi bi-box-arrow-in-right"></i>
          {{ saving ? '...' : t('signIn') }}
        </button>

      </form>
    </section>

    <template v-else>
      <aside :class="['sidebar', { 'is-open': mobileMenuOpen }]">
        <div class="brand-row">
          <div class="brand-mark"><i class="bi bi-check2"></i></div>
          <strong>{{ t('appName') }}</strong>
        </div>

        <nav class="nav-list">
          <button v-for="item in navItems" :key="item.key" :class="['nav-item', { active: activeView === item.key }]"
            @click="selectView(item.key)">
            <i :class="['bi', item.icon]"></i>
            {{ item.label }}
          </button>
        </nav>

        <div class="sidebar-profile">
          <div class="avatar">
            <img v-if="profile?.avatar_url" :src="profile.avatar_url" alt="" />
            <span v-else>{{ getInitials(profile?.full_name) }}</span>
          </div>
          <div>
            <strong>{{ profile?.full_name || 'User' }}</strong>
            <span>{{ roleLabel(profile?.role) }}</span>
          </div>
        </div>
      </aside>
      <Transition name="fade">
        <button v-if="mobileMenuOpen" class="sidebar-scrim" :aria-label="t('closeMenu')"
          @click="mobileMenuOpen = false"></button>
      </Transition>

      <section class="workspace">
        <header class="topbar">
          <button class="menu-button" @click="mobileMenuOpen = !mobileMenuOpen" :aria-label="t('menu')">
            <i class="bi bi-list"></i>
          </button>
          <div>
            <h1>{{ pageTitle }}</h1>
            <p>{{ pageDescription }}</p>
          </div>
          <div class="topbar-actions">
            <button class="profile-trigger" :aria-label="t('openProfileMenu')"
              @click="profileMenuOpen = !profileMenuOpen">
              <span class="avatar small">
                <img v-if="profile?.avatar_url" :src="profile.avatar_url" alt="" />
                <span v-else>{{ getInitials(profile?.full_name) }}</span>
              </span>
              <i class="bi bi-chevron-down"></i>
            </button>
            <Transition name="fade">
              <button v-if="profileMenuOpen" class="profile-menu-scrim" :aria-label="t('close')"
                @click="profileMenuOpen = false"></button>
            </Transition>
            <Transition name="panel-pop">
              <div v-if="profileMenuOpen" class="profile-menu">
                <div class="profile-menu-head">
                  <div class="avatar">
                    <img v-if="profile?.avatar_url" :src="profile.avatar_url" alt="" />
                    <span v-else>{{ getInitials(profile?.full_name) }}</span>
                  </div>
                  <div>
                    <strong>{{ profile?.full_name || 'User' }}</strong>
                    <span>{{ roleLabel(profile?.role) }}</span>
                  </div>
                </div>
                <button @click="selectView('settings')">
                  <i class="bi bi-gear"></i>
                  {{ t('settings') }}
                </button>
                <button @click="selectView('settings')">
                  <i class="bi bi-person"></i>
                  {{ t('profile') }}
                </button>
                <div class="profile-menu-theme">
                  <span>{{ t('theme') }}</span>
                  <div>
                    <button :class="{ active: themeMode === 'light' }" @click="setTheme('light')">{{ t('light')
                      }}</button>
                    <button :class="{ active: themeMode === 'dark' }" @click="setTheme('dark')">{{ t('dark') }}</button>
                  </div>
                </div>
                <button class="danger-text" @click="profileMenuOpen = false; handleLogout()">
                  <i class="bi bi-box-arrow-right"></i>
                  {{ t('logout') }}
                </button>
              </div>
            </Transition>
          </div>
        </header>

        <section v-if="loading" class="empty-state">{{ t('loading') }}</section>

        <Transition v-else name="view-slide" mode="out-in">
          <section v-if="activeView === 'dashboard' && isManager" key="dashboard" class="view-stack">
            <div class="metric-row">
              <div>
                <span>{{ t('active') }}</span>
                <strong>{{ activeTasks.length }}</strong>
              </div>
              <div>
                <span>{{ t('completed') }}</span>
                <strong>{{ completedTasks.length }}</strong>
              </div>
              <div>
                <span>{{ t('overdue') }}</span>
                <strong>{{ overdueTasks.length }}</strong>
              </div>
              <div>
                <span>{{ t('employees') }}</span>
                <strong>{{ employees.length }}</strong>
              </div>
            </div>

            <section class="panel dashboard-completed-panel">
              <div class="section-header">
                <div>
                  <h2>{{ t('completedArchive') }}</h2>
                  <p>{{ completedArchiveMode === 'week' ? t('weeklyCompletedHelp') : t('monthlyCompletedHelp') }}</p>
                </div>
                <div class="segmented-control">
                  <button
                    type="button"
                    :class="{ active: completedArchiveMode === 'week' }"
                    @click="setCompletedArchiveMode('week')"
                  >
                    {{ t('weekly') }}
                  </button>
                  <button
                    type="button"
                    :class="{ active: completedArchiveMode === 'month' }"
                    @click="setCompletedArchiveMode('month')"
                  >
                    {{ t('monthly') }}
                  </button>
                </div>
              </div>

              <template v-if="selectedCompletedFolder">
                <div class="folder-detail-head">
                  <button class="ghost-button fit" @click="selectedCompletedFolderId = null">
                    <i class="bi bi-arrow-left"></i>
                    {{ t('back') }}
                  </button>
                  <div>
                    <strong>{{ selectedCompletedFolder.label }}</strong>
                    <span>{{ selectedCompletedFolder.count }} {{ t('completedTasks') }}</span>
                  </div>
                </div>
                <div class="task-list compact-list">
                  <article v-for="task in selectedCompletedFolder.tasks" :key="task.id" class="task-row compact">
                    <span class="status-dot completed"></span>
                    <div class="task-main">
                      <strong class="done">{{ task.title }}</strong>
                      <span>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—' }}</span>
                    </div>
                    <StatusBadge :status="'completed'" :label="t('completed')" />
                    <span class="muted-text">{{ formatDate(task.due_date) }}</span>
                  </article>
                </div>
              </template>

              <div v-else-if="completedTaskFolders.length" class="folder-grid">
                <button
                  v-for="folder in completedTaskFolders"
                  :key="folder.id"
                  class="folder-card"
                  @click="selectedCompletedFolderId = folder.id"
                >
                  <i class="bi bi-folder-fill"></i>
                  <span>{{ folder.range }}</span>
                  <strong>{{ folder.label }}</strong>
                  <small>{{ folder.count }} {{ t('completedTasks') }}</small>
                </button>
              </div>

              <div v-else class="empty-state compact">{{ t('noCompletedArchive') }}</div>
            </section>

            <section class="panel">
              <div class="section-header">
                <h2>{{ t('tasks') }}</h2>
                <button class="link-button" @click="activeView = 'tasks'">
                  <i class="bi bi-arrow-right"></i>
                  {{ t('tasks') }}
                </button>
              </div>
              <div class="task-list">
                <article v-for="task in filteredTasks" :key="task.id"
                  :class="['task-row', { selected: selectedTask?.id === task.id }]" @click="selectedTaskId = task.id">
                  <button class="status-dot" :class="taskDisplayStatus(task)"
                    :disabled="isTaskSaving(task)"
                    @click.stop="changeStatus(task, task.status === 'completed' ? 'todo' : 'completed')"
                    :title="isTaskSaving(task) ? t('savingChanges') : statusLabel(taskDisplayStatus(task))">
                    <i v-if="isTaskSaving(task)" class="bi bi-arrow-repeat spin"></i>
                  </button>
                  <div class="task-main">
                    <strong :class="{ done: task.status === 'completed' }">{{ task.title }}</strong>
                    <span v-if="isTaskSaving(task)" class="status-saving-text">
                      <i class="bi bi-arrow-repeat spin"></i>{{ t('savingChanges') }}
                    </span>
                    <span v-else>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—'
                      }}</span>
                  </div>
                  <StatusBadge
                    :status="taskDisplayStatus(task)"
                    :label="statusLabel(taskDisplayStatus(task))"
                    :clickable="taskDisplayStatus(task) === 'canceled'"
                    @activate="showCancelReason(task, $event)"
                  />
                  <span>{{ formatDate(task.due_date) }}</span>
                </article>
              </div>
            </section>
          </section>

          <section v-else-if="activeView === 'tasks'" key="tasks" class="view-stack">
            <Transition name="panel-pop">
              <form v-if="showTaskComposer" class="panel form-panel" @submit.prevent="submitTask">
                <div class="section-header">
                  <h2>{{ editingTaskId ? t('editTask') : t('newTask') }}</h2>
                  <button type="button" class="ghost-button icon-only" @click="showTaskComposer = false"
                    :aria-label="t('close')">
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>

                <div class="form-grid">
                  <label>
                    {{ t('title') }}
                    <input v-model="taskForm.title" :placeholder="t('taskTitlePlaceholder')" />
                  </label>
                  <label v-if="isManager">
                    {{ t('assignee') }}
                    <select v-model="taskForm.assignee_id">
                      <option value="">—</option>
                      <option v-for="employee in assigneeOptions" :key="employee.id" :value="employee.id">
                        {{ employee.full_name || employee.login_email }}
                      </option>
                    </select>
                  </label>
                  <label>
                    {{ t('dueDate') }}
                    <input v-model="taskForm.due_date" type="date" />
                  </label>
                  <label>
                    {{ t('priority') }}
                    <select v-model="taskForm.priority">
                      <option value="low">{{ t('low') }}</option>
                      <option value="medium">{{ t('medium') }}</option>
                      <option value="high">{{ t('high') }}</option>
                    </select>
                  </label>
                </div>

                <label>
                  {{ t('description') }}
                  <textarea v-model="taskForm.description" rows="3"></textarea>
                </label>

                <label>
                  {{ t('checklist') }}
                  <textarea v-model="taskForm.checklistText" rows="4"
                    :placeholder="t('checklistPlaceholder')"></textarea>
                  <small class="field-help">{{ t('checklistHelp') }}</small>
                </label>

                <button class="primary-button fit" :disabled="saving">
                  <i class="bi bi-save"></i>
                  {{ saving ? '...' : editingTaskId ? t('editTask') : t('saveTask') }}
                </button>
              </form>
            </Transition>

            <div class="toolbar">
              <div class="search-box">
                <i class="bi bi-search"></i>
                <input v-model="searchQuery" :placeholder="t('search')" />
                <button v-if="searchQuery" type="button" :aria-label="t('close')" @click="searchQuery = ''">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
              <select v-model="statusFilter" class="filter-select">
                <option value="all">{{ t('all') }}</option>
                <option value="todo">{{ t('todo') }}</option>
                <option value="in_progress">{{ t('in_progress') }}</option>
                <option value="completed">{{ t('completed') }}</option>
                <option value="canceled">{{ t('canceled') }}</option>
                <option value="overdue">{{ t('overdue') }}</option>
              </select>
            </div>

            <div class="content-grid">
              <section class="panel task-table-panel">
                <div class="section-header">
                  <h2>{{ t('tasks') }}</h2>
                  <button class="link-button" @click="showTaskComposer = true; resetTaskForm()">
                    <i class="bi bi-plus-lg"></i>
                    {{ t('newTask') }}
                  </button>
                </div>

                <div v-if="!filteredTasks.length" class="empty-state">{{ t('noTasks') }}</div>
                <div v-else class="task-list">
                  <article v-for="task in filteredTasks" :key="task.id"
                    :class="['task-row', { selected: selectedTask?.id === task.id }]" @click="selectedTaskId = task.id">
                    <button class="status-dot" :class="taskDisplayStatus(task)"
                      :disabled="isTaskSaving(task)"
                      @click.stop="changeStatus(task, task.status === 'completed' ? 'todo' : 'completed')"
                      :title="isTaskSaving(task) ? t('savingChanges') : statusLabel(taskDisplayStatus(task))">
                      <i v-if="isTaskSaving(task)" class="bi bi-arrow-repeat spin"></i>
                    </button>
                    <div class="task-main">
                      <strong :class="{ done: task.status === 'completed' }">{{ task.title }}</strong>
                      <span v-if="isTaskSaving(task)" class="status-saving-text">
                        <i class="bi bi-arrow-repeat spin"></i>{{ t('savingChanges') }}
                      </span>
                      <span v-else>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—'
                        }}</span>
                    </div>
                    <StatusBadge
                      :status="taskDisplayStatus(task)"
                      :label="statusLabel(taskDisplayStatus(task))"
                      :clickable="taskDisplayStatus(task) === 'canceled'"
                      @activate="showCancelReason(task, $event)"
                    />
                    <span class="muted-text">{{ formatDate(task.due_date) }}</span>
                    <button class="ghost-button icon-only"
                      @click.stop="taskActionMenuId = taskActionMenuId === task.id ? null : task.id"
                      :aria-label="t('actions')">
                      <i class="bi bi-three-dots"></i>
                    </button>
                    <Transition name="task-menu">
                      <div v-if="taskActionMenuId === task.id" class="task-actions-menu" @click.stop>
                        <button @click="startEditTask(task)"><i class="bi bi-pencil"></i>{{ t('editTask') }}</button>
                        <button @click="cancelTask(task)"><i class="bi bi-x-circle"></i>{{ t('cancelTask') }}</button>
                        <button class="danger-text" @click="removeTask(task)"><i class="bi bi-trash3"></i>{{ t('delete')
                          }}</button>
                      </div>
                    </Transition>
                  </article>
                </div>
              </section>

              <aside class="panel detail-panel">
                <template v-if="selectedTask">
                  <div class="section-header clean">
                    <h2>{{ selectedTask.title }}</h2>
                    <StatusBadge
                      :status="taskDisplayStatus(selectedTask)"
                      :label="statusLabel(taskDisplayStatus(selectedTask))"
                      :clickable="taskDisplayStatus(selectedTask) === 'canceled'"
                      @activate="showCancelReason(selectedTask, $event)"
                    />
                  </div>

                  <dl class="detail-list">
                    <div>
                      <dt>{{ t('assignee') }}</dt>
                      <dd>{{ selectedTask.assignee?.full_name || employeeMap.get(selectedTask.assignee_id ||
                        '')?.full_name || '—' }}</dd>
                    </div>
                    <div>
                      <dt>{{ t('dueDate') }}</dt>
                      <dd>{{ formatDate(selectedTask.due_date) }}</dd>
                    </div>
                    <div>
                      <dt>{{ t('priority') }}</dt>
                      <dd>{{ priorityLabel(selectedTask.priority) }}</dd>
                    </div>
                  </dl>

                  <p class="description-text">{{ selectedTask.description || '—' }}</p>

                  <div class="status-actions">
                    <button class="ghost-button" :disabled="isTaskSaving(selectedTask)" @click="changeStatus(selectedTask, 'todo')">{{ t('todo') }}</button>
                    <button class="ghost-button" :disabled="isTaskSaving(selectedTask)" @click="changeStatus(selectedTask, 'in_progress')">{{ t('in_progress')
                      }}</button>
                    <button class="primary-button fit" :disabled="isTaskSaving(selectedTask)" @click="changeStatus(selectedTask, 'completed')">{{
                      isTaskSaving(selectedTask) ? t('savingChanges') : t('completed') }}</button>
                    <button class="ghost-button danger-text" :disabled="isTaskSaving(selectedTask)" @click="cancelTask(selectedTask)">{{ t('cancelTask')
                      }}</button>
                  </div>

                  <div v-if="selectedTask.checklist?.length" class="checklist-list">
                    <label v-for="item in selectedTask.checklist" :key="item.id" class="checklist-item">
                      <input :checked="item.is_done" type="checkbox"
                        @change="toggleChecklist(item.id, !item.is_done)" />
                      <span :class="{ done: item.is_done }">{{ item.title }}</span>
                    </label>
                  </div>
                </template>

                <div v-else class="empty-state">{{ t('noTasks') }}</div>
              </aside>
            </div>
          </section>

          <section v-else-if="activeView === 'employees' && isManager" key="employees" class="view-stack">
            <Transition name="panel-pop">
              <form v-if="showEmployeeComposer" class="panel form-panel employee-form" @submit.prevent="submitEmployee">
                <div class="section-header">
                  <h2>{{ t('createEmployee') }}</h2>
                  <button type="button" class="ghost-button icon-only" @click="showEmployeeComposer = false"
                    :aria-label="t('close')">
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>

                <div class="form-grid">
                  <label>
                    {{ t('fullName') }}
                    <input v-model="employeeForm.full_name" :placeholder="t('fullNamePlaceholder')" />
                  </label>
                  <label>
                    {{ t('email') }}
                    <input v-model="employeeForm.login_email" type="text" autocomplete="username"
                      placeholder="ali.valiyev" />
                  </label>
                  <label>
                    {{ t('password') }}
                    <div class="password-field">
                      <input v-model="employeeForm.password" :type="employeePasswordVisible ? 'text' : 'password'"
                        autocomplete="new-password" :placeholder="t('passwordMinPlaceholder')" />
                      <button type="button" class="password-toggle"
                        :aria-label="employeePasswordVisible ? t('hidePassword') : t('showPassword')"
                        @click="employeePasswordVisible = !employeePasswordVisible">
                        <i :class="['bi', employeePasswordVisible ? 'bi-eye-slash' : 'bi-eye']"></i>
                      </button>
                    </div>
                  </label>
                  <label>
                    {{ t('role') }}
                    <select v-model="employeeForm.role">
                      <option value="employee">{{ t('employee') }}</option>
                      <option value="manager">{{ t('manager') }}</option>
                    </select>
                  </label>
                  <label>
                    {{ t('phone') }}
                    <input v-model="employeeForm.phone" placeholder="+998901234567" />
                  </label>
                  <label>
                    {{ t('telegram') }}
                    <input v-model="employeeForm.telegram_username" placeholder="@username" />
                  </label>
                </div>

                <button class="primary-button fit" :disabled="saving">
                  <i class="bi bi-person-plus"></i>
                  {{ saving ? '...' : t('createEmployee') }}
                </button>
              </form>
            </Transition>

            <section class="panel employees-panel">
              <div class="section-header">
                <h2>{{ t('employees') }}</h2>
                <button v-if="!showEmployeeComposer" class="primary-button fit"
                  @click="showEmployeeComposer = true; resetEmployeeForm()">
                  <i class="bi bi-person-plus"></i>
                  {{ t('createEmployee') }}
                </button>
              </div>

              <div v-if="!employees.length" class="empty-state">{{ t('noEmployees') }}</div>
              <div v-else class="employee-table">
                <article v-for="employee in employees" :key="employee.id" class="employee-row">
                  <div class="employee-identity">
                    <div class="avatar small">
                      <img v-if="employee.avatar_url" :src="employee.avatar_url" alt="" />
                      <span v-else>{{ getInitials(employee.full_name) }}</span>
                    </div>
                    <div>
                      <strong>{{ employee.full_name || employee.login_email || '—' }}</strong>
                      <span><i class="bi bi-person"></i>{{ employee.login_email || '—' }}</span>
                    </div>
                  </div>
                  <span class="role-pill">{{ roleLabel(employee.role) }}</span>
                  <span class="employee-contact"><i class="bi bi-telephone"></i>{{ employee.phone || '—' }}</span>
                  <span class="employee-contact"><i class="bi bi-telegram"></i>{{
                    displayTelegram(employee.telegram_username)
                    }}</span>
                </article>
              </div>
            </section>
          </section>

          <section v-else-if="activeView === 'calendar'" key="calendar" class="calendar-layout">
            <section class="panel">
              <div class="section-header">
                <button class="ghost-button icon-only" @click="previousMonth" :aria-label="t('previousMonth')">
                  <i class="bi bi-chevron-left"></i>
                </button>
                <h2>{{ calendarTitle }}</h2>
                <button class="ghost-button icon-only" @click="nextMonth" :aria-label="t('nextMonth')">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </div>

              <div class="weekday-row">
                <span v-for="dayLabel in weekdayLabels" :key="dayLabel">{{ dayLabel }}</span>
              </div>

              <div class="calendar-grid">
                <button v-for="day in calendarDays" :key="day.iso"
                  :class="['calendar-day', { muted: !day.currentMonth, today: day.today, selected: selectedCalendarDate === day.iso }]"
                  @click="selectedCalendarDate = day.iso">
                  <span>{{ formatDay(day.date) }}</span>
                  <div class="calendar-avatars">
                    <span v-for="employee in day.avatars" :key="employee.id" class="avatar micro">
                      {{ getInitials(employee.full_name) }}
                    </span>
                  </div>
                  <small v-if="day.tasks.length">{{ day.tasks.length }}</small>
                </button>
              </div>
            </section>

            <aside class="panel detail-panel">
              <div class="section-header clean">
                <h2>{{ formatDate(selectedCalendarDate) }}</h2>
              </div>

              <div v-if="!selectedCalendarTasks.length" class="empty-state compact">{{ t('calendarEmpty') }}</div>
              <div v-else class="day-task-list">
                <article v-for="task in selectedCalendarTasks" :key="task.id"
                  @click="selectedTaskId = task.id; activeView = 'tasks'">
                  <div class="avatar small">{{ getInitials(task.assignee?.full_name || employeeMap.get(task.assignee_id
                    ||
                    '')?.full_name) }}</div>
                  <div>
                    <strong>{{ task.title }}</strong>
                    <span>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—'
                      }}</span>
                  </div>
                  <StatusBadge
                    :status="taskDisplayStatus(task)"
                    :label="statusLabel(taskDisplayStatus(task))"
                    :clickable="taskDisplayStatus(task) === 'canceled'"
                    @activate="showCancelReason(task, $event)"
                  />
                </article>
              </div>
            </aside>
          </section>

          <section v-else-if="activeView === 'settings'" key="settings" class="settings-catalog-layout">
            <aside class="panel settings-index">
              <strong>{{ t('settings') }}</strong>
              <button
                v-for="section in settingsSections"
                :key="section.key"
                type="button"
                :class="{ active: activeSettingsSection === section.key }"
                @click="selectSettingsSection(section.key)"
              >
                <i :class="['bi', section.icon]"></i>{{ section.label }}
              </button>
            </aside>

            <form class="settings-sections" @submit.prevent="saveSettings">
              <section v-if="activeSettingsSection === 'profile'" class="panel settings-card">
                <div class="settings-card-head">
                  <i class="bi bi-person"></i>
                  <div>
                    <h2>{{ t('profile') }}</h2>
                    <p>{{ t('settingsDescription') }}</p>
                  </div>
                </div>
                <div class="avatar-uploader">
                  <div class="avatar-preview">
                    <img v-if="settingsForm.avatar_url" :src="settingsForm.avatar_url" alt="" />
                    <span v-else>{{ getInitials(settingsForm.full_name) }}</span>
                  </div>
                  <div>
                    <strong>{{ t('profileImage') }}</strong>
                    <p>{{ t('profileImageHelp') }}</p>
                    <div class="avatar-actions">
                      <label class="primary-button fit">
                        <i class="bi bi-image"></i>
                        {{ t('changeImage') }}
                        <input type="file" accept="image/*" @change="handleAvatarFile" />
                      </label>
                      <button type="button" class="ghost-button fit" @click="settingsForm.avatar_url = ''">
                        <i class="bi bi-x-circle"></i>
                        {{ t('removeImage') }}
                      </button>
                    </div>
                  </div>
                </div>
                <div class="form-grid">
                  <label>
                    {{ t('fullName') }}
                    <input v-model="settingsForm.full_name" />
                  </label>
                  <label>
                    {{ t('email') }}
                    <input v-model="settingsForm.login" autocomplete="username" />
                  </label>
                  <label>
                    {{ t('phone') }}
                    <input v-model="settingsForm.phone" placeholder="+998901234567" />
                  </label>
                  <label>
                    {{ t('telegram') }}
                    <input v-model="settingsForm.telegram_username" placeholder="@username" />
                  </label>
                </div>
              </section>

              <section v-else-if="activeSettingsSection === 'security'" class="panel settings-card">
                <div class="settings-card-head">
                  <i class="bi bi-shield-lock"></i>
                  <div>
                    <h2>{{ t('security') }}</h2>
                    <p>{{ t('passwordValidation') }}</p>
                  </div>
                </div>
                <label>
                  {{ t('password') }}
                  <div class="password-field">
                    <input v-model="settingsForm.password" :type="settingsPasswordVisible ? 'text' : 'password'"
                      autocomplete="new-password" :placeholder="t('newPasswordPlaceholder')" />
                    <button type="button" class="password-toggle"
                      :aria-label="settingsPasswordVisible ? t('hidePassword') : t('showPassword')"
                      @click="settingsPasswordVisible = !settingsPasswordVisible">
                      <i :class="['bi', settingsPasswordVisible ? 'bi-eye-slash' : 'bi-eye']"></i>
                    </button>
                  </div>
                </label>
              </section>

              <section v-else-if="activeSettingsSection === 'appearance'" class="panel settings-card">
                <div class="settings-card-head">
                  <i class="bi bi-palette"></i>
                  <div>
                    <h2>{{ t('appearance') }}</h2>
                    <p>{{ t('language') }} / {{ t('theme') }}</p>
                  </div>
                </div>
                <div class="form-grid">
                  <label>
                    {{ t('language') }}
                    <select v-model="settingsForm.language">
                      <option value="uz">{{ t('languageUzbek') }}</option>
                      <option value="ru">{{ t('languageRussian') }}</option>
                      <option value="uz_cyrl">{{ t('languageCyrillic') }}</option>
                    </select>
                  </label>
                  <label>
                    {{ t('theme') }}
                    <select v-model="themeMode">
                      <option value="light">{{ t('light') }}</option>
                      <option value="dark">{{ t('dark') }}</option>
                    </select>
                  </label>
                </div>
              </section>

              <section v-else class="panel settings-card account-card">
                <div class="profile-heading">
                  <div class="avatar large">
                    <img v-if="profile?.avatar_url" :src="profile.avatar_url" alt="" />
                    <span v-else>{{ getInitials(profile?.full_name) }}</span>
                  </div>
                  <div>
                    <h2>{{ profile?.full_name || 'User' }}</h2>
                    <p><i class="bi bi-person-badge"></i>{{ roleLabel(profile?.role) }}</p>
                  </div>
                </div>
                <dl class="detail-list">
                  <div>
                    <dt>{{ t('email') }}</dt>
                    <dd><i class="bi bi-person"></i>{{ profile?.login_email || '—' }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('telegram') }}</dt>
                    <dd><i class="bi bi-telegram"></i>{{ displayTelegram(profile?.telegram_username) }}</dd>
                  </div>
                </dl>
              </section>

              <div class="panel settings-footer">
                <button class="primary-button fit" :disabled="saving">
                  <i class="bi bi-save"></i>
                  {{ saving ? '...' : t('saveProfile') }}
                </button>
                <button type="button" class="ghost-button" @click="handleLogout">
                  <i class="bi bi-box-arrow-right"></i>
                  {{ t('logout') }}
                </button>
              </div>
            </form>
          </section>
        </Transition>
      </section>
    </template>
  </main>
</template>
