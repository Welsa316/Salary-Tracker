<script setup>
import { ref, inject } from 'vue';
import { api } from '../api';
import { money } from '../utils';

const props = defineProps({
  group: Object,
  settings: Object,
});

const emit = defineEmits(['close']);
const refresh = inject('refresh');

const saving = ref(false);
const error = ref(null);

async function confirmPaid() {
  saving.value = true;
  error.value = null;
  try {
    const ids = props.group.unpaid.map((s) => s.id);
    await api.bulkMarkPaid(ids);
    await refresh();
    emit('close');
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
    <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <div class="mb-1 text-xs uppercase tracking-wider text-ink/50">Mark paid</div>
      <div class="text-2xl font-bold">{{ money(group.total, settings?.currency) }}</div>
      <div class="text-sm text-ink/60">
        {{ group.unpaid.length }} session{{ group.unpaid.length === 1 ? '' : 's' }}
      </div>

      <div v-if="error" class="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
        {{ error }}
      </div>

      <div class="mt-5 space-y-2">
        <button class="btn-primary w-full" :disabled="saving" @click="confirmPaid">
          {{ saving ? 'Saving…' : 'Mark paid' }}
        </button>
        <button class="btn-ghost w-full" @click="emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>
