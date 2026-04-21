<script setup>
import { ref, onMounted, inject } from 'vue';
import { api } from '../api';
import { money, formatDate, parseDate } from '../utils';

const props = defineProps({
  settings: Object,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');

const payments = ref([]);
const loading = ref(true);
const error = ref(null);

async function load() {
  loading.value = true;
  try {
    payments.value = await api.getPayments();
    error.value = null;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function remove(p) {
  if (!confirm(`Delete this ${money(p.amount, props.settings?.currency)} payment? Linked sessions will stay marked paid.`)) {
    return;
  }
  await api.deletePayment(p.id);
  await load();
  await refresh();
}

onMounted(load);
</script>

<template>
  <div>
    <header class="mb-5 flex items-center gap-3">
      <button class="btn-ghost px-2 py-2" @click="navigate({ name: 'settings' })">←</button>
      <h1 class="text-lg font-semibold">Payment history</h1>
    </header>

    <div v-if="error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div v-if="loading" class="mt-8 text-center text-ink/50">Loading…</div>
    <div v-else-if="payments.length === 0" class="mt-8 text-center text-ink/50">
      No recorded payments yet.
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="p in payments"
        :key="p.id"
        class="card flex items-start justify-between gap-3 px-4 py-3"
      >
        <div class="flex-1">
          <div class="text-sm font-medium">
            {{ formatDate(parseDate(p.paid_on), { month: 'short', day: 'numeric', year: 'numeric' }) }}
          </div>
          <div class="text-xs text-ink/50">
            <span v-if="p.method">{{ p.method }}</span>
            <span v-if="p.method && p.notes"> · </span>
            <span v-if="p.notes">{{ p.notes }}</span>
            <span v-if="!p.method && !p.notes" class="text-ink/40">no method recorded</span>
          </div>
        </div>
        <div class="text-right">
          <div class="font-semibold">{{ money(p.amount, settings?.currency) }}</div>
          <button class="mt-1 text-xs text-red-600" @click="remove(p)">Delete</button>
        </div>
      </li>
    </ul>
  </div>
</template>
