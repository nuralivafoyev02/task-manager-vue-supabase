<script setup lang="ts">
import type { ToastItem } from '../types'

defineProps<{
  toasts: ToastItem[]
}>()

const emit = defineEmits<{
  dismiss: [id: number]
}>()

const swipeStarts = new Map<number, number>()

function toastIcon(type: ToastItem['type']) {
  if (type === 'success') return 'bi-check-circle'
  if (type === 'error') return 'bi-exclamation-circle'
  return 'bi-info-circle'
}

function startSwipe(toast: ToastItem, event: PointerEvent) {
  swipeStarts.set(toast.id, event.clientX)
}

function endSwipe(toast: ToastItem, event: PointerEvent) {
  const startX = swipeStarts.get(toast.id)
  if (startX !== undefined && Math.abs(event.clientX - startX) > 40) emit('dismiss', toast.id)
  swipeStarts.delete(toast.id)
}
</script>

<template>
  <div class="toast-stack" aria-live="polite">
    <TransitionGroup name="toast">
      <button
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast-card', toast.type]"
        @click="emit('dismiss', toast.id)"
        @pointerdown="startSwipe(toast, $event)"
        @pointerup="endSwipe(toast, $event)"
      >
        <i :class="['bi', toastIcon(toast.type)]"></i>
        <span>{{ toast.message }}</span>
        <i class="bi bi-x-lg toast-close"></i>
      </button>
    </TransitionGroup>
  </div>
</template>
