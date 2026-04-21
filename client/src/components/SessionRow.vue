<script setup>
import { computed, inject } from 'vue';
import { api } from '../api';
import { money, formatDate, sessionEarnings, parseDate, todayISO } from '../utils';

const props = defineProps({
  session: Object,
  currency: String,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');

const earnings = computed(() => sessionEarnings(props.session));
const hours = computed(() => Number(props.session.duration_hrs));

const status = computed(() => {
  if (props.session.paid) return 'paid';
  if (hours.value === 0 && props.session.session_date >= todayISO()) return 'scheduled';
  if (hours.value === 0) return 'missed';
  return 'unpaid';
});

const dateLabel = computed(() => formatDate(parseDate(props.session.session_date)));

async function togglePaid(ev) {
  ev.stopPropagation();
  if (props.session.paid) {
    await api.markUnpaid(props.session.id);
  } else if (hours.value > 0) {
    await api.markPaid(props.session.id);
  }
  await refresh();
}

function openEdit() {
  navigate({ name: 'session', id: props.session.id });
}
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-3 border-b border-ink/5 px-4 py-3 text-left last:border-b-0 hover:bg-ink/[0.02]"
    @click="openEdit"
  >
    <div class="flex-1">
      <div class="text-sm font-medium">{{ dateLabel }}</div>
      <div class="text-xs text-ink/50">
        <template v-if="hours > 0">{{ hours.toFixed(2) }} hr · {{ money(earnings, currency) }}</template>
        <template v-else>Scheduled</template>
        <span v-if="session.notes"> · {{ session.notes }}</span>
      </div>
    </div>
    <span
      v-if="status === 'paid'"
      class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
      @click.stop="togglePaid"
    >✓ Paid</span>
    <span
      v-else-if="status === 'unpaid'"
      class="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-terracotta"
      @click.stop="togglePaid"
    >● Unpaid</span>
    <span
      v-else-if="status === 'scheduled'"
      class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
    >Scheduled</span>
    <span
      v-else
      class="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/50"
    >0 hr</span>
  </button>
</template>
