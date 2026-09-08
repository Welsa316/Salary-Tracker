<script setup>
import { computed, inject } from 'vue';
import { money } from '../utils';

const props = defineProps({
  students: Array,
  settings: Object,
});

const navigate = inject('navigate');
const openStudent = inject('openStudent');

const currency = computed(() => props.settings?.currency || 'USD');

const totalOwed = computed(() =>
  (props.students || []).reduce((sum, s) => sum + Number(s.total_owed || 0), 0),
);
</script>

<template>
  <div>
    <section class="card mt-4 flex flex-col items-center py-8 text-center">
      <div class="text-xs uppercase tracking-widest text-ink/50">Total outstanding</div>
      <div class="mt-2 text-5xl font-bold tracking-tight text-terracotta">
        {{ money(totalOwed, currency) }}
      </div>
      <div class="mt-1 text-sm text-ink/60">
        across {{ students?.length || 0 }} student{{ students?.length === 1 ? '' : 's' }}
      </div>
    </section>

    <h2 class="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-ink/50">
      Students
    </h2>

    <div
      v-if="!students || students.length === 0"
      class="card px-4 py-8 text-center text-sm text-ink/50"
    >
      No students yet. Tap Add student to create one.
    </div>

    <div v-else class="card divide-y divide-ink/5 overflow-hidden">
      <button
        v-for="s in students"
        :key="s.id"
        type="button"
        class="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-ink/[0.02]"
        @click="openStudent(s.slug)"
      >
        <div class="min-w-0">
          <div class="truncate text-lg font-semibold text-ink">{{ s.name }}</div>
          <div class="text-xs text-ink/50">
            {{ money(s.hourly_rate, currency) }}/hr ·
            {{ s.unpaid_count }} unpaid
          </div>
        </div>
        <div
          class="ml-3 shrink-0 text-xl font-bold tabular-nums"
          :class="Number(s.total_owed) > 0 ? 'text-terracotta' : 'text-ink/30'"
        >
          {{ money(s.total_owed, currency) }}
        </div>
      </button>
    </div>

    <div class="fixed inset-x-0 bottom-0 px-4 pb-6 pt-3">
      <div class="mx-auto max-w-xl">
        <button
          class="btn-primary w-full text-base shadow-lg shadow-terracotta/20"
          @click="navigate({ name: 'student-form' })"
        >
          + Add student
        </button>
      </div>
    </div>
  </div>
</template>
