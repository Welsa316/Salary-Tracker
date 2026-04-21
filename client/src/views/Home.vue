<script setup>
import { computed, inject, ref } from 'vue';
import WeekGroup from '../components/WeekGroup.vue';
import { api } from '../api';
import { money, groupByWeek, groupByMonth, weekLabel, monthLabel } from '../utils';

const props = defineProps({
  settings: Object,
  summary: Object,
  sessions: Array,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');

const currency = computed(() => props.settings?.currency || 'USD');
const totalOwed = computed(() => props.summary?.total_owed ?? 0);
const unpaidCount = computed(() => props.summary?.unpaid_count ?? 0);

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

const period = ref(localStorage.getItem('tt:period') === 'month' ? 'month' : 'week');
function setPeriod(p) {
  period.value = p;
  localStorage.setItem('tt:period', p);
}

const groups = computed(() => {
  const list = props.sessions || [];
  return period.value === 'month' ? groupByMonth(list) : groupByWeek(list);
});

const bulkLabel = computed(() =>
  period.value === 'month' ? 'Mark month paid' : 'Mark week paid',
);

function labelFor(g) {
  return period.value === 'month' ? monthLabel(g) : weekLabel(g);
}

const headerTitle = computed(() => {
  const name = props.settings?.student_name?.trim();
  return name ? `Tutoring · ${name}` : 'Tutoring';
});
</script>

<template>
  <div>
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">{{ headerTitle }}</h1>
      <button
        class="btn-ghost px-2 py-2 text-xl"
        aria-label="Settings"
        @click="navigate({ name: 'settings' })"
      >
        ⚙
      </button>
    </header>

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

    <div class="mt-5 flex rounded-xl bg-ink/5 p-1 text-sm">
      <button
        class="flex-1 rounded-lg py-1.5 transition"
        :class="period === 'week' ? 'bg-white font-medium shadow-sm' : 'text-ink/60'"
        @click="setPeriod('week')"
      >Weekly</button>
      <button
        class="flex-1 rounded-lg py-1.5 transition"
        :class="period === 'month' ? 'bg-white font-medium shadow-sm' : 'text-ink/60'"
        @click="setPeriod('month')"
      >Monthly</button>
    </div>

    <div v-if="groups.length === 0" class="mt-8 text-center text-ink/50">
      No sessions yet. Tap + to add one.
    </div>

    <div v-else class="mt-5 space-y-5">
      <WeekGroup
        v-for="g in groups"
        :key="g.key"
        :group="g"
        :currency="currency"
        :label="labelFor(g)"
        :bulk-label="bulkLabel"
      />
    </div>

    <div class="fixed inset-x-0 bottom-0 px-4 pb-6 pt-3">
      <div class="mx-auto flex max-w-xl gap-2">
        <button
          class="btn-outline flex-1 bg-white text-base shadow-md"
          @click="navigate({ name: 'schedule-week' })"
        >
          + Schedule
        </button>
        <button
          class="btn-primary flex-1 text-base shadow-lg shadow-terracotta/20"
          @click="navigate({ name: 'session', type: 'log' })"
        >
          + Log
        </button>
      </div>
    </div>
  </div>
</template>
