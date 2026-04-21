<script setup>
import { computed, inject } from 'vue';
import WeekGroup from '../components/WeekGroup.vue';
import { money, groupByWeek } from '../utils';

const props = defineProps({
  settings: Object,
  summary: Object,
  sessions: Array,
});

const navigate = inject('navigate');

const currency = computed(() => props.settings?.currency || 'USD');
const totalOwed = computed(() => props.summary?.total_owed ?? 0);
const unpaidCount = computed(() => props.summary?.unpaid_count ?? 0);

const weeks = computed(() => groupByWeek(props.sessions || []));

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
      <div class="text-xs uppercase tracking-widest text-ink/50">You are owed</div>
      <div class="mt-2 text-5xl font-bold tracking-tight text-terracotta">
        {{ money(totalOwed, currency) }}
      </div>
      <div class="mt-1 text-sm text-ink/60">
        {{ unpaidCount }} unpaid session{{ unpaidCount === 1 ? '' : 's' }}
      </div>
    </section>

    <div v-if="weeks.length === 0" class="mt-8 text-center text-ink/50">
      No sessions yet. Tap + to add one.
    </div>

    <div v-else class="mt-6 space-y-5">
      <WeekGroup
        v-for="g in weeks"
        :key="g.key"
        :group="g"
        :currency="currency"
      />
    </div>

    <div class="fixed inset-x-0 bottom-0 px-4 pb-6 pt-3">
      <div class="mx-auto max-w-xl">
        <button
          class="btn-primary w-full text-base shadow-lg shadow-terracotta/20"
          @click="navigate({ name: 'session' })"
        >
          + Add Session
        </button>
      </div>
    </div>
  </div>
</template>
