<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { api } from '../api';

const props = defineProps({
  editSlug: String,
  students: Array,
});

const navigate = inject('navigate');
const refresh  = inject('refresh');
const openStudentList = inject('openStudentList');

const isEdit = computed(() => !!props.editSlug);

const form = ref({ name: '', hourly_rate: 30 });
const saving = ref(false);
const error = ref(null);
const shareUrl = ref('');
const copied = ref(false);

onMounted(async () => {
  if (!isEdit.value) return;
  try {
    const s = await api.getStudent(props.editSlug);
    form.value = { name: s.name, hourly_rate: s.hourly_rate };
    shareUrl.value = `${window.location.origin}/s/${s.slug}`;
  } catch (err) {
    error.value = err.message;
  }
});

async function save() {
  saving.value = true;
  error.value = null;
  try {
    if (isEdit.value) {
      await api.updateStudent(props.editSlug, {
        name: form.value.name,
        hourly_rate: parseFloat(form.value.hourly_rate),
      });
      await refresh();
      navigate({ name: 'home' });
    } else {
      const created = await api.createStudent({
        name: form.value.name,
        hourly_rate: parseFloat(form.value.hourly_rate),
      });
      await refresh();
      // Surface the parent's link straight away — it's the whole point of adding one.
      shareUrl.value = `${window.location.origin}/s/${created.slug}`;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    copied.value = false;
  }
}

async function remove() {
  if (
    !confirm(
      `Delete ${form.value.name}? This permanently removes their sessions and schedule.`,
    )
  ) return;
  await api.deleteStudent(props.editSlug);
  await refresh();
  openStudentList();
}

const justCreated = computed(() => !isEdit.value && !!shareUrl.value);
</script>

<template>
  <div>
    <header class="mb-5 flex items-center gap-3">
      <button class="btn-ghost px-2 py-2" @click="navigate({ name: 'home' })">←</button>
      <h1 class="text-lg font-semibold">{{ isEdit ? 'Edit student' : 'Add student' }}</h1>
    </header>

    <div v-if="error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <template v-if="justCreated">
      <div class="card px-4 py-6 text-center">
        <div class="text-sm font-medium">{{ form.name }} added</div>
        <p class="mt-2 text-xs text-ink/60">
          Send this link to their parent. It's read-only — they can see the schedule
          and balance but can't change anything.
        </p>
        <div class="mt-4 break-all rounded-xl bg-ink/5 px-3 py-3 text-xs">{{ shareUrl }}</div>
        <button class="btn-outline mt-3 w-full" @click="copyLink">
          {{ copied ? 'Copied ✓' : 'Copy link' }}
        </button>
      </div>
      <button class="btn-primary mt-4 w-full" @click="openStudentList">Done</button>
    </template>

    <template v-else>
      <form class="space-y-5" @submit.prevent="save">
        <div>
          <label class="label">Student name</label>
          <input type="text" v-model="form.name" class="field" placeholder="Omar" required />
        </div>

        <div>
          <label class="label">Hourly rate</label>
          <input
            type="number"
            step="0.01"
            min="0"
            v-model="form.hourly_rate"
            class="field"
            required
          />
          <p class="mt-1 text-xs text-ink/50">
            Applied to new sessions. Already-logged sessions keep the rate they were saved at.
          </p>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="saving">
          {{ saving ? 'Saving…' : isEdit ? 'Save' : 'Add student' }}
        </button>
      </form>

      <div v-if="isEdit" class="mt-8">
        <label class="label">Parent link</label>
        <div class="break-all rounded-xl bg-ink/5 px-3 py-3 text-xs">{{ shareUrl }}</div>
        <button class="btn-outline mt-2 w-full" @click="copyLink">
          {{ copied ? 'Copied ✓' : 'Copy link' }}
        </button>
        <button class="btn-ghost mt-6 w-full text-red-600" @click="remove">
          Delete student
        </button>
      </div>
    </template>
  </div>
</template>
