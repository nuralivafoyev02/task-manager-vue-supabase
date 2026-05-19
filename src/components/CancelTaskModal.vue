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
        <div class="cancel-modal-head">
          <div class="cancel-modal-icon">
            <i class="bi bi-x-octagon"></i>
          </div>
          <div>
            <h2>{{ t('cancelReason') }}</h2>
            <p>{{ t('cancelReasonHelp') }}</p>
          </div>
          <button type="button" class="ghost-button icon-only" @click="emit('close')" :aria-label="t('close')">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="cancel-task-preview">
          <span><i class="bi bi-check2-square"></i></span>
          <strong class="modal-task-title">{{ task.title }}</strong>
        </div>

        <label class="cancel-reason-field">
          {{ t('cancelReason') }}
          <textarea v-model="reasonModel" rows="4" :placeholder="t('cancelReasonPlaceholder')" autofocus></textarea>
        </label>

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
