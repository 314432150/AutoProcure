<script setup>
import { computed } from "vue";
import { Edit } from "@element-plus/icons-vue";
import { formatDateTime, formatMoney } from "@/utils/formatters";

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
  monthTotal: { type: [Number, String], default: null },
  defaultYearMonth: { type: String, default: "" },
  showUpdatedAt: { type: Boolean, default: false },
  mergeYearMonth: { type: Boolean, default: false },
});

const emit = defineEmits(["row-dblclick"]);

/** 格式化年月显示，缺省时使用默认年月 */
const formatYearMonth = (value) => {
  if (value) {
    return value;
  }
  return props.defaultYearMonth || "-";
};

const yearMonthSpans = computed(() => {
  if (!props.mergeYearMonth) {
    return [];
  }
  const spans = [];
  let lastValue = null;
  let startIndex = 0;
  props.items.forEach((item, index) => {
    const value = formatYearMonth(item.year_month);
    if (value !== lastValue) {
      if (lastValue !== null) {
        spans[startIndex] = index - startIndex;
      }
      lastValue = value;
      startIndex = index;
      spans[index] = 1;
    } else {
      spans[index] = 0;
    }
  });
  if (lastValue !== null) {
    spans[startIndex] = props.items.length - startIndex;
  }
  return spans;
});

const monthTotals = computed(() => {
  const totals = new Map();
  props.items.forEach((item) => {
    const key = formatYearMonth(item.year_month);
    const current = Number(totals.get(key) || 0);
    totals.set(key, current + Number(item.total_amount || 0));
  });
  return totals;
});

const yearMonthCount = computed(() => {
  const set = new Set(
    props.items.map((item) => formatYearMonth(item.year_month)),
  );
  return set.size;
});

const totalLabel = computed(() => {
  if (props.mergeYearMonth && yearMonthCount.value > 1) {
    return "区间总金额";
  }
  return "月度总金额";
});

/** 合并同年月单元格的行高 */
const spanMethod = ({ rowIndex, column }) => {
  if (
    props.mergeYearMonth &&
    (column?.property === "year_month" || column?.property === "month_total")
  ) {
    const rowspan = yearMonthSpans.value[rowIndex] || 0;
    return { rowspan, colspan: rowspan > 0 ? 1 : 0 };
  }
  return { rowspan: 1, colspan: 1 };
};

const modeLabel = computed(() => "双击编辑明细");

const formatAmount = (value) => formatMoney(value, 2);
const formatWarningSummary = (warnings = []) => {
  if (!warnings.length) return "-";
  return warnings.map((item) => item.reason || "-").join("；");
};

const formatWarningDetail = (warnings = []) => {
  if (!warnings.length) return "-";
  return warnings
    .map((item) => item.detail || item.reason || "-")
    .join("；");
};
</script>

<template>
  <!-- 组件说明：采购计划列表表格，支持合并年月与汇总行 -->
  <div class="table-shell">
      <el-table
        :data="items"
        v-loading="loading"
        stripe
        height="100%"
        @row-dblclick="(row) => emit('row-dblclick', row)"
        :span-method="spanMethod"
      >
      <el-table-column
        v-if="mergeYearMonth"
        prop="year_month"
        label="年月"
        width="110"
      >
        <template #default="scope">
          {{ formatYearMonth(scope.row.year_month) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="mergeYearMonth"
        prop="month_total"
        label="当月总金额(元)"
        width="140"
      >
        <template #default="scope">
          {{ formatAmount(monthTotals.get(formatYearMonth(scope.row.year_month)) || 0) }}
        </template>
      </el-table-column>
      <el-table-column type="index" label="序号" width="70" />
      <el-table-column prop="date" label="日期" width="160">
        <template #default="scope">
          <span class="row-edit-hint">
            {{ scope.row.date }}
            <el-tooltip :content="modeLabel" placement="top">
              <el-icon class="row-edit-icon row-edit-icon--strong">
                <Edit />
              </el-icon>
            </el-tooltip>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="total_amount" label="当日金额(元)">
        <template #default="scope">
          {{ formatAmount(scope.row.total_amount) }}
        </template>
      </el-table-column>
      <el-table-column prop="warning_reason" label="预算警告原因" min-width="200">
        <template #default="scope">
          {{ formatWarningSummary(scope.row.warnings || []) }}
        </template>
      </el-table-column>
      <el-table-column prop="warning_detail" label="预算警告说明" min-width="240">
        <template #default="scope">
          {{ formatWarningDetail(scope.row.warnings || []) }}
        </template>
      </el-table-column>
      <el-table-column v-if="showUpdatedAt" label="修改时间" width="180">
        <template #default="scope">
          {{ formatDateTime(scope.row.updated_at) }}
        </template>
      </el-table-column>
      </el-table>
    </div>
    <div class="plan-summary">
      <span>共 {{ total }} 条</span>
      <span v-if="monthTotal !== null">{{ totalLabel }}：{{ formatAmount(monthTotal) }} 元</span>
    </div>
</template>

<style scoped>
.plan-summary {
  flex: 0 0 auto;
  padding-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
}
</style>
