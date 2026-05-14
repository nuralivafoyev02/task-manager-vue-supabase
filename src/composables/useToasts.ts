import { ref } from 'vue'
import type { ToastItem, ToastType } from '../types'

export function useToasts() {
  const toasts = ref<ToastItem[]>([])
  let toastId = 0

  function showToast(type: ToastType, message: string) {
    if (!message) return
    const id = ++toastId
    toasts.value.push({ id, type, message })
    window.setTimeout(() => dismissToast(id), 4200)
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    toasts,
    showToast,
    dismissToast
  }
}
