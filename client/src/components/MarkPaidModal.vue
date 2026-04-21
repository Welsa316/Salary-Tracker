<script setup>
import { ref, inject } from 'vue';
import { api } from '../api';
import { money, todayISO } from '../utils';

const props = defineProps({
  group: Object,
  settings: Object,
});

const emit = defineEmits(['close']);
const refresh = inject('refresh');

const method = ref(null);
const paidOn = ref(todayISO());
const recording = ref(false);
const saving = ref(false);

async function quickPay() {
  saving.value = true;
  try {
    const ids = props.group.unpaid.map((s) => s.id);
    await api.bulkMarkPaid(ids);
    await refresh();
    emit('close');
  } finally {
    saving.value = false;
  }
}

async function saveWithPayment() {
  saving.value = true;
  try {
    const ids = props.group.unpaid.map((s) => s.id);
    await api.createPayment({
      amount: props.group.total,
      paid_on: paidOn.value,
      method: method.value,
      session_ids: ids,
    });
    await refresh();
    emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
    <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <div class="mb-1 text-xs uppercase tracking-wider text-ink/50">Mark week paid</div>
      <div class="text-2xl font-bold">{{ money(group.total, settings?.currency) }}</div>
      <div class="text-sm text-ink/60">
        {{ group.unpaid.length }} session{{ group.unpaid.length === 1 ? '' : 's' }}
      </div>

      <div v-if="!recording" class="mt-5 space-y-2">
        <button class="btn-primary w-full" :disabled="saving" @click="quickPay">
          Just mark paid
        </button>
        <button class="btn-outline w-full" @click="recording = true">
          Record payment details
        </button>
        <button class="btn-ghost w-full" @click="emit('close')">Cancel</button>
      </div>

      <div v-else class="mt-5 space-y-4">
        <div>
          <label class="label">Method</label>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="m in ['Cash', 'Zelle', 'Venmo', 'Other']"
              :key="m"
              type="button"
              class="rounded-xl border px-2 py-2 text-sm"
              :class="method === m ? 'border-terracotta bg-terracotta/5 text-terracotta' : 'border-ink/15'"
              @click="method = m"
            >{{ m }}</button>
          </div>
        </div>
        <div>
          <label class="label">Paid on</label>
          <input type="date" v-model="paidOn" class="field" />
        </div>
        <button class="btn-primary w-full" :disabled="saving" @click="saveWithPayment">
          {{ saving ? 'Saving…' : 'Save payment' }}
        </button>
        <button class="btn-ghost w-full" @click="emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>
