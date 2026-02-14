<script setup>
import { computed } from "vue";

const props = defineProps({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  minYear: { type: Number, default: null },
  maxYear: { type: Number, default: null },
  showUnits: { type: Boolean, default: true },
});

const emit = defineEmits(["update:year", "update:month"]);

const currentYear = new Date().getFullYear();
const startYear = computed(() =>
  props.minYear ?? currentYear - 2,
);
const endYear = computed(() =>
  props.maxYear ?? currentYear + 3,
);
const yearOptions = computed(() => {
  const years = [];
  for (let y = startYear.value; y <= endYear.value; y += 1) {
    years.push(y);
  }
  return years;
});
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
</script>

<template>
  <div class="ym-select">
    <el-select :model-value="year" placeholder="年份" @change="(val) => emit('update:year', val)">
      <el-option v-for="item in yearOptions" :key="item" :label="item" :value="item" />
    </el-select>
    <span v-if="showUnits" class="ym-unit">年</span>
    <el-select :model-value="month" placeholder="月份" @change="(val) => emit('update:month', val)">
      <el-option v-for="item in monthOptions" :key="item" :label="item" :value="item" />
    </el-select>
    <span v-if="showUnits" class="ym-unit">月</span>
  </div>
</template>

<style scoped>
.ym-select {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.ym-select :deep(.el-select) {
  width: 90px;
  min-width: 90px;
}

.ym-unit {
  color: var(--muted);
  font-size: 12px;
}
</style>
