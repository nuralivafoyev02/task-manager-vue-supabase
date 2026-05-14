<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '../types'

const props = defineProps<{
  task: Task | null
  reason: string
  saving: boolean
  t: (key: string) => string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
  'update:reason': [value: string]
}>()

const reasonModel = computed({
  get: () => props.reason,
  set: (value: string) => emit('update:reason', value)
})
</script>

<template>
  <Transition name="panel-pop">
    <div v-if="task" class="modal-scrim" @click.self="emit('close')">
      <form class="modal-panel cancel-modal" @submit.prevent="emit('confirm')">
        <div class="section-header clean">
          <div>
            <h2>{{ t('cancelReason') }}</h2>
            <p>{{ t('cancelReasonHelp') }}</p>
          </div>
          <button type="button" class="ghost-button icon-only" @click="emit('close')" :aria-label="t('close')">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <strong class="modal-task-title">{{ task.title }}</strong>
        <textarea v-model="reasonModel" rows="4" :placeholder="t('cancelReasonPlaceholder')" autofocus></textarea>

        <div class="modal-actions">
          <button type="button" class="ghost-button" @click="emit('close')">{{ t('close') }}</button>
          <button class="primary-button danger-button" :disabled="saving">
            <i class="bi bi-x-circle"></i>
            {{ saving ? '...' : t('confirmCancel') }}
          </button>
        </div>
      </form>
    </div>
  </Transition>
</template>
