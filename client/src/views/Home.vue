<script setup>
import { computed, inject, ref } from 'vue';
import { api } from '../api';
import {
  money,
  formatDate,
  formatTime,
  parseDate,
  toISODate,
  todayISO,
  startOfWeek,
  endOfWeek,
} from '../utils';

const props = defineProps({
  settings: Object,
  summary: Object,
  sessions: Array,
  schedule: Array,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');

const currency = computed(() => props.settings?.currency || 'USD');
const totalOwed = computed(() => props.summary?.total_owed ?? 0);
const unpaidCount = computed(() => props.summary?.unpaid_count ?? 0);

const today = new Date();
const weekStart = startOfWeek(today);
const weekEnd = endOfWeek(today);
const weekStartIso = toISODate(weekStart);
const weekEndIso = toISODate(weekEnd);

const weekRangeLabel = computed(() => {
  const s = formatDate(weekStart, { month: 'short', day: 'numeric' });
  const e = formatDate(weekEnd,   { month: 'short', day: 'numeric' });
  return `${s} – ${e}`;
});

const todayIso = todayISO();

const upcomingDays = computed(() => {
  const list = props.schedule || [];
  return list
    .filter((d) => {
      const iso = String(d.day_date).slice(0, 10);
      return iso >= todayIso && iso >= weekStartIso && iso <= weekEndIso;
    })
    .sort((a, b) => {
      const aKey = `${String(a.day_date).slice(0, 10)} ${a.start_time}`;
      const bKey = `${String(b.day_date).slice(0, 10)} ${b.start_time}`;
      return aKey < bKey ? -1 : 1;
    });
});

const marking = ref(false);
async function markAllPaid() {
  const msg = `Mark ${money(totalOwed.value, currency.value)} (${unpaidCount.value} session${
    unpaidCount.value === 1 ? '' : 's'
  }) as paid?`;
  if (!confirm(msg)) return;
  const ids = (props.sessions || [])
    .filter((s) => !s.paid && Number(s.duration_hrs) > 0)
    .map((s) => s.id);
  if (ids.length === 0) return;
  marking.value = true;
  try {
    await api.bulkMarkPaid(ids);
    await refresh();
  } finally {
    marking.value = false;
  }
}
</script>

<template>
  <div>
    <section class="card mt-4 flex flex-col items-center py-8 text-center">
      <div class="text-xs uppercase tracking-widest text-ink/50">Balance due</div>
      <div class="mt-2 text-5xl font-bold tracking-tight text-terracotta">
        {{ money(totalOwed, currency) }}
      </div>
      <div class="mt-1 text-sm text-ink/60">
        {{ unpaidCount }} unpaid session{{ unpaidCount === 1 ? '' : 's' }}
      </div>
      <button
        v-if="unpaidCount > 0"
        class="mt-4 rounded-full border border-terracotta/30 bg-terracotta/5 px-4 py-1.5 text-sm font-medium text-terracotta disabled:opacity-50"
        :disabled="marking"
        @click="markAllPaid"
      >
        {{ marking ? 'Marking…' : 'Mark all paid' }}
      </button>
    </section>

    <h2 class="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-ink/50">
      This week · {{ weekRangeLabel }}
    </h2>

    <div
      v-if="upcomingDays.length === 0"
      class="card px-4 py-8 text-center text-sm text-ink/50"
    >
      No sessions scheduled this week. Tap Plan week to add.
    </div>

    <div v-else class="card divide-y divide-ink/5 overflow-hidden">
      <div
        v-for="day in upcomingDays"
        :key="day.id"
        class="flex items-center justify-between px-4 py-4"
      >
        <div>
          <div class="text-lg font-semibold text-ink">
            {{ formatDate(parseDate(day.day_date), { weekday: 'long' }) }}
          </div>
          <div class="text-xs uppercase tracking-wider text-ink/50">
            {{ formatDate(parseDate(day.day_date), { month: 'short', day: 'numeric' }) }}
          </div>
        </div>
        <div class="text-2xl font-bold tracking-tight text-terracotta tabular-nums">
          {{ formatTime(day.start_time) }}
        </div>
      </div>
    </div>

    <div class="fixed inset-x-0 bottom-0 px-4 pb-6 pt-3">
      <div class="mx-auto max-w-xl">
        <button
          class="btn-primary w-full text-base shadow-lg shadow-terracotta/20"
          @click="navigate({ name: 'schedule-week' })"
        >
          Plan week
        </button>
      </div>
    </div>
  </div>
</template>
