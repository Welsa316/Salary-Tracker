<script setup>
import { ref, watch, inject, computed } from 'vue';
import { api } from '../api';
import { money } from '../utils';

const props = defineProps({
  settings: Object,
  summary: Object,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');

const form = ref({
  hourly_rate: props.settings?.hourly_rate ?? 25,
  student_name: props.settings?.student_name ?? '',
  currency: props.settings?.currency ?? 'USD',
});

watch(
  () => props.settings,
  (s) => {
    if (!s) return;
    form.value = {
      hourly_rate: s.hourly_rate,
      student_name: s.student_name ?? '',
      currency: s.currency,
    };
  },
);

const saving = ref(false);
const saved = ref(false);
const error = ref(null);

async function save() {
  saving.value = true;
  saved.value = false;
  error.value = null;
  try {
    await api.putSettings({
      hourly_rate: parseFloat(form.value.hourly_rate),
      student_name: form.value.student_name?.trim() || null,
      currency: form.value.currency,
    });
    await refresh();
    saved.value = true;
    setTimeout(() => (saved.value = false), 1500);
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

function exportCsv() {
  window.location.href = '/api/sessions';
}

async function downloadCsv() {
  const rows = await api.getSessions();
  const headers = ['date', 'start', 'end', 'hours', 'rate', 'earnings', 'paid', 'notes'];
  const lines = [headers.join(',')];
  for (const s of rows) {
    const earnings = Number(s.duration_hrs) * Number(s.rate_snapshot);
    lines.push([
      s.session_date,
      s.start_time || '',
      s.end_time || '',
      s.duration_hrs,
      s.rate_snapshot,
      earnings.toFixed(2),
      s.paid ? 'yes' : 'no',
      JSON.stringify(s.notes || ''),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tutoring-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const currency = computed(() => form.value.currency);
</script>

<template>
  <div>
    <header class="mb-5 flex items-center gap-3">
      <button class="btn-ghost px-2 py-2" @click="navigate({ name: 'home' })">←</button>
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>

    <div v-if="error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <form class="space-y-5" @submit.prevent="save">
      <div>
        <label class="label">Hourly rate</label>
        <input type="number" step="0.01" min="0" v-model="form.hourly_rate" class="field" />
      </div>

      <div>
        <label class="label">Student name</label>
        <input type="text" v-model="form.student_name" class="field" placeholder="Ahmed" />
      </div>

      <div>
        <label class="label">Currency</label>
        <select v-model="form.currency" class="field">
          <option value="USD">USD — $</option>
          <option value="EUR">EUR — €</option>
          <option value="GBP">GBP — £</option>
          <option value="CAD">CAD — CA$</option>
          <option value="AUD">AUD — A$</option>
        </select>
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="saving">
        {{ saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save' }}
      </button>
    </form>

    <div class="my-8 h-px bg-ink/10"></div>

    <div class="space-y-3">
      <div class="flex justify-between text-sm">
        <span class="text-ink/60">Lifetime earnings</span>
        <span class="font-medium">{{ money(summary?.total_earned ?? 0, currency) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-ink/60">Lifetime paid</span>
        <span class="font-medium">{{ money(summary?.total_paid ?? 0, currency) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-ink/60">Sessions logged</span>
        <span class="font-medium">{{ summary?.sessions_logged ?? 0 }}</span>
      </div>
    </div>

    <div class="my-8 h-px bg-ink/10"></div>

    <div class="space-y-3">
      <button class="btn-outline w-full" @click="downloadCsv">Export all sessions (CSV)</button>
    </div>
  </div>
</template>
