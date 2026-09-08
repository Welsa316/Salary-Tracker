<script setup>
import { ref, watch, inject, computed } from 'vue';
import { api } from '../api';
import { money } from '../utils';

const props = defineProps({
  settings: Object,
  student: Object,
  summary: Object,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');
const refreshAuth = inject('refreshAuth');
const isAdmin = inject('isAdmin');
const studentSlug = inject('studentSlug');

const form = ref({ currency: props.settings?.currency ?? 'USD' });

watch(
  () => props.settings,
  (s) => {
    if (s) form.value = { currency: s.currency };
  },
);

const saving = ref(false);
const saved = ref(false);
const error = ref(null);

async function save() {
  saving.value = true;
  saved.value = false;
  error.value = null;
  try {
    await api.putSettings({ currency: form.value.currency });
    await refresh();
    saved.value = true;
    setTimeout(() => (saved.value = false), 1500);
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function downloadCsv() {
  const rows = await api.getSessions(studentSlug.value);
  const headers = ['date', 'start', 'end', 'hours', 'rate', 'earnings', 'paid', 'notes'];
  const lines = [headers.join(',')];
  for (const s of rows) {
    const earnings = Number(s.duration_hrs) * Number(s.rate_snapshot);
    lines.push([
      s.session_date,
      s.start_time || '',
      s.end_time || '',
      s.duration_hrs,
      s.rate_snapshot,
      earnings.toFixed(2),
      s.paid ? 'yes' : 'no',
      JSON.stringify(s.notes || ''),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const who = props.student?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'sessions';
  a.href = url;
  a.download = `${who}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const password = ref('');
const loginError = ref(null);
const loggingIn = ref(false);

async function doLogin() {
  loggingIn.value = true;
  loginError.value = null;
  try {
    await api.login(password.value);
    password.value = '';
    await refreshAuth();
    await refresh();
  } catch (err) {
    loginError.value = err.message.includes('401') ? 'Wrong password' : err.message;
  } finally {
    loggingIn.value = false;
  }
}

async function doLogout() {
  await api.logout();
  await refreshAuth();
  await refresh();
  navigate({ name: 'home' });
}

const currency = computed(() => form.value.currency);
</script>

<template>
  <div>
    <header class="mb-5 flex items-center gap-3">
      <button class="btn-ghost px-2 py-2" @click="navigate({ name: 'home' })">←</button>
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>

    <template v-if="!isAdmin">
      <div v-if="loginError" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
        {{ loginError }}
      </div>
      <form class="space-y-4" @submit.prevent="doLogin">
        <div>
          <label class="label">Admin password</label>
          <input
            type="password"
            v-model="password"
            class="field"
            autocomplete="current-password"
            required
          />
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="loggingIn">
          {{ loggingIn ? 'Signing in…' : 'Sign in' }}
        </button>
        <p class="text-center text-xs text-ink/50">
          Viewing the schedule and balance doesn't need a login — only editing does.
        </p>
      </form>
    </template>

    <template v-else>
      <div v-if="error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

      <div v-if="student" class="mb-8">
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-ink/50">
          {{ student.name }}
        </h2>
        <div class="card divide-y divide-ink/5 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 text-sm">
            <span class="text-ink/60">Hourly rate</span>
            <span class="font-medium">{{ money(student.hourly_rate, currency) }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-3 text-sm">
            <span class="text-ink/60">Lifetime earnings</span>
            <span class="font-medium">{{ money(summary?.total_earned ?? 0, currency) }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-3 text-sm">
            <span class="text-ink/60">Lifetime paid</span>
            <span class="font-medium">{{ money(summary?.total_paid ?? 0, currency) }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-3 text-sm">
            <span class="text-ink/60">Sessions logged</span>
            <span class="font-medium">{{ summary?.sessions_logged ?? 0 }}</span>
          </div>
        </div>
        <button
          class="btn-outline mt-3 w-full"
          @click="navigate({ name: 'student-form', slug: student.slug })"
        >
          Edit {{ student.name }}
        </button>
        <button class="btn-outline mt-2 w-full" @click="downloadCsv">
          Export {{ student.name }}'s sessions (CSV)
        </button>
      </div>

      <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-ink/50">
        App
      </h2>
      <form class="space-y-5" @submit.prevent="save">
        <div>
          <label class="label">Currency</label>
          <select v-model="form.currency" class="field">
            <option value="USD">USD — $</option>
            <option value="EUR">EUR — €</option>
            <option value="GBP">GBP — £</option>
            <option value="CAD">CAD — CA$</option>
            <option value="AUD">AUD — A$</option>
          </select>
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="saving">
          {{ saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save' }}
        </button>
      </form>

      <div class="my-8 h-px bg-ink/10"></div>

      <button class="btn-ghost w-full text-red-600" @click="doLogout">Log out</button>
    </template>
  </div>
</template>
