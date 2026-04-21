<script setup>
import { ref, computed, provide, onMounted, onUnmounted } from 'vue';
import Home from './views/Home.vue';
import Sessions from './views/Sessions.vue';
import SessionForm from './views/SessionForm.vue';
import Settings from './views/Settings.vue';
import WeeklySchedule from './views/WeeklySchedule.vue';
import MarkPaidModal from './components/MarkPaidModal.vue';
import { api } from './api';

const view = ref({ name: 'home' });
const tab = ref(localStorage.getItem('tt:tab') === 'sessions' ? 'sessions' : 'home');
function setTab(t) {
  tab.value = t;
  localStorage.setItem('tt:tab', t);
}

const settings = ref(null);
const summary = ref(null);
const sessions = ref([]);
const schedule = ref([]);
const loadError = ref(null);
const isAdmin = ref(false);

async function refreshAuth() {
  try {
    const { admin } = await api.getMe();
    isAdmin.value = !!admin;
  } catch {
    isAdmin.value = false;
  }
}

async function refresh() {
  try {
    const [sData, setData, sumData, schedData, authData] = await Promise.all([
      api.getSessions(),
      api.getSettings(),
      api.getSummary(),
      api.getSchedule(),
      api.getMe(),
    ]);
    sessions.value = sData;
    settings.value = setData;
    summary.value  = sumData;
    schedule.value = schedData;
    isAdmin.value  = !!authData.admin;
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
provide('isAdmin',  isAdmin);
provide('refreshAuth', refreshAuth);

const headerTitle = computed(() => {
  const name = settings.value?.student_name?.trim();
  return name ? `Tutoring · ${name}` : 'Tutoring';
});

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

    <header v-if="view.name === 'home'" class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">{{ headerTitle }}</h1>
      <button
        class="btn-ghost px-2 py-2 text-xl"
        aria-label="Settings"
        @click="navigate({ name: 'settings' })"
      >
        ⚙
      </button>
    </header>

    <nav
      v-if="view.name === 'home'"
      class="mt-4 flex rounded-xl bg-ink/5 p-1 text-sm"
    >
      <button
        class="flex-1 rounded-lg py-1.5 transition"
        :class="tab === 'home' ? 'bg-white font-medium shadow-sm' : 'text-ink/60'"
        @click="setTab('home')"
      >Home</button>
      <button
        class="flex-1 rounded-lg py-1.5 transition"
        :class="tab === 'sessions' ? 'bg-white font-medium shadow-sm' : 'text-ink/60'"
        @click="setTab('sessions')"
      >Sessions</button>
    </nav>

    <Home
      v-if="view.name === 'home' && tab === 'home'"
      :settings="settings"
      :summary="summary"
      :sessions="sessions"
      :schedule="schedule"
    />
    <Sessions
      v-else-if="view.name === 'home' && tab === 'sessions'"
      :settings="settings"
      :sessions="sessions"
    />
    <SessionForm
      v-else-if="view.name === 'session'"
      :settings="settings"
      :session-id="view.id"
      :sessions="sessions"
    />
    <Settings
      v-else-if="view.name === 'settings'"
      :settings="settings"
      :summary="summary"
    />
    <WeeklySchedule v-else-if="view.name === 'schedule-week'" />

    <MarkPaidModal
      v-if="paidModal"
      :group="paidModal"
      :settings="settings"
      @close="closeMarkPaid"
    />
  </div>
</template>
