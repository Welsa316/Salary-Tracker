<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue';
import { api } from '../api';
import { money, todayISO, durationFromTimes } from '../utils';

const props = defineProps({
  settings: Object,
  sessionId: String,
  sessions: Array,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');

const isEdit = computed(() => !!props.sessionId);
const mode = ref('times'); // 'times' | 'hours'

const form = ref({
  session_date: todayISO(),
  start_time: '',
  end_time: '',
  duration_hrs: '',
  notes: '',
});

const rate = computed(() => Number(props.settings?.hourly_rate ?? 25));
const currency = computed(() => props.settings?.currency || 'USD');

const duration = computed(() => {
  if (mode.value === 'times') {
    return durationFromTimes(form.value.start_time, form.value.end_time);
  }
  const n = parseFloat(form.value.duration_hrs);
  return Number.isFinite(n) ? n : 0;
});

const earnings = computed(() => duration.value * rate.value);

const saving = ref(false);
const error = ref(null);

onMounted(() => {
  if (isEdit.value) {
    const s = props.sessions.find((x) => x.id === props.sessionId);
    if (s) {
      form.value.session_date = s.session_date;
      form.value.start_time = s.start_time ? s.start_time.slice(0, 5) : '';
      form.value.end_time   = s.end_time   ? s.end_time.slice(0, 5)   : '';
      form.value.duration_hrs = String(s.duration_hrs);
      form.value.notes = s.notes || '';
      mode.value = s.start_time && s.end_time ? 'times' : 'hours';
    }
  }
});

watch(mode, (m) => {
  if (m === 'hours') {
    if (form.value.start_time || form.value.end_time) {
      form.value.duration_hrs = String(duration.value);
    }
    form.value.start_time = '';
    form.value.end_time = '';
  }
});

async function save() {
  saving.value = true;
  error.value = null;
  try {
    const payload = {
      session_date: form.value.session_date,
      start_time: mode.value === 'times' ? form.value.start_time || null : null,
      end_time:   mode.value === 'times' ? form.value.end_time   || null : null,
      duration_hrs: duration.value,
      notes: form.value.notes?.trim() || null,
    };
    if (isEdit.value) {
      await api.updateSession(props.sessionId, payload);
    } else {
      await api.createSession(payload);
    }
    await refresh();
    navigate({ name: 'home' });
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!confirm('Delete this session?')) return;
  await api.deleteSession(props.sessionId);
  await refresh();
  navigate({ name: 'home' });
}
</script>

<template>
  <div>
    <header class="mb-5 flex items-center gap-3">
      <button class="btn-ghost px-2 py-2" @click="navigate({ name: 'home' })">←</button>
      <h1 class="text-lg font-semibold">{{ isEdit ? 'Edit Session' : 'New Session' }}</h1>
    </header>

    <div v-if="error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <form class="space-y-5" @submit.prevent="save">
      <div>
        <label class="label">Date</label>
        <input type="date" v-model="form.session_date" class="field" required />
      </div>

      <div>
        <label class="label">Time</label>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl border px-3 py-2 text-sm"
            :class="mode === 'times' ? 'border-terracotta bg-terracotta/5 text-terracotta' : 'border-ink/15'"
            @click="mode = 'times'"
          >
            Start / End
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border px-3 py-2 text-sm"
            :class="mode === 'hours' ? 'border-terracotta bg-terracotta/5 text-terracotta' : 'border-ink/15'"
            @click="mode = 'hours'"
          >
            Just hours
          </button>
        </div>
      </div>

      <div v-if="mode === 'times'" class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Start</label>
          <input type="time" v-model="form.start_time" class="field" />
        </div>
        <div>
          <label class="label">End</label>
          <input type="time" v-model="form.end_time" class="field" />
        </div>
      </div>

      <div v-else>
        <label class="label">Duration (hours)</label>
        <input
          type="number"
          step="0.25"
          min="0"
          v-model="form.duration_hrs"
          class="field"
          placeholder="e.g. 2"
        />
      </div>

      <div class="flex items-center justify-between rounded-xl bg-ink/[0.03] px-4 py-3">
        <div class="text-sm text-ink/60">
          {{ duration.toFixed(2) }} hr × {{ money(rate, currency) }}
        </div>
        <div class="text-lg font-semibold">{{ money(earnings, currency) }}</div>
      </div>

      <div>
        <label class="label">Notes (optional)</label>
        <textarea
          v-model="form.notes"
          class="field min-h-[80px]"
          placeholder="e.g. Unit test prep"
        ></textarea>
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save Session' }}
      </button>

      <div class="flex items-center justify-center gap-6 pt-2 text-sm">
        <button v-if="isEdit" type="button" class="text-red-600" @click="remove">Delete</button>
        <button type="button" class="text-ink/50" @click="navigate({ name: 'home' })">Cancel</button>
      </div>
    </form>
  </div>
</template>
