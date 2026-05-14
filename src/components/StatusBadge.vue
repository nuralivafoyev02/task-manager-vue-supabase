<script setup lang="ts">
import type { TaskStatus } from '../types'

const props = defineProps<{
  status: TaskStatus
  label: string
  clickable?: boolean
}>()

const emit = defineEmits<{
  activate: [event: MouseEvent]
}>()

function handleClick(event: MouseEvent) {
  if (props.clickable) {
    event.stopPropagation()
    emit('activate', event)
  }
}
</script>

<template>
  <button type="button" :class="['status-pill', status]" @click="handleClick">
    {{ label }}
  </button>
</template>
