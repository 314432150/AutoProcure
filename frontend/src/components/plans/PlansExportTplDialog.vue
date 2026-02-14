<script setup>
defineOptions({ name: "PlansExportTplDialog" });
import { computed, onMounted, reactive, ref, watch } from "vue";
import { InfoFilled } from "@element-plus/icons-vue";

const props = defineProps({
  readOnly: { type: Boolean, default: false },
  year: { type: Number, required: false },
  month: { type: Number, required: false },
  maxRows: { type: Number, required: false },
});
const emit = defineEmits(["close"]);

import { ElMessage } from "element-plus";
import client, { unwrap } from "@/api/client";

const defaultTemplate = {
  title: "{year}年{month:02d}月采购开支明细表",
  columns: [
    { label: "序号", field: "序号" },
    { label: "时间", field: "时间" },
    { label: "物资及金额", field: "物资及金额" },
    { label: "小计（元）", field: "小计（元）" },
    { label: "经手人", field: "经手人" },
    { label: "证明人", field: "证明人" },
  ],
};

const previewLoading = ref(false);
const previewRows = ref([]);
const previewTotal = ref("");

const templateSaving = ref(false);
const dragIndex = ref(null);

const templateForm = reactive({
  title: defaultTemplate.title,
  columns: [...defaultTemplate.columns],
});

const previewDate = reactive({
  year: props.year || 2026,
  month: props.month || 1,
});

const visibleMaxRows = computed(
  () => props.maxRows ?? (props.readOnly ? 3 : 1),
);

const visibleRows = computed(() => {
  return previewRows.value.slice(0, visibleMaxRows.value);
});

const previewTitle = computed(() => {
  const title = templateForm.title || defaultTemplate.title;
  const monthText2d = String(previewDate.month).padStart(2, "0");
  const monthText = String(previewDate.month);
  return title
    .replace("{year}", String(previewDate.year))
    .replace("{month:02d}", monthText2d)
    .replace("{month}", monthText);
});

const previewColumns = computed(() =>
  templateForm.columns.length ? templateForm.columns : defaultTemplate.columns,
);

/** 获取预览行的字段显示值 */
const getPreviewValue = (row, col) => {
  // Try multiple candidates (field then label) after trimming, map common labels,
  // and return 0 values as-is.
  const mapping = {
    序号: "index",
    时间: "date_text",
    日期: "date_text",
    物资及金额: "items_text",
    "小计（元）": "day_total",
    经手人: "handler",
    证明人: "witness",
  };

  const candidates = [];
  if (col) {
    if (col.field) candidates.push(String(col.field).trim());
    if (col.label) candidates.push(String(col.label).trim());
  }
  // ensure we always check these common labels as last resort
  candidates.push("序号", "时间", "物资及金额", "小计（元）");

  for (const cand of candidates) {
    if (!cand) continue;
    const key = mapping[cand] || cand;
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const v = row[key];
      return v === 0 ? 0 : (v ?? "");
    }
  }

  return "";
};


/** 新增模板列 */
const addColumn = () => {
  templateForm.columns.push({ label: "", field: "" });
};

/** 删除模板列 */
const removeColumn = (index) => {
  templateForm.columns.splice(index, 1);
};

/** 保存模板配置 */
const onSaveTemplate = async () => {
  if (!templateForm.title.trim()) {
    ElMessage.warning("请填写模板标题");
    return;
  }
  if (!templateForm.columns.length) {
    ElMessage.warning("请至少添加一列");
    return;
  }
  if (templateForm.columns.some((col) => !col.label)) {
    ElMessage.warning("列标题不能为空");
    return;
  }

  // Do not overwrite `field` when editing labels — only send columns as-is.

  templateSaving.value = true;
  try {
    await client.put(`/api/procurement/exports/templates/single`, {
      title: templateForm.title,
      columns: templateForm.columns,
    });
    ElMessage.success("模板已保存");
  // 通知父组件关闭编辑弹窗
    try {
      emit("close");
    } catch (e) {
      // ignore if parent doesn't listen
    }
  } finally {
    templateSaving.value = false;
  }
};

/** 拖拽开始记录索引 */
const onDragStart = (index) => {
  dragIndex.value = index;
};

/** 拖拽放置并调整列顺序 */
const onDrop = (index) => {
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null;
    return;
  }
  const next = [...templateForm.columns];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(index, 0, moved);
  templateForm.columns = next;
  dragIndex.value = null;
};

/** 获取模板预览数据 */
const fetchPreview = async (maxRows) => {
  previewLoading.value = true;
  try {
    const resp = await client.get("/api/procurement/exports/preview", {
      params: {
        year: previewDate.year,
        month: previewDate.month,
        max_rows: maxRows || 3,
      },
    });
    const payload = unwrap(resp);
    previewRows.value = payload.rows || [];
    previewTotal.value = payload.month_total || "";
  } catch (e) {
    previewRows.value = [];
    previewTotal.value = "";
  } finally {
    previewLoading.value = false;
  }
};

onMounted(() => {
  // 如果父组件传入 year/month，则使用它们
  if (props.year && props.month) {
    previewDate.year = props.year;
    previewDate.month = props.month;
  }
  const maxRows = props.maxRows ?? (props.readOnly ? 3 : 1);
  fetchPreview(maxRows);

  // 获取单一模板
  client.get("/api/procurement/exports/templates/single").then((resp) => {
    const tpl = unwrap(resp);
    if (tpl) {
      templateForm.title = tpl.title || defaultTemplate.title;
      templateForm.columns = (tpl.columns || defaultTemplate.columns).map(
        (col) => ({
          label: col.label || "",
          field: col.field || col.label || "",
        }),
      );
    }
  });
});

watch(
  () => [props.year, props.month],
  ([y, m]) => {
    if (y && m) {
      previewDate.year = y;
      previewDate.month = m;
      const maxRows = props.maxRows ?? (props.readOnly ? 3 : 1);
      fetchPreview(maxRows);
    }
  },
);

</script>

<template>
  <!-- 组件说明：采购计划导出模板编辑组件，支持列配置与预览 -->
  <div class="plan-template-layout">
    <el-card>
      <div class="plan-template-row">
        <div
          style="min-width: 120px; display: flex; align-items: center; gap: 8px"
        >
          <template v-if="!props.readOnly">
            <el-input
              v-model="templateForm.title"
              placeholder="模板标题"
              style="width: 480px; max-width: 60vw"
            />
          </template>

          <el-tooltip placement="top" effect="dark" v-if="!props.readOnly">
            <template #content>
              <div style="line-height: 1.6">
                <b>用法说明：</b><br />
                {year} 表示年份，如 2026<br />
                {month} 表示月份（不补零），如 1、2、12<br />
                {month:02d} 表示两位数字月份（补零），如 01、02、12
              </div>
            </template>
            <el-icon class="plan-template-tip">
              <InfoFilled />
            </el-icon>
          </el-tooltip>
        </div>
      </div>
      <div class="plan-template-controls" v-if="!(props.year && props.month)">
        <el-input-number v-model="previewDate.year" :min="2000" label="年份" />
        <el-input-number
          v-model="previewDate.month"
          :min="1"
          :max="12"
          label="月份"
        />
      </div>
      <div class="plan-template-preview">
        <div class="plan-template-title">{{ previewTitle }}</div>
        <table class="plan-template-table">
          <thead>
            <tr>
              <th
                v-for="(col, index) in previewColumns"
                :key="`${col.field ?? col.label}-${index}`"
                :draggable="!props.readOnly"
                @dragstart.prevent="!props.readOnly && onDragStart(index)"
                @dragover.prevent
                @drop.prevent="!props.readOnly && onDrop(index)"
                :class="{ 'plan-template-items': col.label === '物资及金额' }"
              >
                <template v-if="props.readOnly">
                  <div style="padding: 6px 4px">{{ col.label }}</div>
                </template>
                <template v-else>
                  <div class="plan-template-header">
                    <span class="plan-template-drag">≡</span>
                    <el-input v-model="col.label" placeholder="列标题" />
                    <el-button type="danger" link @click="removeColumn(index)"
                      >移除</el-button
                    >
                  </div>
                </template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="previewLoading">
              <td :colspan="previewColumns.length">加载中...</td>
            </tr>
            <tr v-else-if="previewRows.length === 0">
              <td :colspan="previewColumns.length">暂无数据</td>
            </tr>
            <tr v-for="row in visibleRows" :key="row.index">
              <td
                v-for="col in previewColumns"
                :key="col.field ?? col.label"
                :class="{ 'plan-template-items': col.label === '物资及金额' }"
              >
                {{ getPreviewValue(row, col) }}
              </td>
            </tr>
            <tr v-if="visibleRows.length" class="plan-template-ellipsis">
              <td :colspan="previewColumns.length">…</td>
            </tr>
            <tr class="plan-template-total">
              <td v-for="col in previewColumns" :key="col.label">
                {{
                  col.label.includes("序号")
                    ? "总计"
                    : col.label.includes("小计")
                      ? previewTotal
                      : ""
                }}
              </td>
            </tr>
          </tbody>
        </table>
        <div class="plan-template-actions" v-if="!props.readOnly">
          <el-button class="plan-template-add" plain @click="addColumn"
            >新增列</el-button
          >
        </div>
      </div>
      <div class="plan-template-save" v-if="!props.readOnly">
        <el-button
          type="primary"
          :loading="templateSaving"
          @click="onSaveTemplate"
          >保存模板</el-button
        >
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.plan-template-layout {
  display: grid;
  gap: 18px;
}

.plan-template-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.plan-template-row :deep(.el-select) {
  width: 200px;
}
.plan-template-row :deep(.el-input) {
  min-width: 120px;
}

.plan-template-row .plan-template-tip {
  margin-left: 8px;
}

.plan-template-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.plan-template-title {
  text-align: center;
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 12px;
}

.plan-template-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  table-layout: auto;
}

.plan-template-table th,
.plan-template-table td {
  border: 1px solid rgba(31, 28, 23, 0.4);
  padding: 6px 8px;
  text-align: center;
  vertical-align: middle;
}

/* Strong shrink for non-items columns: nowrap and minimal base width;
   overflow + ellipsis to avoid forcing table expansion. */
.plan-template-table th:not(.plan-template-items),
.plan-template-table td:not(.plan-template-items) {
  /* keep single-line display but allow reasonable width before truncating */
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-template-table td:nth-child(3),
.plan-template-table th:nth-child(3) {
  text-align: left;
}

.plan-template-items {
  /* Items column should expand to fill remaining space and allow wrapping */
  width: auto;
  min-width: 240px;
  text-align: left;
  white-space: normal;
  word-break: break-word;
}

.plan-template-total td {
  font-weight: 600;
}

.plan-template-ellipsis td {
  text-align: center;
  color: var(--muted);
  font-weight: 600;
  letter-spacing: 2px;
}

.plan-template-header {
  display: grid;
  gap: 6px;
  align-items: center;
}

.plan-template-header :deep(.el-input__wrapper) {
  min-height: 30px;
}

.plan-template-drag {
  cursor: grab;
  color: var(--muted);
  font-size: 16px;
  text-align: center;
}

.plan-template-actions {
  margin-top: 10px;
}

.plan-template-save {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

@media (max-width: 900px) {
  .plan-template-controls {
    align-items: stretch;
  }

  .plan-template-controls :deep(.el-input-number) {
    width: 100%;
  }

  .plan-template-save {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
