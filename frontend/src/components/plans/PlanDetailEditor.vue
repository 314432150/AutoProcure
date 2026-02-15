<script setup>
/** 容器职责：连接页面参数与业务逻辑，向展示组件下发数据与事件 */
import { ElMessageBox } from "element-plus";
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { useRoute } from "vue-router";
import PlanDetailTable from "@/components/plans/PlanDetailTable.vue";
import { usePlanDetailEditor } from "@/composables/usePlanDetailEditor";
import { useTabsStore } from "@/stores/tabs";
import { isCoarsePointerDevice } from "@/utils/device";

const props = defineProps({
  planDate: { type: String, default: "" },
});

/** 把字符串参数转为 ref，便于业务 composable 监听 */
const planDateRef = computed(() => props.planDate);
const route = useRoute();
const tabsStore = useTabsStore();
let lastPath = route.fullPath;
const {
  plan,
  products,
  productsLoading,
  categories,
  editItems,
  savingPlan,
  hasUnsavedChanges,
  lastSavedAt,
  quantityRuleTooltip,
  totalAmount,
  dailyAmount,
  periodicAmount,
  updateAmountByQuantity,
  onQuantityBlur,
  onProductChange,
  addRow,
  removeRow,
  sortPlanItems,
  onSavePlan,
  load,
} = usePlanDetailEditor(planDateRef);

/** 离开确认：存在未保存数据时阻断导航 */
const confirmLeaveWhenDirty = async () => {
  if (tabsStore.closingPath && tabsStore.closingPath === route.fullPath) {
    return true
  }
  if (!hasUnsavedChanges.value) {
    return true;
  }
  try {
    await ElMessageBox.confirm(
      "当前有未保存修改，离开后将丢失。是否继续离开？",
      "未保存修改",
      {
        confirmButtonText: "继续离开",
        cancelButtonText: "留在当前页",
        type: "warning",
      },
    );
    return true;
  } catch {
    return false;
  }
};

const onWindowBeforeUnload = (event) => {
  if (!hasUnsavedChanges.value) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
};

const onWindowKeydown = (event) => {
  const key = String(event.key || "").toLowerCase();
  const isSaveKey = (event.ctrlKey || event.metaKey) && key === "s";
  if (!isSaveKey) {
    return;
  }
  event.preventDefault();
  if (savingPlan.value || !plan.value) {
    return;
  }
  onSavePlan();
};

const onConfirmRemoveRow = async (index) => {
  const rowNo = Number(index) + 1;
  try {
    await ElMessageBox.confirm(
      `确认移除第 ${rowNo} 条明细吗？`,
      "移除确认",
      {
        confirmButtonText: "确认移除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
  } catch {
    return;
  }
  removeRow(index);
};

watch(
  () => hasUnsavedChanges.value,
  (dirty) => {
    tabsStore.setDirty(route.fullPath, dirty);
  },
  { immediate: true },
);

watch(
  () => route.fullPath,
  (path, prev) => {
    if (prev) {
      tabsStore.setDirty(prev, false);
    }
    lastPath = path;
    tabsStore.setDirty(path, hasUnsavedChanges.value);
  },
);

/** 日期变化时触发重载（进入页面与切换日期都生效） */
watch(
  () => props.planDate,
  async (value) => {
    if (!value) {
      return;
    }
    await load();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("beforeunload", onWindowBeforeUnload);
  if (!isCoarsePointerDevice()) {
    window.addEventListener("keydown", onWindowKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onWindowBeforeUnload);
  window.removeEventListener("keydown", onWindowKeydown);
  tabsStore.setDirty(lastPath, false);
});

onBeforeRouteLeave(async () => await confirmLeaveWhenDirty());
onBeforeRouteUpdate(async () => await confirmLeaveWhenDirty());
</script>

<template>
  <PlanDetailTable
    :plan="plan"
    :items="editItems"
    :products="products"
    :products-loading="productsLoading"
    :categories="categories"
    :total-amount="totalAmount"
    :daily-amount="dailyAmount"
    :periodic-amount="periodicAmount"
    :saving="savingPlan"
    :has-unsaved-changes="hasUnsavedChanges"
    :last-saved-at="lastSavedAt"
    :quantity-rule-tooltip="quantityRuleTooltip"
    @add-row="addRow"
    @save="onSavePlan"
    @remove-row="onConfirmRemoveRow"
    @product-change="onProductChange"
    @quantity-input="updateAmountByQuantity"
    @quantity-blur="onQuantityBlur"
    @sort-change="sortPlanItems"
  />
</template>
