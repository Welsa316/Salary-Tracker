<script setup>
import { ref, computed, provide, onMounted, onUnmounted } from 'vue';
import Home from './views/Home.vue';
import Sessions from './views/Sessions.vue';
import SessionForm from './views/SessionForm.vue';
import Settings from './views/Settings.vue';
import WeeklySchedule from './views/WeeklySchedule.vue';
import StudentList from './views/StudentList.vue';
import StudentForm from './views/StudentForm.vue';
import MarkPaidModal from './components/MarkPaidModal.vue';
import { api } from './api';

function slugFromPath() {
  const m = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

const studentSlug = ref(slugFromPath());
const view = ref({ name: 'home' });
const tab = ref(localStorage.getItem('tt:tab') === 'sessions' ? 'sessions' : 'home');
function setTab(t) {
  tab.value = t;
  localStorage.setItem('tt:tab', t);
}

const settings = ref(null);
const student = ref(null);
const students = ref([]);
const summary = ref(null);
const sessions = ref([]);
const schedule = ref([]);
const loadError = ref(null);
const isAdmin = ref(false);
const booted = ref(false);

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
    const [setData, authData] = await Promise.all([api.getSettings(), api.getMe()]);
    settings.value = setData;
    isAdmin.value = !!authData.admin;

    if (studentSlug.value) {
      const slug = studentSlug.value;
      const [stu, sData, sumData, schedData] = await Promise.all([
        api.getStudent(slug),
        api.getSessions(slug),
        api.getSummary(slug),
        api.getSchedule(slug),
      ]);
      student.value  = stu;
      sessions.value = sData;
      summary.value  = sumData;
      schedule.value = schedData;
    } else {
      student.value = null;
      sessions.value = [];
      schedule.value = [];
      summary.value = null;
      students.value = isAdmin.value ? await api.listStudents() : [];
    }
    loadError.value = null;
  } catch (err) {
    loadError.value = err.message;
  } finally {
    booted.value = true;
  }
}

function navigate(next) {
  window.scrollTo({ top: 0 });
  view.value = next;
}

function openStudent(slug) {
  window.history.pushState({}, '', `/s/${slug}`);
  studentSlug.value = slug;
  view.value = { name: 'home' };
  window.scrollTo({ top: 0 });
  refresh();
}

function openStudentList() {
  window.history.pushState({}, '', '/');
  studentSlug.value = null;
  view.value = { name: 'home' };
  window.scrollTo({ top: 0 });
  refresh();
}

function onPopState() {
  studentSlug.value = slugFromPath();
  view.value = { name: 'home' };
  refresh();
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
provide('refreshAuth', refreshAuth);
provide('openMarkPaid', openMarkPaid);
provide('isAdmin',  isAdmin);
provide('student',  student);
provide('studentSlug', studentSlug);
provide('openStudent', openStudent);
provide('openStudentList', openStudentList);

const headerTitle = computed(() => {
  const name = student.value?.name?.trim();
  return name ? `Tutoring · ${name}` : 'Tutoring';
});

const onHomeShell = computed(() => view.value.name === 'home' && !!studentSlug.value);

let pollId;
onMounted(() => {
  refresh();
  window.addEventListener('popstate', onPopState);
  pollId = setInterval(refresh, 15000);
});
onUnmounted(() => {
  clearInterval(pollId);
  window.removeEventListener('popstate', onPopState);
});
</script>

<template>
  <div class="mx-auto max-w-xl px-4 pb-24 pt-6">
    <div v-if="loadError" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </div>

    <header v-if="view.name === 'home'" class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-1">
        <button
          v-if="studentSlug && isAdmin"
          class="btn-ghost -ml-2 px-2 py-2"
          aria-label="All students"
          @click="openStudentList"
        >←</button>
        <h1 class="truncate text-lg font-semibold">{{ headerTitle }}</h1>
      </div>
      <button
        class="btn-ghost px-2 py-2 text-xl"
        aria-label="Settings"
        @click="navigate({ name: 'settings' })"
      >
        ⚙
      </button>
    </header>

    <nav v-if="onHomeShell" class="mt-4 flex rounded-xl bg-ink/5 p-1 text-sm">
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

    <!-- Student-scoped shell -->
    <Home
      v-if="onHomeShell && tab === 'home'"
      :settings="settings"
      :student="student"
      :summary="summary"
      :sessions="sessions"
      :schedule="schedule"
    />
    <Sessions
      v-else-if="onHomeShell && tab === 'sessions'"
      :settings="settings"
      :sessions="sessions"
    />

    <!-- No student in the URL -->
    <StudentList
      v-else-if="view.name === 'home' && !studentSlug && isAdmin"
      :students="students"
      :settings="settings"
    />
    <div
      v-else-if="view.name === 'home' && !studentSlug && booted"
      class="card mt-8 px-4 py-10 text-center text-sm text-ink/60"
    >
      Open the link you were sent to see your schedule and balance.
    </div>

    <!-- Pushed views -->
    <SessionForm
      v-else-if="view.name === 'session'"
      :settings="settings"
      :student="student"
      :session-id="view.id"
      :sessions="sessions"
    />
    <Settings
      v-else-if="view.name === 'settings'"
      :settings="settings"
      :student="student"
      :summary="summary"
    />
    <WeeklySchedule v-else-if="view.name === 'schedule-week'" />
    <StudentForm
      v-else-if="view.name === 'student-form'"
      :edit-slug="view.slug"
      :students="students"
    />

    <MarkPaidModal
      v-if="paidModal"
      :group="paidModal"
      :settings="settings"
      @close="closeMarkPaid"
    />
  </div>
</template>
