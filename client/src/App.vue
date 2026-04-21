<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue';
import Home from './views/Home.vue';
import SessionForm from './views/SessionForm.vue';
import Settings from './views/Settings.vue';
import PaymentHistory from './views/PaymentHistory.vue';
import MarkPaidModal from './components/MarkPaidModal.vue';
import { api } from './api';

const view = ref({ name: 'home' });
const settings = ref(null);
const summary = ref(null);
const sessions = ref([]);
const loadError = ref(null);

async function refresh() {
  try {
    const [sData, setData, sumData] = await Promise.all([
      api.getSessions(),
      api.getSettings(),
      api.getSummary(),
    ]);
    sessions.value = sData;
    settings.value = setData;
    summary.value  = sumData;
    loadError.value = null;
  } catch (err) {
    loadError.value = err.message;
  }
}

function navigate(next) {
  window.scrollTo({ top: 0 });
  view.value = next;
}

const paidModal = ref(null);
function openMarkPaid(group) {
  paidModal.value = group;
}
function closeMarkPaid() {
  paidModal.value = null;
}

provide('navigate', navigate);
provide('refresh',  refresh);
provide('openMarkPaid', openMarkPaid);

let pollId;
onMounted(() => {
  refresh();
  pollId = setInterval(refresh, 15000);
});
onUnmounted(() => clearInterval(pollId));
</script>

<template>
  <div class="mx-auto max-w-xl px-4 pb-24 pt-6">
    <div v-if="loadError" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </div>

    <Home
      v-if="view.name === 'home'"
      :settings="settings"
      :summary="summary"
      :sessions="sessions"
    />
    <SessionForm
      v-else-if="view.name === 'session'"
      :settings="settings"
      :session-id="view.id"
      :sessions="sessions"
      :initial-type="view.type || 'log'"
    />
    <Settings
      v-else-if="view.name === 'settings'"
      :settings="settings"
      :summary="summary"
    />
    <PaymentHistory
      v-else-if="view.name === 'payments'"
      :settings="settings"
    />

    <MarkPaidModal
      v-if="paidModal"
      :group="paidModal"
      :settings="settings"
      @close="closeMarkPaid"
    />
  </div>
</template>
