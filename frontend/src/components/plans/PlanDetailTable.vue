<script setup>
/** 展示职责：只负责计划详情表格渲染与交互事件抛出 */
import { computed, ref, watch } from "vue";
import { Edit, InfoFilled } from "@element-plus/icons-vue";
import { formatMoney } from "@/utils/formatters";
import { quantityPrecisionByUnit, quantityStepByUnit } from "@/utils/unitRules";
import { useViewportBreakpoint } from "@/composables/useViewportBreakpoint";

const props = defineProps({
  plan: { type: Object, default: null },
  items: { type: Array, default: () => [] },
  products: { type: Array, default: () => [] },
  productsLoading: { type: Boolean, default: false },
  categories: { type: Array, default: () => [] },
  totalAmount: { type: [Number, String], default: 0 },
  dailyAmount: { type: [Number, String], default: 0 },
  periodicAmount: { type: [Number, String], default: 0 },
  saving: { type: Boolean, default: false },
  hasUnsavedChanges: { type: Boolean, default: false },
  lastSavedAt: { type: Number, default: null },
  quantityRuleTooltip: {
    type: String,
    default: "数量按单位自动步进：可分割单位用 0.1；其他单位用 1。",
  },
});

const emit = defineEmits([
  "add-row",
  "save",
  "remove-row",
  "product-change",
  "quantity-input",
  "quantity-blur",
  "sort-change",
]);

const activeProductRow = ref(null);
const productFilterKeyword = ref("");
const isCompact = useViewportBreakpoint(900);
const compactSummaryExpanded = ref(false);

/** 当计划被清空时，重置当前编辑中的产品行 */
watch(
  () => props.plan,
  (plan) => {
    if (!plan) {
      activeProductRow.value = null;
    }
  },
);

/** 根据品类ID显示品类名称 */
const formatCategoryName = (categoryId) => {
  if (!categoryId) {
    return "-";
  }
  const match = props.categories.find((item) => item.id === categoryId);
  return match?.name || "-";
};

/** 根据品类ID显示采购周期文案 */
const formatPurchaseMode = (categoryId) => {
  if (!categoryId) {
    return "-";
  }
  const match = props.categories.find((item) => item.id === categoryId);
  if (!match?.purchase_mode) {
    return "-";
  }
  if (match.purchase_mode === "daily") {
    return "每日";
  }
  if (match.purchase_mode === "periodic") {
    return "定期";
  }
  return "-";
};

/** 金额统一格式化为2位小数 */
const formatAmount = (value) => formatMoney(value, 2);

/** 保存状态时间文案 */
const formatSavedAt = (value) => {
  if (!Number.isFinite(Number(value))) {
    return "";
  }
  return new Date(Number(value)).toLocaleTimeString("zh-CN", {
    hour12: false,
  });
};

/** 产品下拉筛选关键字同步 */
const onProductFilter = (keyword) => {
  productFilterKeyword.value = String(keyword || "");
};

/** 表格排序事件抛给父组件处理 */
const onSortChange = (payload) => {
  emit("sort-change", payload);
};

const summaryText = computed(
  () =>
    `总额 ${formatAmount(props.totalAmount)} | 日采 ${formatAmount(props.dailyAmount)} | 定采 ${formatAmount(props.periodicAmount)}`,
);

const toggleCompactSummary = () => {
  compactSummaryExpanded.value = !compactSummaryExpanded.value;
};
</script>

<template>
  <section class="detail-panel">
    <div v-if="plan" class="drawer-content">
      <div class="drawer-head">
        <div class="drawer-head-row">
          <p class="drawer-meta">日期：{{ plan.date }}</p>
          <button
            v-if="isCompact"
            type="button"
            class="summary-toggle"
            @click="toggleCompactSummary"
          >
            {{ compactSummaryExpanded ? "收起汇总" : "展开汇总" }}
          </button>
        </div>
        <p v-if="isCompact" class="summary-inline">{{ summaryText }}</p>
        <div v-if="!isCompact || compactSummaryExpanded" class="drawer-totals">
          <div class="total-card total-card--overall">
            <p class="total-label">总额</p>
            <p class="total-value">{{ formatAmount(totalAmount) }} 元</p>
            <p class="total-hint">全部品类合计</p>
          </div>
          <div class="total-card total-card--daily">
            <p class="total-label">日采总额</p>
            <p class="total-value">{{ formatAmount(dailyAmount) }} 元</p>
          </div>
          <div class="total-card total-card--periodic">
            <p class="total-label">定采总额</p>
            <p class="total-value">{{ formatAmount(periodicAmount) }} 元</p>
          </div>
        </div>
        <p class="drawer-meta drawer-meta--status">
          <span v-if="hasUnsavedChanges" class="save-state save-state--dirty">有未保存修改</span>
          <span v-else-if="lastSavedAt" class="save-state save-state--clean">
            已保存 {{ formatSavedAt(lastSavedAt) }}
          </span>
          <span v-else class="save-state save-state--clean">已加载</span>
        </p>
        <div class="drawer-actions" :class="{ 'drawer-actions--compact': isCompact }">
          <el-button type="primary" plain @click="emit('add-row')">新增行</el-button>
          <el-button type="primary" :loading="saving" @click="emit('save')">保存</el-button>
        </div>
      </div>
      <div v-if="!isCompact" class="table-shell plan-table">
        <el-table :data="items" stripe height="100%" @sort-change="onSortChange">
          <el-table-column type="index" label="序号" width="70" fixed="left" />
          <el-table-column prop="name" label="产品" min-width="150" fixed="left" sortable="custom">
            <template #default="scope">
              <template v-if="productsLoading || !products.length">
                <span class="select-loading-text">
                  {{ scope.row.name || "加载中…" }}
                </span>
              </template>
              <template v-else>
                <span
                  v-if="activeProductRow !== scope.$index"
                  class="select-placeholder"
                  @click="
                    () => {
                      activeProductRow = scope.$index;
                      productFilterKeyword = '';
                    }
                  "
                >
                  {{ scope.row.name || "点击选择产品" }}
                  <el-tooltip content="点击编辑" placement="top">
                    <el-icon class="row-edit-icon row-edit-icon--strong">
                      <Edit />
                    </el-icon>
                  </el-tooltip>
                </span>
                <el-select
                  v-else
                  v-model="scope.row.product_id"
                  placeholder="选择产品"
                  filterable
                  :default-first-option="Boolean(productFilterKeyword.trim())"
                  :filter-method="onProductFilter"
                  :loading="productsLoading"
                  @change="(value) => emit('product-change', scope.row, value)"
                  @visible-change="
                    (visible) => {
                      if (!visible) {
                        activeProductRow = null;
                        productFilterKeyword = '';
                      }
                    }
                  "
                >
                  <el-option
                    v-for="item in products"
                    :key="item.id"
                    :value="item.id"
                    :label="item.name"
                  />
                </el-select>
              </template>
            </template>
          </el-table-column>
          <el-table-column prop="category_name" label="品类" width="120" sortable="custom">
            <template #default="scope">
              {{ scope.row.category_name || formatCategoryName(scope.row.category_id) }}
            </template>
          </el-table-column>
          <el-table-column prop="purchase_mode" label="采购周期" width="120" sortable="custom">
            <template #default="scope">
              {{ formatPurchaseMode(scope.row.category_id) }}
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="90" sortable="custom">
            <template #default="scope">
              {{ scope.row.unit || "-" }}
            </template>
          </el-table-column>
          <el-table-column prop="price" label="单价(元)" width="120" sortable="custom">
            <template #default="scope">
              {{ formatAmount(scope.row.price) }}
            </template>
          </el-table-column>
          <el-table-column prop="quantity" width="180" sortable="custom">
            <template #header>
              <el-tooltip :content="quantityRuleTooltip" placement="top">
                <span class="th-with-tip">
                  数量
                  <el-icon class="th-tip">
                    <InfoFilled />
                  </el-icon>
                </span>
              </el-tooltip>
            </template>
            <template #default="scope">
              <el-input-number
                :key="`${scope.row.product_id || 'empty'}-${scope.row.unit || ''}`"
                v-model="scope.row.quantity"
                :min="0"
                :precision="quantityPrecisionByUnit(scope.row.unit)"
                :step="quantityStepByUnit(scope.row.unit)"
                @input="() => emit('quantity-input', scope.row)"
                @blur="() => emit('quantity-blur', scope.row)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额(元)" width="160" sortable="custom">
            <template #default="scope">
              <span class="amount-text">{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="scope">
              <el-button type="danger" link @click="emit('remove-row', scope.$index)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else class="mobile-detail-list">
        <el-empty v-if="!items.length" description="暂无明细，点击“新增行”开始编辑" />
        <article
          v-for="(row, idx) in items"
          :key="row.id || `${row.product_id || 'new'}-${idx}`"
          class="mobile-detail-card"
        >
          <header class="mobile-detail-head">
            <span class="mobile-detail-index">明细 {{ idx + 1 }}</span>
            <el-button type="danger" plain @click="emit('remove-row', idx)">移除</el-button>
          </header>
          <div class="mobile-detail-form">
            <div class="mobile-product-row">
              <div class="mobile-field-label">产品</div>
              <template v-if="productsLoading || !products.length">
                <div class="select-loading-text">{{ row.name || "加载中…" }}</div>
              </template>
              <template v-else>
                <el-select
                  v-model="row.product_id"
                  placeholder="选择产品"
                  filterable
                  :default-first-option="Boolean(productFilterKeyword.trim())"
                  :filter-method="onProductFilter"
                  :loading="productsLoading"
                  @change="(value) => emit('product-change', row, value)"
                >
                  <el-option
                    v-for="item in products"
                    :key="item.id"
                    :value="item.id"
                    :label="item.name"
                  />
                </el-select>
              </template>
            </div>

            <div class="mobile-read-grid">
              <div class="mobile-read-item">
                <div class="mobile-field-label">品类</div>
                <div class="mobile-field-value">{{ row.category_name || formatCategoryName(row.category_id) }}</div>
              </div>
              <div class="mobile-read-item">
                <div class="mobile-field-label">采购周期</div>
                <div class="mobile-field-value">{{ formatPurchaseMode(row.category_id) }}</div>
              </div>
              <div class="mobile-read-item">
                <div class="mobile-field-label">单位</div>
                <div class="mobile-field-value">{{ row.unit || "-" }}</div>
              </div>
              <div class="mobile-read-item">
                <div class="mobile-field-label">单价(元)</div>
                <div class="mobile-field-value">{{ formatAmount(row.price) }}</div>
              </div>
            </div>

            <div class="mobile-detail-grid">
              <div class="mobile-read-item">
                <div class="mobile-field-label">数量</div>
                <el-input-number
                  :key="`${row.product_id || 'empty'}-${row.unit || ''}-mobile`"
                  v-model="row.quantity"
                  :min="0"
                  :precision="quantityPrecisionByUnit(row.unit)"
                  :step="quantityStepByUnit(row.unit)"
                  @input="() => emit('quantity-input', row)"
                  @blur="() => emit('quantity-blur', row)"
                />
              </div>
              <div class="mobile-read-item">
                <div class="mobile-field-label">金额(元)</div>
                <strong class="amount-text">{{ formatAmount(row.amount) }}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.detail-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  flex: 1;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--card);
  padding: 12px 10px 10px;
  border-bottom: 1px solid rgba(107, 98, 86, 0.12);
}

.drawer-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.summary-toggle {
  border: 1px solid rgba(201, 164, 74, 0.35);
  background: rgba(255, 255, 255, 0.7);
  color: var(--muted);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.summary-inline {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.drawer-totals {
  display: flex;
  align-items: stretch;
  gap: 10px;
  flex-wrap: wrap;
  margin-right: auto;
}

.total-card {
  min-width: 150px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(107, 98, 86, 0.16);
  box-shadow: 0 6px 14px rgba(70, 58, 42, 0.08);
}

.total-card--overall {
  min-width: 180px;
  background: linear-gradient(135deg, #fff7e6 0%, #ffe8cc 100%);
  border-color: rgba(255, 171, 64, 0.35);
}

.total-card--daily {
  background: linear-gradient(135deg, #f1f5ff 0%, #e6edff 100%);
  border-color: rgba(85, 128, 255, 0.35);
}

.total-card--periodic {
  background: linear-gradient(135deg, #f1f9f3 0%, #e3f4e7 100%);
  border-color: rgba(87, 180, 120, 0.35);
}

.total-label {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.total-value {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}

.total-hint {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--muted);
}

.drawer-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.drawer-meta {
  margin: 0;
  color: var(--muted);
  white-space: nowrap;
}

.save-state {
  font-size: 12px;
}

.save-state--dirty {
  color: #d46b08;
}

.save-state--clean {
  color: var(--muted);
}

.plan-table {
  flex: 1;
  min-height: 0;
}

.plan-table :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--card);
}

.plan-table :deep(.el-scrollbar__wrap) {
  max-height: 100%;
}

.select-loading-text {
  color: var(--muted);
}

.select-placeholder {
  color: var(--ink);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.select-placeholder:hover {
  color: var(--accent);
}

.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}

.th-tip {
  color: var(--muted);
}

@media (max-width: 900px) {
  .drawer-head {
    align-items: stretch;
    flex-direction: column;
    position: static;
    padding: 6px 6px 4px;
    gap: 8px;
  }

  .drawer-head-row {
    align-items: flex-start;
  }

  .drawer-meta {
    white-space: normal;
  }

  .drawer-totals {
    margin-right: 0;
    gap: 8px;
  }

  .total-card,
  .total-card--overall {
    min-width: 0;
    flex: 1 1 calc(50% - 6px);
    padding: 6px 8px;
    border-radius: 8px;
  }

  .total-card--overall {
    flex-basis: 100%;
    order: 3;
  }

  .total-card--daily {
    order: 1;
  }

  .total-card--periodic {
    order: 2;
  }

  .total-value {
    font-size: 14px;
    margin-top: 2px;
  }

  .total-label {
    font-size: 11px;
  }

  .total-hint {
    font-size: 10px;
    margin-top: 1px;
  }

  .drawer-meta--status .save-state {
    font-size: 11px;
  }

  .drawer-actions--compact {
    width: 100%;
    gap: 8px;
  }

  .drawer-actions--compact .el-button {
    flex: 1;
    min-height: 34px;
  }

  .plan-table :deep(.el-input-number) {
    width: 120px;
  }

  .mobile-detail-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
    padding-bottom: 8px;
  }

  .mobile-detail-card {
    border: 1px solid rgba(201, 164, 74, 0.22);
    border-radius: 14px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.72);
    display: grid;
    gap: 8px;
  }

  .mobile-detail-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .mobile-detail-index {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }

  .mobile-detail-form {
    display: grid;
    gap: 10px;
  }

  .mobile-field-label {
    color: var(--muted);
    font-size: 12px;
    margin-bottom: 4px;
  }

  .mobile-field-value {
    color: var(--ink);
    font-size: 14px;
  }

  .mobile-product-row {
    display: grid;
    gap: 4px;
  }

  .mobile-read-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
  }

  .mobile-read-item {
    min-width: 0;
  }

  .mobile-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-items: center;
  }

  .mobile-detail-form :deep(.el-input-number),
  .mobile-detail-form :deep(.el-select) {
    width: 100%;
  }

  .mobile-detail-grid .mobile-read-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 52px;
  }

  .mobile-detail-grid .mobile-field-label {
    margin-bottom: 2px;
  }
}
</style>
