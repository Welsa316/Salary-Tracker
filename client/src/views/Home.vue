<script setup>
import { computed, inject } from 'vue';
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
const openMarkPaid = inject('openMarkPaid');
const isAdmin = inject('isAdmin');

const currency = computed(() => props.settings?.currency || 'USD');
const totalOwed = computed(() => props.summary?.total_owed ?? 0);
const unpaidCount = computed(() => props.summary?.unpaid_count ?? 0);

const today = new Date();
const todayIso = todayISO();
const thisWeekKey = toISODate(startOfWeek(today));
const nextWeekKey = toISODate(startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)));

const upcomingWeeks = computed(() => {
  const list = (props.schedule || []).filter((d) => {
    const iso = String(d.day_date).slice(0, 10);
    return iso >= todayIso;
  });
  const groups = new Map();
  for (const d of list) {
    const date = parseDate(d.day_date);
    const start = startOfWeek(date);
    const key = toISODate(start);
    if (!groups.has(key)) {
      groups.set(key, { key, start, end: endOfWeek(date), days: [] });
    }
    groups.get(key).days.push(d);
  }
  return Array.from(groups.values())
    .map((g) => {
      g.days.sort((a, b) => {
        const aKey = `${String(a.day_date).slice(0, 10)} ${a.start_time}`;
        const bKey = `${String(b.day_date).slice(0, 10)} ${b.start_time}`;
        return aKey < bKey ? -1 : 1;
      });
      return g;
    })
    .sort((a, b) => (a.key < b.key ? -1 : 1));
});

function weekHeading(g) {
  const range = `${formatDate(g.start, { month: 'short', day: 'numeric' })} – ${formatDate(g.end, { month: 'short', day: 'numeric' })}`;
  if (g.key === thisWeekKey) return `This week · ${range}`;
  if (g.key === nextWeekKey) return `Next week · ${range}`;
  return range;
}

function markAllPaid() {
  const unpaid = (props.sessions || []).filter(
    (s) => !s.paid && Number(s.duration_hrs) > 0,
  );
  if (unpaid.length === 0) return;
  openMarkPaid({ unpaid, total: totalOwed.value });
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
        v-if="isAdmin && unpaidCount > 0"
        class="mt-4 rounded-full border border-terracotta/30 bg-terracotta/5 px-4 py-1.5 text-sm font-medium text-terracotta"
        @click="markAllPaid"
      >
        Mark all paid
      </button>
    </section>

    <div
      v-if="upcomingWeeks.length === 0"
      class="mt-8 card px-4 py-8 text-center text-sm text-ink/50"
    >
      No sessions scheduled. Tap Plan week to add.
    </div>

    <template v-else>
      <div v-for="g in upcomingWeeks" :key="g.key" class="mt-8 first:mt-6">
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-ink/50">
          {{ weekHeading(g) }}
        </h2>
        <div class="card divide-y divide-ink/5 overflow-hidden">
          <div
            v-for="day in g.days"
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
      </div>
    </template>

    <div v-if="isAdmin" class="fixed inset-x-0 bottom-0 px-4 pb-6 pt-3">
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
