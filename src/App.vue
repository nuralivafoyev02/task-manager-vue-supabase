<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
type ThemeMode = 'light' | 'dark'
type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; type: ToastType; message: string; startX?: number }

const viewKeys: ViewKey[] = ['dashboard', 'tasks', 'employees', 'calendar', 'settings']
const savedView = localStorage.getItem('task-manager-active-view') as ViewKey | null
const savedTheme = localStorage.getItem('task-manager-theme') as ThemeMode | null

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
    editTask: 'Vazifani tahrirlash',
    cancelTask: 'Bekor qilish',
    actions: 'Amallar',
    createEmployee: 'Xodim yaratish',
    saveProfile: 'Profilni saqlash',
    search: 'Qidirish',
    refresh: 'Yangilash',
    logout: 'Chiqish',
    today: 'Bugun',
    active: 'Faol',
    completed: 'Bajarilgan',
    canceled: 'Bekor qilingan',
    overdue: 'Kechikkan',
    assignee: 'Biriktirilgan',
    dueDate: 'Muddat',
    priority: 'Ustuvorlik',
    status: 'Status',
    title: 'Vazifa nomi',
    description: 'Izoh',
    cancelReason: 'Bekor qilish izohi',
    cancelReasonHelp: 'Vazifa nima sababdan bekor qilinayotganini yozing.',
    cancelReasonPlaceholder: 'Masalan: mijoz javob bermadi yoki vazifa dolzarbligini yo‘qotdi',
    cancelReasonRequired: 'Bekor qilish izohini kiriting.',
    cancelReasonEmpty: 'Bekor qilish izohi kiritilmagan.',
    confirmCancel: 'Bekor qilishni tasdiqlash',
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
    calendarEmpty: 'Bu kunda vazifa yo‘q',
    dashboardDescription: 'Xodimlarga biriktirilgan vazifalar holati.',
    tasksDescriptionManager: 'Vazifalarni qidirish, filtrlash va boshqarish.',
    tasksDescriptionEmployee: 'Sizga biriktirilgan vazifalar.',
    employeesDescription: 'Login, rol, telefon va Telegram ma’lumotlari.',
    calendarDescription: 'Kunlar bo‘yicha biriktirilgan vazifalar.',
    settingsDescription: 'Profil, xavfsizlik va interfeys sozlamalari.',
    profile: 'Profil',
    appearance: 'Ko‘rinish',
    security: 'Xavfsizlik',
    account: 'Akkaunt',
    theme: 'Mavzu',
    light: 'Light',
    dark: 'Dark',
    openProfileMenu: 'Profil menyusi',
    menu: 'Menu',
    checklistHelp: 'Har bir bandni yangi qatordan yozing. Masalan: briefni tekshirish, hisobotni yuborish.',
    checklistPlaceholder: 'Briefni tekshirish\nHisobotni yuborish\nNatijani tasdiqlash',
    all: 'Hammasi',
    loading: 'Yuklanmoqda...',
    notFoundTitle: 'Sahifa topilmadi',
    notFoundText: 'Bu manzil mavjud emas yoki foydalanuvchi sahifasi sifatida ochilmaydi.',
    home: 'Bosh sahifa',
    supabaseMissingTitle: 'Supabase sozlanmagan',
    supabaseMissingText: '.env faylga VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY qiymatlarini kiriting.',
    loginRequired: 'Login va parolni kiriting.',
    taskTitleRequired: 'Vazifa nomini kiriting.',
    assigneeRequired: 'Xodimni tanlang.',
    taskSaved: 'Vazifa saqlandi.',
    taskUpdated: 'Vazifa yangilandi.',
    taskCreateError: 'Vazifa yaratishda xatolik.',
    employeeValidation: 'Ism, login va kamida 6 belgili parol kiriting.',
    employeeCreated: 'Xodim yaratildi.',
    employeeCreateError: 'Xodim yaratishda xatolik.',
    statusError: 'Status o‘zgarmadi.',
    taskDeleted: 'Vazifa o‘chirildi.',
    taskCanceled: 'Vazifa bekor qilindi.',
    taskDeleteError: 'Vazifa o‘chirishda xatolik.',
    checklistError: 'Checklist yangilanmadi.',
    passwordValidation: 'Yangi parol kamida 6 belgidan iborat bo‘lishi kerak.',
    profileSaved: 'Profil saqlandi.',
    profileSaveError: 'Profil saqlanmadi.',
    profileImage: 'Profil rasmi',
    changeImage: 'Rasm yuklash',
    removeImage: 'Rasmni olib tashlash',
    loginUpdated: 'Login yangilandi.',
    cannotCancel: 'Vazifani bekor qilib bo‘lmadi.',
    dataLoadError: 'Data loading failed',
    loginFailed: 'Login failed',
    close: 'Yopish',
    closeMenu: 'Menyuni yopish',
    delete: 'O‘chirish',
    previousMonth: 'Oldingi oy',
    nextMonth: 'Keyingi oy',
    taskTitlePlaceholder: 'Vazifa nomi',
    fullNamePlaceholder: 'Falonchiyev Pistonchi',
    passwordMinPlaceholder: 'Kamida 6 belgi',
    newPasswordPlaceholder: 'Yangi parol',
    showPassword: 'Parolni ko‘rsatish',
    hidePassword: 'Parolni yashirish',
    weekdays: 'Du,Se,Ch,Pa,Ju,Sh,Ya'
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
    editTask: 'Редактировать задачу',
    cancelTask: 'Отменить',
    actions: 'Действия',
    createEmployee: 'Создать сотрудника',
    saveProfile: 'Сохранить профиль',
    search: 'Поиск',
    refresh: 'Обновить',
    logout: 'Выйти',
    today: 'Сегодня',
    active: 'Активные',
    completed: 'Готово',
    canceled: 'Отменено',
    overdue: 'Просрочено',
    assignee: 'Исполнитель',
    dueDate: 'Срок',
    priority: 'Приоритет',
    status: 'Статус',
    title: 'Название задачи',
    description: 'Описание',
    cancelReason: 'Причина отмены',
    cancelReasonHelp: 'Напишите, почему задача отменяется.',
    cancelReasonPlaceholder: 'Например: клиент не ответил или задача потеряла актуальность',
    cancelReasonRequired: 'Введите причину отмены.',
    cancelReasonEmpty: 'Причина отмены не указана.',
    confirmCancel: 'Подтвердить отмену',
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
    calendarEmpty: 'На этот день задач нет',
    dashboardDescription: 'Состояние задач, назначенных сотрудникам.',
    tasksDescriptionManager: 'Поиск, фильтрация и управление задачами.',
    tasksDescriptionEmployee: 'Задачи, назначенные вам.',
    employeesDescription: 'Логин, роль, телефон и Telegram.',
    calendarDescription: 'Задачи по датам.',
    settingsDescription: 'Профиль, безопасность и интерфейс.',
    profile: 'Профиль',
    appearance: 'Внешний вид',
    security: 'Безопасность',
    account: 'Аккаунт',
    theme: 'Тема',
    light: 'Светлая',
    dark: 'Темная',
    openProfileMenu: 'Меню профиля',
    menu: 'Меню',
    checklistHelp: 'Пишите каждый пункт с новой строки. Например: проверить бриф, отправить отчет.',
    checklistPlaceholder: 'Проверить бриф\nОтправить отчет\nПодтвердить результат',
    all: 'Все',
    loading: 'Загрузка...',
    notFoundTitle: 'Страница не найдена',
    notFoundText: 'Этот адрес не существует или не является страницей приложения.',
    home: 'На главную',
    supabaseMissingTitle: 'Supabase не настроен',
    supabaseMissingText: 'Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env файл.',
    loginRequired: 'Введите логин и пароль.',
    taskTitleRequired: 'Введите название задачи.',
    assigneeRequired: 'Выберите сотрудника.',
    taskSaved: 'Задача сохранена.',
    taskUpdated: 'Задача обновлена.',
    taskCreateError: 'Ошибка при создании задачи.',
    employeeValidation: 'Введите имя, логин и пароль минимум из 6 символов.',
    employeeCreated: 'Сотрудник создан.',
    employeeCreateError: 'Ошибка при создании сотрудника.',
    statusError: 'Статус не изменен.',
    taskDeleted: 'Задача удалена.',
    taskCanceled: 'Задача отменена.',
    taskDeleteError: 'Ошибка при удалении задачи.',
    checklistError: 'Checklist не обновлен.',
    passwordValidation: 'Новый пароль должен быть минимум 6 символов.',
    profileSaved: 'Профиль сохранен.',
    profileSaveError: 'Профиль не сохранен.',
    profileImage: 'Фото профиля',
    changeImage: 'Загрузить фото',
    removeImage: 'Удалить фото',
    loginUpdated: 'Логин обновлен.',
    cannotCancel: 'Не удалось отменить задачу.',
    dataLoadError: 'Ошибка загрузки данных',
    loginFailed: 'Ошибка входа',
    close: 'Закрыть',
    closeMenu: 'Закрыть меню',
    delete: 'Удалить',
    previousMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    taskTitlePlaceholder: 'Имя задачи',
    fullNamePlaceholder: 'Фалончиев Пистончи',
    passwordMinPlaceholder: 'Минимум 6 символов',
    newPasswordPlaceholder: 'Новый пароль',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    weekdays: 'Пн,Вт,Ср,Чт,Пт,Сб,Вс'
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
    editTask: 'Вазифани таҳрирлаш',
    cancelTask: 'Бекор қилиш',
    actions: 'Амаллар',
    createEmployee: 'Ходим яратиш',
    saveProfile: 'Профилни сақлаш',
    search: 'Қидириш',
    refresh: 'Янгилаш',
    logout: 'Чиқиш',
    today: 'Бугун',
    active: 'Фаол',
    completed: 'Бажарилган',
    canceled: 'Бекор қилинган',
    overdue: 'Кечиккан',
    assignee: 'Бириктирилган',
    dueDate: 'Муддат',
    priority: 'Устуворлик',
    status: 'Статус',
    title: 'Вазифа номи',
    description: 'Изоҳ',
    cancelReason: 'Бекор қилиш изоҳи',
    cancelReasonHelp: 'Вазифа нима сабабдан бекор қилинаётганини ёзинг.',
    cancelReasonPlaceholder: 'Масалан: мижоз жавоб бермади ёки вазифа долзарблигини йўқотди',
    cancelReasonRequired: 'Бекор қилиш изоҳини киритинг.',
    cancelReasonEmpty: 'Бекор қилиш изоҳи киритилмаган.',
    confirmCancel: 'Бекор қилишни тасдиқлаш',
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
    calendarEmpty: 'Бу кунда вазифа йўқ',
    dashboardDescription: 'Ходимларга бириктирилган вазифалар ҳолати.',
    tasksDescriptionManager: 'Вазифаларни қидириш, фильтрлаш ва бошқариш.',
    tasksDescriptionEmployee: 'Сизга бириктирилган вазифалар.',
    employeesDescription: 'Логин, рол, телефон ва Telegram маълумотлари.',
    calendarDescription: 'Кунлар бўйича бириктирилган вазифалар.',
    settingsDescription: 'Профил, хавфсизлик ва интерфейс созламалари.',
    profile: 'Профил',
    appearance: 'Кўриниш',
    security: 'Хавфсизлик',
    account: 'Аккаунт',
    theme: 'Тема',
    light: 'Light',
    dark: 'Dark',
    openProfileMenu: 'Профил менюси',
    menu: 'Меню',
    checklistHelp: 'Ҳар бир бандни янги қатордан ёзинг. Масалан: briefни текшириш, ҳисоботни юбориш.',
    checklistPlaceholder: 'Briefни текшириш\nҲисоботни юбориш\nНатижани тасдиқлаш',
    all: 'Ҳаммаси',
    loading: 'Юкланмоқда...',
    notFoundTitle: 'Саҳифа топилмади',
    notFoundText: 'Бу манзил мавжуд эмас ёки фойдаланувчи саҳифаси сифатида очилмайди.',
    home: 'Бош саҳифа',
    supabaseMissingTitle: 'Supabase созланмаган',
    supabaseMissingText: '.env файлга VITE_SUPABASE_URL ва VITE_SUPABASE_ANON_KEY қийматларини киритинг.',
    loginRequired: 'Логин ва паролни киритинг.',
    taskTitleRequired: 'Вазифа номини киритинг.',
    assigneeRequired: 'Ходимни танланг.',
    taskSaved: 'Вазифа сақланди.',
    taskUpdated: 'Вазифа янгиланди.',
    taskCreateError: 'Вазифа яратишда хатолик.',
    employeeValidation: 'Исм, логин ва камида 6 белгили парол киритинг.',
    employeeCreated: 'Ходим яратилди.',
    employeeCreateError: 'Ходим яратишда хатолик.',
    statusError: 'Статус ўзгармади.',
    taskDeleted: 'Вазифа ўчирилди.',
    taskCanceled: 'Вазифа бекор қилинди.',
    taskDeleteError: 'Вазифа ўчиришда хатолик.',
    checklistError: 'Checklist янгиланмади.',
    passwordValidation: 'Янги парол камида 6 белгидан иборат бўлиши керак.',
    profileSaved: 'Профил сақланди.',
    profileSaveError: 'Профил сақланмади.',
    profileImage: 'Профил расми',
    changeImage: 'Расм юклаш',
    removeImage: 'Расмни олиб ташлаш',
    loginUpdated: 'Логин янгиланди.',
    cannotCancel: 'Вазифани бекор қилиб бўлмади.',
    dataLoadError: 'Data loading failed',
    loginFailed: 'Login failed',
    close: 'Ёпиш',
    closeMenu: 'Менюни ёпиш',
    delete: 'Ўчириш',
    previousMonth: 'Олдинги ой',
    nextMonth: 'Кейинги ой',
    taskTitlePlaceholder: 'Вазифа номи',
    fullNamePlaceholder: 'Фалончиев Пистончи',
    passwordMinPlaceholder: 'Камида 6 белги',
    newPasswordPlaceholder: 'Янги парол',
    showPassword: 'Паролни кўрсатиш',
    hidePassword: 'Паролни яшириш',
    weekdays: 'Ду,Се,Чо,Па,Жу,Ша,Як'
  }
}

const activeView = ref<ViewKey>(savedView && viewKeys.includes(savedView) ? savedView : 'dashboard')
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
const toasts = ref<ToastItem[]>([])
let toastId = 0
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
const cancelDialogTask = ref<Task | null>(null)
const cancelReason = ref('')
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
const weekdayLabels = computed(() => t('weekdays').split(','))

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

function showToast(type: ToastType, message: string) {
  if (!message) return
  const id = ++toastId
  toasts.value.push({ id, type, message })
  window.setTimeout(() => dismissToast(id), 4200)
}

function dismissToast(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function startToastSwipe(toast: ToastItem, event: PointerEvent) {
  toast.startX = event.clientX
}

function endToastSwipe(toast: ToastItem, event: PointerEvent) {
  if (toast.startX !== undefined && Math.abs(event.clientX - toast.startX) > 40) dismissToast(toast.id)
  toast.startX = undefined
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

function formatDate(date: string | null) {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${day}.${month}.${year}`
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
  profileMenuOpen.value = false
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
  settingsForm.performance_mode = profile.value?.performance_mode || 'balanced'
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
  resetMessages()
  try {
    const updatedTask = await updateTaskStatus(task, status)
    tasks.value = tasks.value.map((currentTask) =>
      currentTask.id === task.id ? { ...currentTask, ...updatedTask, checklist: currentTask.checklist } : currentTask
    )
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('statusError')
  }
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
  try {
    const updatedTask = await updateTaskStatus(task, 'canceled', reason)
    tasks.value = tasks.value.map((currentTask) =>
      currentTask.id === task.id ? { ...currentTask, ...updatedTask, checklist: currentTask.checklist } : currentTask
    )
    noticeMessage.value = t('taskCanceled')
    closeCancelDialog()
    await refreshData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('cannotCancel')
  } finally {
    saving.value = false
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
      performance_mode: settingsForm.performance_mode
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
  localStorage.setItem('task-manager-active-view', view)
})

watch(themeMode, (mode) => {
  localStorage.setItem('task-manager-theme', mode)
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
    :class="['app-shell', `theme-${themeMode}`, settingsForm.performance_mode === 'compact' && 'performance-compact']">
    <div class="toast-stack" aria-live="polite">
      <TransitionGroup name="toast">
        <button v-for="toast in toasts" :key="toast.id" :class="['toast-card', toast.type]"
          @click="dismissToast(toast.id)" @pointerdown="startToastSwipe(toast, $event)"
          @pointerup="endToastSwipe(toast, $event)">
          <i
            :class="['bi', toast.type === 'success' ? 'bi-check-circle' : toast.type === 'error' ? 'bi-exclamation-circle' : 'bi-info-circle']"></i>
          <span>{{ toast.message }}</span>
          <i class="bi bi-x-lg toast-close"></i>
        </button>
      </TransitionGroup>
    </div>

    <Transition name="panel-pop">
      <div v-if="cancelDialogTask" class="modal-scrim" @click.self="closeCancelDialog">
        <form class="modal-panel cancel-modal" @submit.prevent="confirmCancelTask">
          <div class="section-header clean">
            <div>
              <h2>{{ t('cancelReason') }}</h2>
              <p>{{ t('cancelReasonHelp') }}</p>
            </div>
            <button type="button" class="ghost-button icon-only" @click="closeCancelDialog" :aria-label="t('close')">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <strong class="modal-task-title">{{ cancelDialogTask.title }}</strong>
          <textarea v-model="cancelReason" rows="4" :placeholder="t('cancelReasonPlaceholder')" autofocus></textarea>
          <div class="modal-actions">
            <button type="button" class="ghost-button" @click="closeCancelDialog">{{ t('close') }}</button>
            <button class="primary-button danger-button" :disabled="saving">
              <i class="bi bi-x-circle"></i>
              {{ saving ? '...' : t('confirmCancel') }}
            </button>
          </div>
        </form>
      </div>
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
                    @click.stop="changeStatus(task, task.status === 'completed' ? 'todo' : 'completed')"
                    :title="statusLabel(taskDisplayStatus(task))"></button>
                  <div class="task-main">
                    <strong :class="{ done: task.status === 'completed' }">{{ task.title }}</strong>
                    <span>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—'
                      }}</span>
                  </div>
                  <button type="button" :class="['status-pill', taskDisplayStatus(task)]"
                    @click="showCancelReason(task, $event)">
                    {{ statusLabel(taskDisplayStatus(task)) }}
                  </button>
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
              <section class="panel">
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
                      @click.stop="changeStatus(task, task.status === 'completed' ? 'todo' : 'completed')"
                      :title="statusLabel(taskDisplayStatus(task))"></button>
                    <div class="task-main">
                      <strong :class="{ done: task.status === 'completed' }">{{ task.title }}</strong>
                      <span>{{ task.assignee?.full_name || employeeMap.get(task.assignee_id || '')?.full_name || '—'
                        }}</span>
                    </div>
                    <button type="button" :class="['status-pill', taskDisplayStatus(task)]"
                      @click="showCancelReason(task, $event)">
                      {{ statusLabel(taskDisplayStatus(task)) }}
                    </button>
                    <span class="muted-text">{{ formatDate(task.due_date) }}</span>
                    <button class="ghost-button icon-only"
                      @click.stop="taskActionMenuId = taskActionMenuId === task.id ? null : task.id"
                      :aria-label="t('actions')">
                      <i class="bi bi-three-dots"></i>
                    </button>
                    <div v-if="taskActionMenuId === task.id" class="task-actions-menu" @click.stop>
                      <button @click="startEditTask(task)"><i class="bi bi-pencil"></i>{{ t('editTask') }}</button>
                      <button @click="cancelTask(task)"><i class="bi bi-x-circle"></i>{{ t('cancelTask') }}</button>
                      <button class="danger-text" @click="removeTask(task)"><i class="bi bi-trash3"></i>{{ t('delete')
                        }}</button>
                    </div>
                  </article>
                </div>
              </section>

              <aside class="panel detail-panel">
                <template v-if="selectedTask">
                  <div class="section-header clean">
                    <h2>{{ selectedTask.title }}</h2>
                    <button type="button" :class="['status-pill', taskDisplayStatus(selectedTask)]"
                      @click="showCancelReason(selectedTask, $event)">
                      {{ statusLabel(taskDisplayStatus(selectedTask)) }}
                    </button>
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
                    <button class="ghost-button" @click="changeStatus(selectedTask, 'todo')">{{ t('todo') }}</button>
                    <button class="ghost-button" @click="changeStatus(selectedTask, 'in_progress')">{{ t('in_progress')
                      }}</button>
                    <button class="primary-button fit" @click="changeStatus(selectedTask, 'completed')">{{
                      t('completed') }}</button>
                    <button class="ghost-button danger-text" @click="cancelTask(selectedTask)">{{ t('cancelTask')
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
                  <button type="button" :class="['status-pill', taskDisplayStatus(task)]"
                    @click="showCancelReason(task, $event)">
                    {{ statusLabel(taskDisplayStatus(task)) }}
                  </button>
                </article>
              </div>
            </aside>
          </section>

          <section v-else-if="activeView === 'settings'" key="settings" class="settings-catalog-layout">
            <aside class="panel settings-index">
              <strong>{{ t('settings') }}</strong>
              <a href="#settings-profile"><i class="bi bi-person"></i>{{ t('profile') }}</a>
              <a href="#settings-security"><i class="bi bi-shield-lock"></i>{{ t('security') }}</a>
              <a href="#settings-appearance"><i class="bi bi-palette"></i>{{ t('appearance') }}</a>
              <a href="#settings-account"><i class="bi bi-box-arrow-right"></i>{{ t('account') }}</a>
            </aside>

            <form class="settings-sections" @submit.prevent="saveSettings">
              <section id="settings-profile" class="panel settings-card">
                <div class="settings-card-head">
                  <i class="bi bi-person"></i>
                  <div>
                    <h2>{{ t('profile') }}</h2>
                    <p>{{ t('settingsDescription') }}</p>
                  </div>
                </div>
                <div class="avatar-uploader">
                  <div class="avatar large">
                    <img v-if="settingsForm.avatar_url" :src="settingsForm.avatar_url" alt="" />
                    <span v-else>{{ getInitials(settingsForm.full_name) }}</span>
                  </div>
                  <div>
                    <strong>{{ t('profileImage') }}</strong>
                    <div class="avatar-actions">
                      <label class="ghost-button fit">
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

              <section id="settings-security" class="panel settings-card">
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

              <section id="settings-appearance" class="panel settings-card">
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
                  <label>
                    {{ t('theme') }}
                    <select v-model="themeMode">
                      <option value="light">{{ t('light') }}</option>
                      <option value="dark">{{ t('dark') }}</option>
                    </select>
                  </label>
                </div>
              </section>

              <section id="settings-account" class="panel settings-card account-card">
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
              </section>
            </form>
          </section>
        </Transition>
      </section>
    </template>
  </main>
</template>
