<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
  updateChecklistItem,
  updatePassword,
  updateTaskStatus,
  upsertProfile
} from './services/taskService'
import type {
  ActivityItem,
  AppLanguage,
  EmployeeCreatePayload,
  PerformanceMode,
  PersistedTaskStatus,
  Profile,
  Task,
  TaskPriority,
  TaskStatus,
  UserRole
} from './types'

type ViewKey = 'dashboard' | 'tasks' | 'employees' | 'calendar' | 'settings'
type StatusFilter = 'all' | PersistedTaskStatus | 'overdue'

const copy: Record<AppLanguage, Record<string, string>> = {
  uz: {
    appName: 'Task Manager',
    loginTitle: 'Tizimga kirish',
    loginHelp: 'Rahbar bergan login va parol bilan kiring.',
    email: 'Login',
    password: 'Parol',
    signIn: 'Kirish',
    dashboard: 'Dashboard',
    tasks: 'Vazifalar',
    employees: 'Xodimlar',
    calendar: 'Kalendar',
    settings: 'Sozlamalar',
    newTask: 'Yangi vazifa',
    saveTask: 'Vazifani saqlash',
    createEmployee: 'Xodim yaratish',
    saveProfile: 'Profilni saqlash',
    search: 'Qidirish',
    refresh: 'Yangilash',
    logout: 'Chiqish',
    today: 'Bugun',
    active: 'Faol',
    completed: 'Bajarilgan',
    overdue: 'Kechikkan',
    assignee: 'Biriktirilgan',
    dueDate: 'Muddat',
    priority: 'Ustuvorlik',
    status: 'Status',
    title: 'Vazifa nomi',
    description: 'Izoh',
    checklist: 'Checklist',
    fullName: 'Ism familiya',
    phone: 'Telefon',
    telegram: 'Telegram username',
    role: 'Rol',
    language: 'Til',
    performance: 'Performance',
    balanced: 'Standart',
    compact: 'Tezkor',
    employee: 'Xodim',
    manager: 'Manager',
    todo: 'Boshlanmagan',
    in_progress: 'Jarayonda',
    low: 'Past',
    medium: 'O‘rta',
    high: 'Yuqori',
    noTasks: 'Vazifa topilmadi',
    noEmployees: 'Xodim topilmadi',
    calendarEmpty: 'Bu kunda vazifa yo‘q'
  },
  ru: {
    appName: 'Task Manager',
    loginTitle: 'Вход',
    loginHelp: 'Войдите с логином и паролем от руководителя.',
    email: 'Логин',
    password: 'Пароль',
    signIn: 'Войти',
    dashboard: 'Обзор',
    tasks: 'Задачи',
    employees: 'Сотрудники',
    calendar: 'Календарь',
    settings: 'Настройки',
    newTask: 'Новая задача',
    saveTask: 'Сохранить задачу',
    createEmployee: 'Создать сотрудника',
    saveProfile: 'Сохранить профиль',
    search: 'Поиск',
    refresh: 'Обновить',
    logout: 'Выйти',
    today: 'Сегодня',
    active: 'Активные',
    completed: 'Готово',
    overdue: 'Просрочено',
    assignee: 'Исполнитель',
    dueDate: 'Срок',
    priority: 'Приоритет',
    status: 'Статус',
    title: 'Название задачи',
    description: 'Описание',
    checklist: 'Checklist',
    fullName: 'ФИО',
    phone: 'Телефон',
    telegram: 'Telegram username',
    role: 'Роль',
    language: 'Язык',
    performance: 'Performance',
    balanced: 'Стандарт',
    compact: 'Быстрый',
    employee: 'Сотрудник',
    manager: 'Менеджер',
    todo: 'К выполнению',
    in_progress: 'В работе',
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    noTasks: 'Задачи не найдены',
    noEmployees: 'Сотрудники не найдены',
    calendarEmpty: 'На этот день задач нет'
  },
  uz_cyrl: {
    appName: 'Task Manager',
    loginTitle: 'Тизимга кириш',
    loginHelp: 'Раҳбар берган логин ва пароль билан киринг.',
    email: 'Логин',
    password: 'Пароль',
    signIn: 'Кириш',
    dashboard: 'Dashboard',
    tasks: 'Вазифалар',
    employees: 'Ходимлар',
    calendar: 'Календар',
    settings: 'Созламалар',
    newTask: 'Янги вазифа',
    saveTask: 'Вазифани сақлаш',
    createEmployee: 'Ходим яратиш',
    saveProfile: 'Профилни сақлаш',
    search: 'Қидириш',
    refresh: 'Янгилаш',
    logout: 'Чиқиш',
    today: 'Бугун',
    active: 'Фаол',
    completed: 'Бажарилган',
    overdue: 'Кечиккан',
    assignee: 'Бириктирилган',
    dueDate: 'Муддат',
    priority: 'Устуворлик',
    status: 'Статус',
    title: 'Вазифа номи',
    description: 'Изоҳ',
    checklist: 'Checklist',
    fullName: 'Исм фамилия',
    phone: 'Телефон',
    telegram: 'Telegram username',
    role: 'Рол',
    language: 'Тил',
    performance: 'Performance',
    balanced: 'Стандарт',
    compact: 'Тезкор',
    employee: 'Ходим',
    manager: 'Manager',
    todo: 'Бошланмаган',
    in_progress: 'Жараёнда',
    low: 'Паст',
    medium: 'Ўрта',
    high: 'Юқори',
    noTasks: 'Вазифа топилмади',
    noEmployees: 'Ходим топилмади',
    calendarEmpty: 'Бу кунда вазифа йўқ'
  }
}

const activeView = ref<ViewKey>('dashboard')
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
const selectedCalendarDate = ref(toIsoDate(new Date()))
const calendarCursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

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
  phone: '',
  telegram_username: '',
  language: 'uz' as AppLanguage,
  performance_mode: 'balanced' as PerformanceMode,
  password: ''
})

const isManager = computed(() => profile.value?.role === 'manager')
const isNotFoundRoute = computed(() => !['/', '/index.html'].includes(currentPath.value))
const currentLanguage = computed<AppLanguage>(() => settingsForm.language || profile.value?.language || 'uz')
const todayIso = computed(() => toIsoDate(new Date()))
const activeTasks = computed(() => tasks.value.filter((task) => task.status !== 'completed'))
const completedTasks = computed(() => tasks.value.filter((task) => task.status === 'completed'))
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
    list = list.filter((task) => {
      const assignee = task.assignee?.full_name || employeeMap.value.get(task.assignee_id || '')?.full_name || ''
      return [task.title, task.description, assignee]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
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
  if (activeView.value === 'employees') return 'Login, rol, telefon va Telegram ma’lumotlari.'
  if (activeView.value === 'calendar') return 'Kunlar bo‘yicha biriktirilgan vazifalar.'
  if (activeView.value === 'settings') return 'Profil, til va ishlash rejimi.'
  if (isManager.value) return 'Xodimlarga biriktirilgan vazifalar holati.'
  return 'Sizga biriktirilgan vazifalar.'
})

const calendarTitle = computed(() => {
  return new Intl.DateTimeFormat(localeName.value, { month: 'long', year: 'numeric' }).format(calendarCursor.value)
})

const localeName = computed(() => {
  if (currentLanguage.value === 'ru') return 'ru-RU'
  if (currentLanguage.value === 'uz_cyrl') return 'uz-Cyrl-UZ'
  return 'uz-UZ'
})

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

function t(key: string) {
  return copy[currentLanguage.value]?.[key] || copy.uz[key] || key
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resetMessages() {
  errorMessage.value = ''
  noticeMessage.value = ''
}

function goHome() {
  window.history.replaceState({}, '', '/')
  currentPath.value = '/'
}

function isOverdue(task: Task) {
  return Boolean(task.due_date && task.due_date < todayIso.value && task.status !== 'completed')
}

function taskDisplayStatus(task: Task): TaskStatus {
  return isOverdue(task) ? 'overdue' : task.status
}

function statusLabel(status: TaskStatus) {
  return t(status)
}

function priorityLabel(priority: TaskPriority) {
  return t(priority)
}

function roleLabel(role?: UserRole | null) {
  return t(role || 'employee')
}

function formatDate(date: string | null) {
  if (!date) return '—'
  return new Intl.DateTimeFormat(localeName.value, { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T00:00:00`)
  )
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat(localeName.value, { day: '2-digit' }).format(date)
}

function getInitials(name?: string | null) {
  const clean = name || profile.value?.full_name || authForm.email || 'U'
  return clean
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
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

function displayTelegram(username?: string | null) {
  return username ? `@${username.replace(/^@+/, '')}` : '—'
}

function selectView(key: ViewKey) {
  activeView.value = key
  mobileMenuOpen.value = false
}

function previousMonth() {
  calendarCursor.value = new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth() - 1, 1)
}

function nextMonth() {
  calendarCursor.value = new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth() + 1, 1)
}

function fillSettingsForm() {
  settingsForm.full_name = profile.value?.full_name || ''
  settingsForm.phone = profile.value?.phone || ''
  settingsForm.telegram_username = profile.value?.telegram_username || ''
  settingsForm.language = profile.value?.language || 'uz'
  settingsForm.performance_mode = profile.value?.performance_mode || 'balanced'
  settingsForm.password = ''
}

function resetTaskForm() {
  Object.assign(taskForm, {
    title: '',
    description: '',
    assignee_id: assigneeOptions.value[0]?.id || '',
    priority: 'medium',
    status: 'todo',
    due_date: todayIso.value,
    checklistText: ''
  })
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
      errorMessage.value = error instanceof Error ? error.message : 'Data loading failed'
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
    errorMessage.value = 'Login va parolni kiriting.'
    return
  }

  saving.value = true
  try {
    await signInWithPassword(authForm.email.trim().toLowerCase(), authForm.password)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed'
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
  if (!isManager.value) return
  if (!taskForm.title.trim()) {
    errorMessage.value = 'Vazifa nomini kiriting.'
    return
  }
  if (!taskForm.assignee_id) {
    errorMessage.value = 'Xodimni tanlang.'
    return
  }

  saving.value = true
  try {
    await createTask({
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      assignee_id: taskForm.assignee_id,
      priority: taskForm.priority,
      status: taskForm.status,
      due_date: taskForm.due_date || null,
      checklist: taskForm.checklistText.split('\n')
    })
    showTaskComposer.value = false
    noticeMessage.value = 'Vazifa saqlandi.'
    resetTaskForm()
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Vazifa yaratishda xatolik.'
  } finally {
    saving.value = false
  }
}

async function submitEmployee() {
  resetMessages()
  if (!isManager.value) return

  if (!employeeForm.full_name.trim() || normalizeLoginIdentifier(employeeForm.login_email).length < 3 || employeeForm.password.length < 6) {
    errorMessage.value = 'Ism, login va kamida 6 belgili parol kiriting.'
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
    noticeMessage.value = 'Xodim yaratildi.'
    showEmployeeComposer.value = false
    resetEmployeeForm()
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Xodim yaratishda xatolik.'
  } finally {
    saving.value = false
  }
}

async function changeStatus(task: Task, status: PersistedTaskStatus) {
  resetMessages()
  try {
    const updatedTask = await updateTaskStatus(task, status)
    tasks.value = tasks.value.map((currentTask) =>
      currentTask.id === task.id ? { ...currentTask, ...updatedTask, checklist: currentTask.checklist } : currentTask
    )
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Status o‘zgarmadi.'
  }
}

async function removeTask(task: Task) {
  resetMessages()
  if (!isManager.value) return

  try {
    await deleteTask(task.id)
    tasks.value = tasks.value.filter((currentTask) => currentTask.id !== task.id)
    await refreshData()
    noticeMessage.value = 'Vazifa o‘chirildi.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Vazifa o‘chirishda xatolik.'
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
    errorMessage.value = error instanceof Error ? error.message : 'Checklist yangilanmadi.'
  }
}

async function saveSettings() {
  resetMessages()
  if (settingsForm.password.trim() && settingsForm.password.trim().length < 6) {
    errorMessage.value = 'Yangi parol kamida 6 belgidan iborat bo‘lishi kerak.'
    return
  }

  saving.value = true

  try {
    profile.value = await upsertProfile({
      full_name: settingsForm.full_name.trim() || 'User',
      phone: settingsForm.phone.trim(),
      telegram_username: normalizeTelegramUsername(settingsForm.telegram_username || ''),
      language: settingsForm.language,
      performance_mode: settingsForm.performance_mode
    })

    if (settingsForm.password.trim()) await updatePassword(settingsForm.password.trim())

    fillSettingsForm()
    noticeMessage.value = 'Profil saqlandi.'
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Profil saqlanmadi.'
  } finally {
    saving.value = false
  }
}

onMounted(initializeAuth)
</script>

<template>
  <main :class="['app-shell', settingsForm.performance_mode === 'compact' && 'performance-compact']">
    <section v-if="isNotFoundRoute" class="not-found-screen">
      <div class="not-found-panel">
        <span>404</span>
        <h1>Sahifa topilmadi</h1>
        <p>Bu manzil mavjud emas yoki foydalanuvchi sahifasi sifatida ochilmaydi.</p>
        <button class="primary-button fit" @click="goHome">
          <i class="bi bi-house-door"></i>
          Bosh sahifa
        </button>
      </div>
    </section>

    <section v-else-if="!isSupabaseConfigured" class="auth-screen">
      <div class="auth-panel">
        <div class="brand-mark"><i class="bi bi-check2"></i></div>
        <h1>Supabase sozlanmagan</h1>
        <p>.env faylga VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY qiymatlarini kiriting.</p>
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

        <Transition name="message-slide">
          <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>
        </Transition>
      </form>
    </section>

    <template v-else>
      <aside :class="['sidebar', { 'is-open': mobileMenuOpen }]">
        <div class="brand-row">
          <div class="brand-mark"><i class="bi bi-check2"></i></div>
          <strong>{{ t('appName') }}</strong>
        </div>

        <nav class="nav-list">
          <button
            v-for="item in navItems"
            :key="item.key"
            :class="['nav-item', { active: activeView === item.key }]"
            @click="selectView(item.key)"
          >
            <i :class="['bi', item.icon]"></i>
            {{ item.label }}
          </button>
        </nav>

        <div class="sidebar-profile">
          <div class="avatar">{{ getInitials(profile?.full_name) }}</div>
          <div>
            <strong>{{ profile?.full_name || 'User' }}</strong>
            <span>{{ roleLabel(profile?.role) }}</span>
          </div>
        </div>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <button class="menu-button" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="Menu">
            <i class="bi bi-list"></i>
          </button>
          <div>
            <h1>{{ pageTitle }}</h1>
            <p>{{ pageDescription }}</p>
          </div>
          <div class="topbar-actions">
            <button v-if="isManager" class="primary-button" @click="activeView = 'tasks'; showTaskComposer = true; resetTaskForm()">
              <i class="bi bi-plus-lg"></i>
              {{ t('newTask') }}
            </button>
            <button
              class="ghost-button icon-only"
              :disabled="backgroundRefreshing"
              @click="refreshData({ clearMessages: true })"
              :title="t('refresh')"
            >
              <i :class="['bi', backgroundRefreshing ? 'bi-arrow-repeat spin' : 'bi-arrow-clockwise']"></i>
            </button>
          </div>
        </header>

        <Transition name="message-slide">
          <div v-if="noticeMessage" class="message success">{{ noticeMessage }}</div>
        </Transition>
        <Transition name="message-slide">
          <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>
        </Transition>

        <section v-if="loading" class="empty-state">Loading...</section>

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

            <section class="panel">
              <div class="section-header">
                <h2>{{ t('tasks') }}</h2>
                <button class="link-button" @click="activeView = 'tasks'">
                  <i class="bi bi-arrow-right"></i>
                  {{ t('tasks') }}
                </button>
              </div>
              <div class="task-list">
                <article
                  v-for="task in filteredTasks"
                  :key="task.id"
                  :class="['task-row', { selected: selectedTask?.id === task.id }]"
                  @click="selectedTaskId = task.id"
                >
                  <button
                    class="status-dot"
                    :class="taskDisplayStatus(task)"
                    @click.stop="changeStatus(task, task.status === 'completed' ? 'todo' : 'completed')"
                    :title="statusLabel(taskDisplayStatus(task))"
                  ></button>
                  <div class="task-main">
                    <strong :class="{ done: task.status === 'completed' }">{{ task.title }}</strong>
                    <span>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—' }}</span>
                  </div>
                  <span :class="['status-pill', taskDisplayStatus(task)]">{{ statusLabel(taskDisplayStatus(task)) }}</span>
                  <span>{{ formatDate(task.due_date) }}</span>
                </article>
              </div>
            </section>
          </section>

          <section v-else-if="activeView === 'tasks'" key="tasks" class="view-stack">
            <Transition name="panel-pop">
              <form v-if="isManager && showTaskComposer" class="panel form-panel" @submit.prevent="submitTask">
              <div class="section-header">
                <h2>{{ t('newTask') }}</h2>
                <button type="button" class="ghost-button icon-only" @click="showTaskComposer = false" aria-label="Yopish">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>

              <div class="form-grid">
                <label>
                  {{ t('title') }}
                  <input v-model="taskForm.title" placeholder="CRM hisobotini tayyorlash" />
                </label>
                <label>
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
                <textarea v-model="taskForm.checklistText" rows="3" placeholder="Har qator bitta item"></textarea>
              </label>

              <button class="primary-button fit" :disabled="saving">
                <i class="bi bi-save"></i>
                {{ saving ? '...' : t('saveTask') }}
              </button>
              </form>
            </Transition>

            <div class="toolbar">
              <div class="search-box">
                <i class="bi bi-search"></i>
                <input v-model="searchQuery" :placeholder="t('search')" />
              </div>
              <select v-model="statusFilter" class="filter-select">
                <option value="all">All</option>
                <option value="todo">{{ t('todo') }}</option>
                <option value="in_progress">{{ t('in_progress') }}</option>
                <option value="completed">{{ t('completed') }}</option>
                <option value="overdue">{{ t('overdue') }}</option>
              </select>
            </div>

            <div class="content-grid">
              <section class="panel">
                <div class="section-header">
                  <h2>{{ t('tasks') }}</h2>
                  <button v-if="isManager" class="link-button" @click="showTaskComposer = true; resetTaskForm()">
                    <i class="bi bi-plus-lg"></i>
                    {{ t('newTask') }}
                  </button>
                </div>

                <div v-if="!filteredTasks.length" class="empty-state">{{ t('noTasks') }}</div>
                <div v-else class="task-list">
                  <article
                    v-for="task in filteredTasks"
                    :key="task.id"
                    :class="['task-row', { selected: selectedTask?.id === task.id }]"
                    @click="selectedTaskId = task.id"
                  >
                    <button
                      class="status-dot"
                      :class="taskDisplayStatus(task)"
                      @click.stop="changeStatus(task, task.status === 'completed' ? 'todo' : 'completed')"
                      :title="statusLabel(taskDisplayStatus(task))"
                    ></button>
                    <div class="task-main">
                      <strong :class="{ done: task.status === 'completed' }">{{ task.title }}</strong>
                      <span>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—' }}</span>
                    </div>
                    <span :class="['status-pill', taskDisplayStatus(task)]">{{ statusLabel(taskDisplayStatus(task)) }}</span>
                    <span class="muted-text">{{ formatDate(task.due_date) }}</span>
                    <button v-if="isManager" class="ghost-button icon-only danger" @click.stop="removeTask(task)" aria-label="O‘chirish">
                      <i class="bi bi-trash3"></i>
                    </button>
                  </article>
                </div>
              </section>

              <aside class="panel detail-panel">
                <template v-if="selectedTask">
                  <div class="section-header clean">
                    <h2>{{ selectedTask.title }}</h2>
                    <span :class="['status-pill', taskDisplayStatus(selectedTask)]">{{ statusLabel(taskDisplayStatus(selectedTask)) }}</span>
                  </div>

                  <dl class="detail-list">
                    <div>
                      <dt>{{ t('assignee') }}</dt>
                      <dd>{{ selectedTask.assignee?.full_name || employeeMap.get(selectedTask.assignee_id || '')?.full_name || '—' }}</dd>
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
                    <button class="ghost-button" @click="changeStatus(selectedTask, 'todo')">{{ t('todo') }}</button>
                    <button class="ghost-button" @click="changeStatus(selectedTask, 'in_progress')">{{ t('in_progress') }}</button>
                    <button class="primary-button fit" @click="changeStatus(selectedTask, 'completed')">{{ t('completed') }}</button>
                  </div>

                  <div v-if="selectedTask.checklist?.length" class="checklist-list">
                    <label v-for="item in selectedTask.checklist" :key="item.id">
                      <input :checked="item.is_done" type="checkbox" @change="toggleChecklist(item.id, !item.is_done)" />
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
              <form v-if="showEmployeeComposer" class="panel form-panel" @submit.prevent="submitEmployee">
              <div class="section-header">
                <h2>{{ t('createEmployee') }}</h2>
                <button type="button" class="ghost-button icon-only" @click="showEmployeeComposer = false" aria-label="Yopish">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>

              <div class="form-grid">
                <label>
                  {{ t('fullName') }}
                  <input v-model="employeeForm.full_name" placeholder="Ali Valiyev" />
                </label>
                <label>
                  {{ t('email') }}
                  <input v-model="employeeForm.login_email" type="text" autocomplete="username" placeholder="ali.valiyev" />
                </label>
                <label>
                  {{ t('password') }}
                  <div class="password-field">
                    <input
                      v-model="employeeForm.password"
                      :type="employeePasswordVisible ? 'text' : 'password'"
                      autocomplete="new-password"
                      placeholder="Kamida 6 belgi"
                    />
                    <button
                      type="button"
                      class="password-toggle"
                      :aria-label="employeePasswordVisible ? 'Parolni yashirish' : 'Parolni ko‘rsatish'"
                      @click="employeePasswordVisible = !employeePasswordVisible"
                    >
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

            <section class="panel">
              <div class="section-header">
                <h2>{{ t('employees') }}</h2>
                <button class="primary-button fit" @click="showEmployeeComposer = true; resetEmployeeForm()">
                  <i class="bi bi-person-plus"></i>
                  {{ t('createEmployee') }}
                </button>
              </div>

              <div v-if="!employees.length" class="empty-state">{{ t('noEmployees') }}</div>
              <div v-else class="employee-table">
                <article v-for="employee in employees" :key="employee.id" class="employee-row">
                  <div class="avatar small">{{ getInitials(employee.full_name) }}</div>
                  <div>
                    <strong>{{ employee.full_name || employee.login_email || '—' }}</strong>
                    <span>{{ employee.login_email || '—' }}</span>
                  </div>
                  <span class="role-pill">{{ roleLabel(employee.role) }}</span>
                  <span>{{ employee.phone || '—' }}</span>
                  <span>{{ displayTelegram(employee.telegram_username) }}</span>
                </article>
              </div>
            </section>
          </section>

          <section v-else-if="activeView === 'calendar'" key="calendar" class="calendar-layout">
            <section class="panel">
              <div class="section-header">
                <button class="ghost-button icon-only" @click="previousMonth" aria-label="Oldingi oy">
                  <i class="bi bi-chevron-left"></i>
                </button>
                <h2>{{ calendarTitle }}</h2>
                <button class="ghost-button icon-only" @click="nextMonth" aria-label="Keyingi oy">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </div>

              <div class="weekday-row">
                <span>Du</span>
                <span>Se</span>
                <span>Ch</span>
                <span>Pa</span>
                <span>Ju</span>
                <span>Sh</span>
                <span>Ya</span>
              </div>

              <div class="calendar-grid">
                <button
                  v-for="day in calendarDays"
                  :key="day.iso"
                  :class="['calendar-day', { muted: !day.currentMonth, today: day.today, selected: selectedCalendarDate === day.iso }]"
                  @click="selectedCalendarDate = day.iso"
                >
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
                <article v-for="task in selectedCalendarTasks" :key="task.id" @click="selectedTaskId = task.id; activeView = 'tasks'">
                  <div class="avatar small">{{ getInitials(task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name) }}</div>
                  <div>
                    <strong>{{ task.title }}</strong>
                    <span>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—' }}</span>
                  </div>
                  <span :class="['status-pill', taskDisplayStatus(task)]">{{ statusLabel(taskDisplayStatus(task)) }}</span>
                </article>
              </div>
            </aside>
          </section>

          <section v-else-if="activeView === 'settings'" key="settings" class="settings-layout">
            <form class="panel form-panel" @submit.prevent="saveSettings">
              <div class="section-header clean">
                <h2>{{ t('settings') }}</h2>
              </div>

              <div class="form-grid">
                <label>
                  {{ t('fullName') }}
                  <input v-model="settingsForm.full_name" />
                </label>
                <label>
                  {{ t('phone') }}
                  <input v-model="settingsForm.phone" placeholder="+998901234567" />
                </label>
                <label>
                  {{ t('telegram') }}
                  <input v-model="settingsForm.telegram_username" placeholder="@username" />
                </label>
                <label>
                  {{ t('password') }}
                  <div class="password-field">
                    <input
                      v-model="settingsForm.password"
                      :type="settingsPasswordVisible ? 'text' : 'password'"
                      autocomplete="new-password"
                      placeholder="Yangi parol"
                    />
                    <button
                      type="button"
                      class="password-toggle"
                      :aria-label="settingsPasswordVisible ? 'Parolni yashirish' : 'Parolni ko‘rsatish'"
                      @click="settingsPasswordVisible = !settingsPasswordVisible"
                    >
                      <i :class="['bi', settingsPasswordVisible ? 'bi-eye-slash' : 'bi-eye']"></i>
                    </button>
                  </div>
                </label>
                <label>
                  {{ t('language') }}
                  <select v-model="settingsForm.language">
                    <option value="uz">UZ</option>
                    <option value="ru">RU</option>
                    <option value="uz_cyrl">Кирил</option>
                  </select>
                </label>
                <label>
                  {{ t('performance') }}
                  <select v-model="settingsForm.performance_mode">
                    <option value="balanced">{{ t('balanced') }}</option>
                    <option value="compact">{{ t('compact') }}</option>
                  </select>
                </label>
              </div>

              <div class="settings-actions">
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

            <section class="panel profile-summary">
              <div class="avatar large">{{ getInitials(profile?.full_name) }}</div>
              <h2>{{ profile?.full_name || 'User' }}</h2>
              <p>{{ roleLabel(profile?.role) }}</p>
              <dl class="detail-list">
                <div>
                  <dt>{{ t('email') }}</dt>
                  <dd>{{ profile?.login_email || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ t('telegram') }}</dt>
                  <dd>{{ displayTelegram(profile?.telegram_username) }}</dd>
                </div>
              </dl>
            </section>
          </section>
        </Transition>
      </section>
    </template>
  </main>
</template>
