<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { api } from '../api';
import { toISODate, startOfWeek, todayISO } from '../utils';

const navigate = inject('navigate');
const refresh  = inject('refresh');

function computeDefaultWeek() {
  const today = new Date();
  // If today is Sunday, default to tomorrow's week (the upcoming Mon–Sun).
  // Otherwise, default to the current Mon–Sun.
  const offset = today.getDay() === 0 ? 1 : 0;
  const seed = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return startOfWeek(seed);
}

const weekStart = ref(computeDefaultWeek());

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.value);
    d.setDate(weekStart.value.getDate() + i);
    return {
      date: d,
      iso: toISODate(d),
      weekdayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  }),
);

const form = ref({});
const loading = ref(true);
const saving = ref(false);
const error = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const rows = await api.getSchedule({ week: toISODate(weekStart.value) });
    const populated = {};
    for (const day of days.value) {
      const existing = rows.find((r) => String(r.day_date).slice(0, 10) === day.iso);
      populated[day.iso] = existing?.start_time ? existing.start_time.slice(0, 5) : '';
    }
    form.value = populated;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = null;
  try {
    const payload = [];
    for (const day of days.value) {
      const t = (form.value[day.iso] || '').trim();
      if (t) payload.push({ day_date: day.iso, start_time: t });
    }
    await api.putScheduleWeek(toISODate(weekStart.value), payload);
    await refresh();
    navigate({ name: 'home' });
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

function shiftWeek(delta) {
  const next = new Date(weekStart.value);
  next.setDate(next.getDate() + delta * 7);
  weekStart.value = next;
  load();
}

const weekLabel = computed(() => {
  const s = days.value[0].date;
  const e = days.value[6].date;
  const sLabel = s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const eLabel = e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${sLabel} – ${eLabel}`;
});

const todayIso = todayISO();

onMounted(load);
</script>

<template>
  <div>
    <header class="mb-5 flex items-center gap-3">
      <button class="btn-ghost px-2 py-2" @click="navigate({ name: 'home' })">←</button>
      <h1 class="text-lg font-semibold">Plan week</h1>
    </header>

    <div v-if="error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="mb-5 flex items-center justify-between rounded-xl bg-ink/5 px-2 py-1.5">
      <button type="button" class="btn-ghost px-3 py-1 text-lg" @click="shiftWeek(-1)">‹</button>
      <div class="text-sm font-medium">{{ weekLabel }}</div>
      <button type="button" class="btn-ghost px-3 py-1 text-lg" @click="shiftWeek(1)">›</button>
    </div>

    <p class="mb-4 text-xs text-ink/50">
      Pick a start time for each day you're coming. Leave blank to skip that day.
    </p>

    <form class="space-y-2" @submit.prevent="save">
      <div
        v-for="day in days"
        :key="day.iso"
        class="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2"
        :class="day.iso === todayIso ? 'ring-1 ring-terracotta/30' : ''"
      >
        <div class="w-20">
          <div class="text-sm font-semibold">{{ day.weekdayLabel }}</div>
          <div class="text-xs text-ink/50">{{ day.dateLabel }}</div>
        </div>
        <input
          type="time"
          v-model="form[day.iso]"
          class="field flex-1"
          placeholder="—"
        />
        <button
          v-if="form[day.iso]"
          type="button"
          class="px-2 text-ink/40 hover:text-red-600"
          aria-label="Clear"
          @click="form[day.iso] = ''"
        >×</button>
      </div>

      <button type="submit" class="btn-primary mt-6 w-full" :disabled="saving || loading">
        {{ saving ? 'Saving…' : 'Save Schedule' }}
      </button>
    </form>
  </div>
</template>
