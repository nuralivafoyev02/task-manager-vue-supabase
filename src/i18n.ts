import uz from './locales/uz.json'
import ru from './locales/ru.json'
import uzCyrillic from './locales/uz_cyrl.json'
import type { AppLanguage } from './types'

export const messages: Record<AppLanguage, Record<string, string>> = {
  uz,
  ru,
  uz_cyrl: uzCyrillic
}

export function translate(language: AppLanguage, key: string) {
  return messages[language]?.[key] || messages.uz[key] || key
}

export function localeName(language: AppLanguage) {
  if (language === 'ru') return 'ru-RU'
  if (language === 'uz_cyrl') return 'uz-Cyrl-UZ'
  return 'uz-UZ'
}
