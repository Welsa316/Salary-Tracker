<script setup>
import { computed, inject, ref } from 'vue';
import WeekGroup from '../components/WeekGroup.vue';
import { groupByWeek, groupByMonth, weekLabel, monthLabel } from '../utils';

const props = defineProps({
  settings: Object,
  sessions: Array,
});

const navigate = inject('navigate');

const currency = computed(() => props.settings?.currency || 'USD');

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
</script>

<template>
  <div>
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
      No sessions yet. Tap + Log to add one.
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
      <div class="mx-auto max-w-xl">
        <button
          class="btn-primary w-full text-base shadow-lg shadow-terracotta/20"
          @click="navigate({ name: 'session' })"
        >
          + Log
        </button>
      </div>
    </div>
  </div>
</template>
