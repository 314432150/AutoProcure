<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  importGuides: {
    type: Array,
    default: () => [],
  },
  importFieldNotes: {
    type: Array,
    default: () => [],
  },
  importResult: {
    type: Object,
    default: null,
  },
  importLoading: {
    type: Boolean,
    default: false,
  },
  templateLoading: {
    type: Boolean,
    default: false,
  },
  importHasErrors: {
    type: Boolean,
    default: false,
  },
  importHasWarnings: {
    type: Boolean,
    default: false,
  },
  importHeaderIssue: {
    type: Object,
    default: null,
  },
  confirmDeactivate: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update:open",
  "file-change",
  "apply-import",
  "download-report",
  "export-template",
]);

const uploadKey = ref(0);
const uploadRef = ref(null);
const detailDrawerOpen = ref(false);
const detailTab = ref("report");

const headerIssueRows = computed(() => {
  if (!props.importHeaderIssue) return [];
  const missing = props.importHeaderIssue.missing || [];
  const extra = props.importHeaderIssue.extra || [];
  return [
    { type: "缺少字段", values: missing.join("、") || "无" },
    { type: "多余字段", values: extra.join("、") || "无" },
  ];
});

const deactivateCandidates = computed(
  () => props.importResult?.deactivate_candidates || [],
);

const fieldLabelMap = computed(() => {
  const map = {};
  (props.importFieldNotes || []).forEach((item) => {
    if (item?.label) {
      map[item.label] = item.label;
    }
  });
  return {
    name: "产品名称",
    category_name: "品类名称",
    unit: "单位",
    base_price: "单价(元)",
    volatility: "单价波动(%)",
    item_quantity_range_min: "采购数量范围-最小",
    item_quantity_range_max: "采购数量范围-最大",
    item_quantity_range: "采购数量范围",
    is_active: "启用状态",
    ...map,
  };
});

const formatFieldLabel = (field) => {
  if (!field) return "";
  return fieldLabelMap.value[field] || field;
};

const reportRows = computed(() => {
  const rows = [];
  (props.importResult?.errors || []).forEach((item) => {
    rows.push({
      type: "错误",
      row: item.row,
      field: formatFieldLabel(item.field),
      message: item.message,
      value: item.value ?? "",
    });
  });
  (props.importResult?.warnings || []).forEach((item) => {
    rows.push({
      type: "警告",
      row: item.row,
      field: formatFieldLabel(item.field),
      message: item.message,
      value: item.value ?? "",
    });
  });
  (props.importResult?.deactivate_candidates || []).forEach((name) => {
    rows.push({
      type: "作废",
      row: "",
      field: "产品名称",
      message: "Excel 中不存在，导入后作废",
      value: name,
    });
  });
  return rows;
});

const openDetails = (tab = "report") => {
  detailTab.value = tab;
  detailDrawerOpen.value = true;
};

const onUploadClick = () => {
  uploadRef.value?.clearFiles?.();
};

watch(
  () => props.open,
  (value) => {
    if (!value) return;
    uploadKey.value += 1;
    detailDrawerOpen.value = false;
    detailTab.value = "notes";
  },
);

watch(
  () => props.importHeaderIssue,
  (value) => {
    if (!value) return;
    detailTab.value = "report";
    detailDrawerOpen.value = true;
  },
);

watch(
  () => props.importHasErrors,
  (value) => {
    if (!value) return;
    detailTab.value = "report";
    detailDrawerOpen.value = true;
  },
);

watch(
  () => props.importHasWarnings,
  (value) => {
    if (!value) return;
    detailTab.value = "report";
    detailDrawerOpen.value = true;
  },
);

watch(
  () => props.confirmDeactivate,
  (value) => {
    if (!value) return;
    detailTab.value = "report";
    detailDrawerOpen.value = true;
  },
);
</script>

<template>
  <el-dialog
    :model-value="open"
    title="导入产品库"
    width="720px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="true"
    @update:model-value="(value) => emit('update:open', value)"
  >
    <div class="import-block">
        <div class="import-guide">
          <div class="import-guide-title">使用说明</div>
          <ul>
            <li v-for="item in importGuides" :key="item">{{ item }}</li>
          </ul>
          <el-button
            type="primary"
            plain
            :loading="templateLoading"
            :disabled="templateLoading"
          @click="emit('export-template')"
        >
          模板下载
        </el-button>
      </div>
      <div class="import-upload">
        <el-upload
          :key="uploadKey"
          ref="uploadRef"
          class="upload-shell"
          drag
          :auto-upload="false"
          :show-file-list="true"
          :limit="1"
          accept=".xlsx"
          :on-change="(file) => emit('file-change', file)"
          @click="onUploadClick"
        >
          <div class="el-upload__text">拖拽或点击上传 .xlsx 文件</div>
        </el-upload>
        <div v-if="importResult" class="import-summary">
          <div class="summary-item">总行数：{{ importResult.total }}</div>
          <div class="summary-item">可导入：{{ importResult.valid }}</div>
          <div class="summary-item">跳过：{{ importResult.skipped }}</div>
          <div class="summary-item">新增：{{ importResult.created }}</div>
          <div class="summary-item">更新：{{ importResult.updated }}</div>
          <div class="summary-item">错误：{{ importResult.errors.length }}</div>
          <div class="summary-item">
            作废：{{ importResult.deactivate_candidates?.length || 0 }}
          </div>
        </div>
        <div v-if="confirmDeactivate" class="import-confirm-tip">
          请确认作废清单后点击“确认导入”。
        </div>
        <div
          v-if="importResult && !importHasErrors && !importHasWarnings"
          class="import-success"
        >
          校验通过，可直接导入。
        </div>
        <div v-if="importResult || importHeaderIssue" class="import-actions">
          <el-alert
            v-if="importHasErrors"
            type="error"
            title="存在校验错误，请先修复"
            show-icon
            class="import-alert"
          />
          <el-alert
            v-else-if="importHasWarnings"
            type="warning"
            title="存在警告，请确认后导入"
            show-icon
            class="import-alert"
          />
          <el-alert
            v-else-if="importHeaderIssue"
            type="error"
            title="模板表头不匹配"
            show-icon
            class="import-alert"
          />
          <div class="import-action-row">
            <el-button
              v-if="importHasErrors || importHasWarnings"
              plain
              size="small"
              @click="openDetails('report')"
            >
              查看导入报告
            </el-button>
            <el-button plain size="small" @click="openDetails('notes')">
              字段说明
            </el-button>
            <el-button
              v-if="importHeaderIssue"
              plain
              size="small"
              @click="openDetails('report')"
            >
              查看表头原因
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button
        type="primary"
        :loading="importLoading"
        :disabled="!importResult || importHasErrors"
        @click="emit('apply-import')"
      >
        {{ confirmDeactivate ? "确认导入" : "开始导入" }}
      </el-button>
    </template>

    <el-drawer
      v-model="detailDrawerOpen"
      direction="rtl"
      size="50%"
      title="导入详情"
    >
      <el-tabs v-model="detailTab">
        <el-tab-pane label="导入报告" name="report">
          <div class="drawer-report">
            <div v-if="importHeaderIssue" class="header-issue">
              <div class="header-issue-title">
                模板表头不匹配（第 {{ importHeaderIssue.row }} 行）
              </div>
              <el-table
                :data="headerIssueRows"
                size="small"
                border
                class="header-issue-table"
              >
                <el-table-column prop="type" label="类型" width="120" />
                <el-table-column prop="values" label="字段" />
              </el-table>
            </div>
            <el-alert
              v-if="importHasErrors"
              type="error"
              title="存在校验错误，请先修复"
              show-icon
              class="import-alert"
            />
            <el-alert
              v-else-if="importHasWarnings"
              type="warning"
              title="存在警告，请确认后导入"
              show-icon
              class="import-alert"
            />
            <div class="report-content">
              <el-table :data="reportRows" size="small" border height="100%">
                <el-table-column prop="type" label="类型" width="80" />
                <el-table-column prop="row" label="行号" width="80" />
                <el-table-column prop="field" label="字段" width="140" />
                <el-table-column prop="message" label="原因" />
                <el-table-column prop="value" label="原值" width="160" />
              </el-table>
            </div>
            <div
              v-if="
                importHasErrors ||
                importHasWarnings ||
                deactivateCandidates.length
              "
              class="report-footer"
            >
              <el-button
                type="primary"
                plain
                size="small"
                @click="emit('download-report')"
              >
                下载导入报告
              </el-button>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="字段说明" name="notes">
          <el-table :data="importFieldNotes" size="small" border>
            <el-table-column prop="label" label="字段" width="180" />
            <el-table-column prop="desc" label="说明" />
            <el-table-column prop="example" label="示例" width="140" />
            <el-table-column prop="required" label="必填" width="80" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </el-dialog>
</template>

<style scoped>
.import-block {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;
}
.import-guide {
  background: #f8f7f5;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.import-guide-title {
  font-weight: 600;
  color: #333;
}
.import-guide ul {
  margin: 0;
  padding-left: 16px;
  color: #666;
}
.import-upload {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.import-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  color: #333;
}
.import-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.import-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.import-alert {
  margin-top: 4px;
}
.import-confirm-tip {
  color: #b42318;
  font-size: 12px;
}
.import-success {
  color: #2e7d32;
  font-size: 12px;
}
.drawer-report {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 320px);
}
.report-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding-right: 4px;
}
.report-footer {
  position: sticky;
  bottom: 0;
  background: #fff;
  padding: 8px 0 4px;
  border-top: 1px solid #f1f1f1;
}
.header-issue-title {
  font-weight: 600;
  color: #c45656;
}
.header-issue-table :deep(.el-table__cell) {
  vertical-align: top;
}
@media (max-width: 960px) {
  .import-block {
    grid-template-columns: 1fr;
  }
}
</style>
