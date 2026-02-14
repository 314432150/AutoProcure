<script setup>
import ProductsToolbar from "../components/products/ProductsToolbar.vue";
import ProductsTable from "../components/products/ProductsTable.vue";
import ProductEditDialog from "../components/products/ProductEditDialog.vue";
import ProductBatchDialog from "../components/products/ProductBatchDialog.vue";
import ProductImportDialog from "../components/products/ProductImportDialog.vue";
import { useProductsPage } from "../composables/useProductsPage";
import { useRoute } from "vue-router";
import { useTabsStore } from "../stores/tabs";
import { onBeforeUnmount, onMounted, watch } from "vue";

const productsPage = useProductsPage();
const route = useRoute();
const tabsStore = useTabsStore();
const {
  loading,
  editOpen,
  editMode,
  items,
  categories,
  total,
  importOpen,
  importLoading,
  exportLoading,
  templateLoading,
  importResult,
  importHeaderIssue,
  confirmDeactivate,
  nameChecking,
  importGuides,
  importFieldNotes,
  query,
  editForm,
  editErrors,
  batchOpen,
  batchForm,
  volatilityTooltip,
  unitTooltip,
  quantityRuleTooltip,
  formatVolatility,
  formatDateTime,
  formatRange,
  editQuantityStep,
  batchQuantityStep,
  importHasErrors,
  importHasWarnings,
  fetchProducts,
  onSearch,
  onKeywordInput,
  openCreate,
  onNameBlur,
  openEdit,
  onSave,
  onUnitBlur,
  openBatch,
  onBatchUpdate,
  onDelete,
  onRestore,
  onExportProducts,
  onExportTemplate,
  openImport,
  onImportFileChange,
  onSortChange,
  onApplyImport,
  onDownloadImportReport,
  validateEditCategory,
  validateEditBasePrice,
  validateEditVolatility,
  validateEditItemRange,
  isDirty,
} = productsPage;

watch(
  () => isDirty.value,
  (dirty) => {
    tabsStore.setDirty(route.fullPath, dirty);
  },
  { immediate: true },
);

const onWindowKeydown = (event) => {
  const key = String(event.key || "").toLowerCase();
  const isSaveKey = (event.ctrlKey || event.metaKey) && key === "s";
  if (!isSaveKey) return;
  event.preventDefault();
  if (editOpen.value) {
    onSave();
    return;
  }
  if (batchOpen.value) {
    onBatchUpdate();
  }
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
});
</script>

<template>
  <!-- 组件说明：产品库页面，支持查询、编辑与批量设置 -->
  <section class="page">
    <ProductsToolbar
      :query="query"
      :categories="categories"
      :export-loading="exportLoading"
      @search="onSearch"
      @create="openCreate"
      @batch="openBatch"
      @import="openImport"
      @export="onExportProducts"
      @keyword-input="onKeywordInput"
    />

    <ProductsTable
      :ref="productsPage.productsTableRef"
      :items="items"
      :loading="loading"
      :query="query"
      :total="total"
      :volatility-tooltip="volatilityTooltip"
      :quantity-rule-tooltip="quantityRuleTooltip"
      :unit-tooltip="unitTooltip"
      :format-volatility="formatVolatility"
      :format-range="formatRange"
      :format-date-time="formatDateTime"
      @edit="openEdit"
      @sort-change="onSortChange"
      @delete="onDelete"
      @restore="onRestore"
      @page-change="fetchProducts"
    />

    <ProductEditDialog
      v-model:open="editOpen"
      :mode="editMode"
      :edit-form="editForm"
      :edit-errors="editErrors"
      :categories="categories"
      :name-checking="nameChecking"
      :volatility-tooltip="volatilityTooltip"
      :quantity-rule-tooltip="quantityRuleTooltip"
      :unit-tooltip="unitTooltip"
      :edit-quantity-step="editQuantityStep"
      @name-blur="onNameBlur"
      @validate-category="validateEditCategory"
      @validate-base-price="validateEditBasePrice"
      @validate-volatility="validateEditVolatility"
      @validate-item-range="validateEditItemRange"
      @unit-blur="onUnitBlur"
      @save="onSave"
    />

    <ProductBatchDialog
      v-model:open="batchOpen"
      :batch-form="batchForm"
      :categories="categories"
      :volatility-tooltip="volatilityTooltip"
      :quantity-rule-tooltip="quantityRuleTooltip"
      :unit-tooltip="unitTooltip"
      :batch-quantity-step="batchQuantityStep"
      @apply="onBatchUpdate"
    />

    <ProductImportDialog
      v-model:open="importOpen"
      :import-guides="importGuides"
      :import-field-notes="importFieldNotes"
      :import-result="importResult"
      :import-loading="importLoading"
      :template-loading="templateLoading"
      :import-has-errors="importHasErrors"
      :import-has-warnings="importHasWarnings"
      :import-header-issue="importHeaderIssue"
      :confirm-deactivate="confirmDeactivate"
      @file-change="onImportFileChange"
      @apply-import="onApplyImport"
      @download-report="onDownloadImportReport"
      @export-template="onExportTemplate"
    />
  </section>
</template>
