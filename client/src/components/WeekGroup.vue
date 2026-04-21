<script setup>
import { computed, ref, inject } from 'vue';
import SessionRow from './SessionRow.vue';
import { money, sessionEarnings, weekLabel } from '../utils';

const props = defineProps({
  group: Object,
  currency: String,
});

const openMarkPaid = inject('openMarkPaid');

const weekTotal = computed(() =>
  props.group.sessions.reduce((sum, s) => sum + sessionEarnings(s), 0),
);

const unpaidInWeek = computed(() =>
  props.group.sessions.filter((s) => !s.paid && Number(s.duration_hrs) > 0),
);

const allPaid = computed(() =>
  props.group.sessions.every((s) => s.paid || Number(s.duration_hrs) === 0),
);

const paidCount = computed(() =>
  props.group.sessions.filter((s) => s.paid).length,
);

const label = computed(() => weekLabel(props.group));

const collapsed = ref(allPaid.value && props.group.sessions.some((s) => s.paid));
</script>

<template>
  <section class="card overflow-hidden">
    <header
      class="flex items-center justify-between border-b border-ink/5 px-4 py-3"
      :class="collapsed ? 'cursor-pointer' : ''"
      @click="collapsed && (collapsed = false)"
    >
      <div>
        <div class="text-xs font-semibold uppercase tracking-wider text-ink/50">
          {{ label }}
        </div>
        <div class="text-xs text-ink/40">
          {{ group.sessions.length }} session{{ group.sessions.length === 1 ? '' : 's' }}
          <span v-if="allPaid && paidCount > 0"> · ✓ Paid</span>
        </div>
      </div>
      <div class="text-right">
        <div class="text-sm font-semibold">{{ money(weekTotal, currency) }}</div>
      </div>
    </header>

    <div v-if="!collapsed">
      <SessionRow
        v-for="s in group.sessions"
        :key="s.id"
        :session="s"
        :currency="currency"
      />

      <div
        v-if="unpaidInWeek.length > 0"
        class="flex justify-end border-t border-ink/5 px-4 py-3"
      >
        <button
          class="btn-outline text-sm"
          @click="openMarkPaid({ ...group, unpaid: unpaidInWeek, total: weekTotal })"
        >
          Mark week paid
        </button>
      </div>
    </div>
  </section>
</template>
