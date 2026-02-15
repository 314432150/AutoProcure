<script setup>
import { ArrowDown } from "@element-plus/icons-vue";
import YearMonthSelect from "@/components/YearMonthSelect.vue";

const props = defineProps({
  startYear: { type: Number, required: true },
  startMonth: { type: Number, required: true },
  endYear: { type: Number, required: true },
  endMonth: { type: Number, required: true },
  exportLoading: { type: Boolean, default: false },
  warningCount: { type: Number, default: 0 },
});

const emit = defineEmits([
  "update:startYear",
  "update:startMonth",
  "update:endYear",
  "update:endMonth",
  "generate",
  "plan-action",
  "export",
  "export-action",
]);
</script>

<template>
  <el-card class="card form-card">
    <div class="form-grid">
      <div class="filter-block">
        <div class="date-row">
          <div class="date-item">
            <span class="date-label">起始</span>
            <YearMonthSelect
              :year="props.startYear"
              :month="props.startMonth"
              @update:year="(value) => emit('update:startYear', value)"
              @update:month="(value) => emit('update:startMonth', value)"
            />
          </div>
          <span class="date-divider">至</span>
          <div class="date-item">
            <span class="date-label">结束</span>
            <YearMonthSelect
              :year="props.endYear"
              :month="props.endMonth"
              @update:year="(value) => emit('update:endYear', value)"
              @update:month="(value) => emit('update:endMonth', value)"
            />
          </div>
        </div>
      </div>
      <div class="action-block">
        <el-dropdown @command="(command) => emit('plan-action', command)">
          <el-button type="primary" plain @click="emit('generate')">
            生成计划
            <el-icon class="el-icon--right">
              <ArrowDown />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="budget">预算设置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown @command="(command) => emit('export-action', command)">
          <el-button type="primary" plain :loading="exportLoading" @click="emit('export')">
            导出Excel
            <el-icon class="el-icon--right">
              <ArrowDown />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="template">模板编辑</el-dropdown-item>
              <el-dropdown-item command="precision">精度设置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <el-alert
      v-if="warningCount"
      type="warning"
      :closable="false"
      class="plan-warnings"
      title="存在预算警告，请在列表中查看原因与说明"
    >
      <template #default>
        <div class="warning-more">
          共 {{ warningCount }} 条预算不可行提示
        </div>
      </template>
    </el-alert>
  </el-card>
</template>

<style scoped>
.form-grid {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  align-items: flex-start;
}

.filter-block {
  min-width: 0;
  flex: 1;
}

.action-block {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.date-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  align-items: center;
}

.date-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.form-grid :deep(.el-input-number),
.form-grid :deep(.el-checkbox) {
  min-width: 140px;
}

.form-grid :deep(.el-input-number__wrapper) {
  min-height: 34px;
}

.plan-warnings {
  margin-top: 10px;
}

.warning-more {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 900px) {
  .form-grid {
    flex-direction: column;
    align-items: stretch;
  }

  .action-block {
    width: 100%;
  }

  .action-block :deep(.el-dropdown) {
    flex: 1;
  }

  .action-block :deep(.el-dropdown .el-button) {
    width: 100%;
  }

  .date-row {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .date-item {
    width: 100%;
  }

  .date-item :deep(.ym-select) {
    flex: 1;
  }

  .date-divider {
    display: none;
  }
}
</style>
