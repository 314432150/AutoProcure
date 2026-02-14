<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import client, { unwrap } from "@/api/client";
import { downloadBlob } from "@/api/download";
import { bankersRound } from "@/utils/formatters";
import PlansTable from "@/components/plans/PlansTable.vue";
import PlansToolbar from "@/components/plans/PlansToolbar.vue";
import PlansExportTplDialog from "@/components/plans/PlansExportTplDialog.vue";
import { useRoute } from "vue-router";
import { useTabsStore } from "@/stores/tabs";

const now = new Date();
const currentYear = now.getFullYear();
const router = useRouter();
const route = useRoute();
const tabsStore = useTabsStore();

const generateForm = reactive({
  start_year: currentYear,
  start_month: 1,
  end_year: currentYear,
  end_month: 1,
});

const MONEY_PRECISION = 2;
const ALLOWED_EXPORT_PRECISIONS = [0, 1, 2];

const plans = ref([]);
const total = ref(0);
const monthTotal = computed(() =>
  bankersRound(
    plans.value.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    MONEY_PRECISION,
  ),
);

const loading = ref(false);
const settings = reactive({
  daily_min: null,
  daily_max: null,
});
const budgetDialogOpen = ref(false);
const budgetSaving = ref(false);
const exportLoading = ref(false);
const exportSettingsOpen = ref(false);
const exportSettingsTab = ref("template");
const exportPrecision = ref(2);
const exportSaving = ref(false);
const templatePreviewKey = ref(0);

const budgetSnapshot = ref({ min: null, max: null });
const exportSnapshot = ref(2);

const fetchPlans = async () => {
  loading.value = true;
  try {
    const resp = await client.get("/api/procurement/plans", {
      params: {
        start_year: generateForm.start_year,
        start_month: generateForm.start_month,
        end_year: generateForm.end_year,
        end_month: generateForm.end_month,
      },
    });
    const data = unwrap(resp);
    plans.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
};

const fetchSettings = async () => {
  const resp = await client.get("/api/procurement/settings");
  const data = unwrap(resp);
  settings.daily_min = data.daily_budget_range?.min ?? null;
  settings.daily_max = data.daily_budget_range?.max ?? null;
  if (settings.daily_min !== null) {
    settings.daily_min = bankersRound(settings.daily_min, MONEY_PRECISION);
  }
  if (settings.daily_max !== null) {
    settings.daily_max = bankersRound(settings.daily_max, MONEY_PRECISION);
  }
};

const fetchExportSettings = async () => {
  const resp = await client.get("/api/procurement/exports/settings");
  const value = Number(unwrap(resp)?.export_precision ?? 2);
  exportPrecision.value = ALLOWED_EXPORT_PRECISIONS.includes(value) ? value : 2;
};

const resolveRequestErrorMessage = (error) =>
  error?.response?.data?.message || error?.response?.data?.detail || error?.message || "请求失败";

const isBudgetRangeConfigError = (error) => {
  const payload = error?.response?.data || {};
  const message = payload?.message || payload?.detail || "";
  return Number(payload?.code) === 4104 || message === "未配置预算区间" || message === "预算区间无效";
};

const generatePlans = async (forceOverwrite = false, refresh = true) => {
  const resp = await client.post("/api/procurement/generate", null, {
    params: {
      ...generateForm,
      force_overwrite: forceOverwrite,
    },
    suppressError: true,
  });
  const data = unwrap(resp);
  if (data.status !== "冲突") {
    ElMessage.success("生成成功");
  }
  if (data.warnings?.length) {
    ElMessage.warning(`预算不可行提示 ${data.warnings.length} 条`);
  }
  if (refresh) {
    fetchPlans();
  }
  return data;
};

const onGenerate = async () => {
  let data;
  try {
    data = await generatePlans(false, false);
  } catch (error) {
    if (isBudgetRangeConfigError(error)) {
      await fetchSettings().catch(() => {});
      budgetDialogOpen.value = true;
      ElMessage.warning("请先设置预算区间");
      return;
    }
    ElMessage.warning(resolveRequestErrorMessage(error));
    return;
  }
  if (data?.status !== "冲突") {
    fetchPlans();
    return;
  }
  try {
    await ElMessageBox.confirm(
      "检测到冲突月份，是否覆盖并继续生成？",
      "生成确认",
      { type: "warning", confirmButtonText: "继续生成", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  try {
    await generatePlans(true);
  } catch (error) {
    if (isBudgetRangeConfigError(error)) {
      await fetchSettings().catch(() => {});
      budgetDialogOpen.value = true;
      ElMessage.warning("请先设置预算区间");
      return;
    }
    ElMessage.warning(resolveRequestErrorMessage(error));
  }
};

const onPlanAction = async (command) => {
  if (command === "budget") {
    budgetDialogOpen.value = true;
  }
};

const onExport = async () => {
  if (exportLoading.value) {
    return;
  }
  if (Number(total.value || 0) <= 0) {
    ElMessage.warning("当前选中时间区间无采购计划数据，无法导出");
    return;
  }
  if (exportPrecision.value !== 2) {
    try {
      await ElMessageBox.confirm(
        `当前导出金额精度为 ${exportPrecision.value} 位，小计/总计与系统内显示可能不一致，是否继续导出？`,
        "导出提示",
        { type: "warning", confirmButtonText: "继续导出", cancelButtonText: "取消" },
      );
    } catch {
      return;
    }
  }
  exportLoading.value = true;
  try {
    const response = await client.post("/api/procurement/exports", null, {
      params: {
        start_year: generateForm.start_year,
        start_month: generateForm.start_month,
        end_year: generateForm.end_year,
        end_month: generateForm.end_month,
      },
      responseType: "blob",
    });
    const filename = `采购清单_${generateForm.start_year}${String(generateForm.start_month).padStart(2, "0")}_${generateForm.end_year}${String(generateForm.end_month).padStart(2, "0")}.zip`;
    downloadBlob(response.data, filename);
    ElMessage.success("已开始下载");
  } catch (error) {
    const message = error?.response?.data?.message || error?.response?.data?.detail || "导出失败";
    ElMessage.warning(message);
  } finally {
    exportLoading.value = false;
  }
};

const onSaveExportPrecision = async () => {
  const value = Number(exportPrecision.value);
  if (!Number.isFinite(value) || !ALLOWED_EXPORT_PRECISIONS.includes(value)) {
    ElMessage.warning("导出金额精度仅支持 0、1、2");
    return;
  }
  exportSaving.value = true;
  try {
    await client.put("/api/procurement/exports/settings", {
      export_precision: value,
    });
    ElMessage.success("导出金额精度已保存");
    exportSettingsOpen.value = false;
  } finally {
    exportSaving.value = false;
  }
};

const onOpenTemplateEdit = () => {
  exportSettingsTab.value = "template";
  exportSettingsOpen.value = true;
};

const onOpenPrecisionEdit = () => {
  exportSettingsTab.value = "precision";
  exportSettingsOpen.value = true;
};

const onTemplateClose = () => {
  exportSettingsOpen.value = false;
  templatePreviewKey.value += 1;
};

const buildRange = (min, max, label) => {
  if (min === null && max === null) {
    return null;
  }
  if (min === null || max === null) {
    ElMessage.warning(`${label}请同时填写最小值与最大值，或全部留空`);
    return undefined;
  }
  if (Number(min) > Number(max)) {
    ElMessage.warning(`${label}最小值不能大于最大值`);
    return undefined;
  }
  return { min: Number(min), max: Number(max) };
};

const onSaveBudget = async () => {
  const dailyRange = buildRange(settings.daily_min, settings.daily_max, "日预算区间");
  if (dailyRange === undefined) {
    return;
  }
  if (dailyRange !== null) {
    settings.daily_min = bankersRound(dailyRange.min, MONEY_PRECISION);
    settings.daily_max = bankersRound(dailyRange.max, MONEY_PRECISION);
  }
  budgetSaving.value = true;
  try {
    await client.put("/api/procurement/settings", {
      daily_budget_range: dailyRange,
    });
    ElMessage.success("预算设置已保存");
    budgetDialogOpen.value = false;
  } finally {
    budgetSaving.value = false;
  }
};

const onExportAction = async (command) => {
  if (command === "template") {
    onOpenTemplateEdit();
    return;
  }
  if (command === "precision") {
    onOpenPrecisionEdit();
  }
};

const formatAmount = (value) => bankersRound(value, MONEY_PRECISION).toFixed(MONEY_PRECISION);
const formatWarningDetail = (warn) => {
  if (!warn) return "";
  if (warn.reason === "日采总额高于预算上限") {
    if (warn.total_amount && warn.budget_max) {
      return `日采总额 ${formatAmount(warn.total_amount)} > 上限 ${formatAmount(warn.budget_max)}`;
    }
  }
  if (warn.reason === "日采总额低于预算下限") {
    if (warn.total_amount && warn.budget_min) {
      return `日采总额 ${formatAmount(warn.total_amount)} < 下限 ${formatAmount(warn.budget_min)}`;
    }
  }
  if (warn.reason === "最低成本高于预算上限") {
    if (warn.min_cost && warn.budget_max) {
      return `最低成本 ${formatAmount(warn.min_cost)} > 上限 ${formatAmount(warn.budget_max)}`;
    }
  }
  return warn.reason || "";
};
const plansWithWarnings = computed(() =>
  (plans.value || []).map((plan) => ({
    ...plan,
    warnings: (plan.warnings || []).map((warn) => ({
      ...warn,
      date: warn.date || plan.date,
      detail: formatWarningDetail(warn),
    })),
  })),
);

const warningRows = computed(() =>
  plansWithWarnings.value.flatMap((plan) => plan.warnings || []),
);

const warningCount = computed(() => warningRows.value.length);

const openPlan = async (row) => {
  await router.push(`/plans/${row.date}`);
};

onMounted(() => {
  fetchSettings();
  fetchExportSettings();
  fetchPlans();
});

const onWindowKeydown = (event) => {
  const key = String(event.key || "").toLowerCase();
  const isSaveKey = (event.ctrlKey || event.metaKey) && key === "s";
  if (!isSaveKey) return;
  event.preventDefault();
  if (budgetDialogOpen.value) {
    if (!budgetSaving.value) {
      onSaveBudget();
    }
    return;
  }
  if (exportSettingsOpen.value && exportSettingsTab.value === "precision") {
    if (!exportSaving.value) {
      onSaveExportPrecision();
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
});

watch(
  () => budgetDialogOpen.value,
  (open) => {
    if (open) {
      budgetSnapshot.value = {
        min: settings.daily_min,
        max: settings.daily_max,
      };
    }
  },
);

watch(
  () => exportSettingsOpen.value,
  (open) => {
    if (open) {
      exportSnapshot.value = Number(exportPrecision.value);
    }
  },
);

const budgetDirty = computed(() => {
  if (!budgetDialogOpen.value) return false;
  return (
    Number(settings.daily_min ?? 0) !== Number(budgetSnapshot.value.min ?? 0) ||
    Number(settings.daily_max ?? 0) !== Number(budgetSnapshot.value.max ?? 0)
  );
});

const exportDirty = computed(() => {
  if (!exportSettingsOpen.value) return false;
  return Number(exportPrecision.value) !== Number(exportSnapshot.value);
});

const pageDirty = computed(() => budgetDirty.value || exportDirty.value);

watch(
  () => pageDirty.value,
  (dirty) => {
    tabsStore.setDirty(route.fullPath, dirty);
  },
  { immediate: true },
);

watch(
  () => [
    generateForm.start_year,
    generateForm.start_month,
    generateForm.end_year,
    generateForm.end_month,
  ],
  () => {
    fetchPlans();
  },
);
</script>

<template>
  <section class="page">
    <PlansToolbar
      v-model:start-year="generateForm.start_year"
      v-model:start-month="generateForm.start_month"
      v-model:end-year="generateForm.end_year"
      v-model:end-month="generateForm.end_month"
      :export-loading="exportLoading"
      :warning-count="warningCount"
      @generate="onGenerate"
      @plan-action="onPlanAction"
      @export="onExport"
      @export-action="onExportAction"
    />

    <el-card class="card table-card">
      <PlansTable
        :items="plansWithWarnings"
        :loading="loading"
        :total="total"
        :month-total="monthTotal"
        :show-updated-at="true"
        :merge-year-month="true"
        :default-year-month="`${generateForm.start_year}-${String(generateForm.start_month).padStart(2, '0')}`"
        @row-dblclick="openPlan"
      />
    </el-card>

    <el-dialog v-model="exportSettingsOpen" title="导出设置" width="80%">
      <el-tabs v-model="exportSettingsTab">
        <el-tab-pane label="模板编辑" name="template">
          <PlansExportTplDialog
            :key="templatePreviewKey"
            @close="onTemplateClose"
            :readOnly="false"
            :year="generateForm.start_year"
            :month="generateForm.start_month"
            :maxRows="1"
          />
        </el-tab-pane>
        <el-tab-pane label="精度设置" name="precision">
          <div class="precision-panel">
            <div class="precision-row">
              <span class="precision-label">导出金额精度(位)</span>
              <el-radio-group v-model="exportPrecision">
                <el-radio-button
                  v-for="opt in ALLOWED_EXPORT_PRECISIONS"
                  :key="opt"
                  :label="opt"
                >
                  {{ opt }}
                </el-radio-button>
              </el-radio-group>
            </div>
            <p class="precision-tip">
              精度越高，小数位越多；仅用于导出表格显示，不影响系统内计算。
            </p>
            <p class="precision-tip warning">
              若精度设置为 0 或 1 位，小计/总计会按导出精度重新计算，可能与系统内显示不一致。
            </p>
            <div class="precision-actions">
              <el-button @click="exportSettingsOpen = false">取消</el-button>
              <el-button type="primary" :loading="exportSaving" @click="onSaveExportPrecision">
                保存
              </el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <el-dialog v-model="budgetDialogOpen" title="预算设置" width="440">
      <div class="budget-panel">
        <div class="budget-title">日预算区间(元)</div>
        <div class="budget-row">
          <el-input-number
            v-model="settings.daily_min"
            :min="0"
            :precision="MONEY_PRECISION"
            :step="1 / Math.pow(10, MONEY_PRECISION)"
            placeholder="最小"
          />
          <span>至</span>
          <el-input-number
            v-model="settings.daily_max"
            :min="0"
            :precision="MONEY_PRECISION"
            :step="1 / Math.pow(10, MONEY_PRECISION)"
            placeholder="最大"
          />
        </div>
        <div class="budget-actions">
          <el-button @click="budgetDialogOpen = false">取消</el-button>
          <el-button type="primary" :loading="budgetSaving" @click="onSaveBudget">
            保存
          </el-button>
        </div>
      </div>
    </el-dialog>

  </section>
</template>

<style scoped>
.budget-panel {
  display: grid;
  gap: 10px;
}

.budget-title {
  font-weight: 600;
}

.budget-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.budget-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.budget-panel :deep(.el-input-number) {
  width: 150px;
}

.precision-panel {
  display: grid;
  gap: 12px;
}

.precision-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.precision-label {
  font-size: 13px;
  color: var(--ink);
  white-space: nowrap;
}

.precision-tip {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.precision-tip.warning {
  color: var(--warning);
}

.precision-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
