export function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDate(date: string | null) {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${day}.${month}.${year}`
}

export function formatDay(date: Date, localeName: string) {
  return new Intl.DateTimeFormat(localeName, { day: '2-digit' }).format(date)
}

export function getInitialsFromName(name?: string | null, fallback = 'U') {
  const clean = name || fallback
  return clean
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function displayTelegram(username?: string | null) {
  return username ? `@${username.replace(/^@+/, '')}` : '—'
}
