import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import client, { unwrap } from "../api/client";
import { downloadBlob } from "../api/download";
import { formatDateTime, formatRange } from "../utils/formatters";
import { useProductRules } from "./useProductRules";

export const useProductsPage = () => {
  const loading = ref(false);
  const editOpen = ref(false);
  const editMode = ref("create");
  const productsTableRef = ref(null);
  const items = ref([]);
  const categories = ref([]);
  const total = ref(0);
  const importOpen = ref(false);
  const importLoading = ref(false);
  const exportLoading = ref(false);
  const templateLoading = ref(false);
  const importFile = ref(null);
  const importResult = ref(null);
  const importHeaderIssue = ref(null);
  const confirmDeactivate = ref(false);
  const splittableUnits = ref([]);
  const nameChecking = ref(false);
  const isBootstrapping = ref(true);
  const isApplyingSort = ref(false);

  const importGuides = ["请使用模板填写数据，表头不可修改"];

  const importFieldNotes = [
    {
      label: "产品名称",
      desc: "产品名称（唯一）",
      example: "土豆",
      required: "是",
    },
    { label: "品类名称", desc: "品类名称", example: "蔬菜", required: "是" },
    { label: "单位", desc: "计量单位", example: "斤", required: "是" },
    {
      label: "单价(元)",
      desc: "基础单价（固定两位小数，最小 0.01）",
      example: "3.50",
      required: "是",
    },
    {
      label: "单价波动(%)",
      desc: "单价波动百分比",
      example: "5",
      required: "是",
    },
    {
      label: "采购数量范围-最小",
      desc: "采购数量范围下限",
      example: "1",
      required: "是",
    },
    {
      label: "采购数量范围-最大",
      desc: "采购数量范围上限",
      example: "3",
      required: "是",
    },
    {
      label: "启用状态",
      desc: "是否启用",
      example: "启用/已作废",
      required: "是",
    },
  ];
  const importHeaderLabels = importFieldNotes.map((item) => item.label);

  const query = reactive({
    keyword: "",
    category_id: "",
    is_active: true,
    page: 1,
    page_size: 20,
    sort_by: "",
    sort_order: "",
  });

  const editForm = reactive({
    id: "",
    name: "",
    category_id: "",
    category_name: "",
    unit: "",
    base_price: "",
    volatility_percent: null,
    item_quantity_min: null,
    item_quantity_max: null,
  });
  const editErrors = reactive({
    name: "",
    category_id: "",
    base_price: "",
    volatility_percent: "",
    item_quantity_range: "",
    unit: "",
  });

  const batchOpen = ref(false);
  const batchForm = reactive({
    category_id: "",
    update_volatility: false,
    update_item_quantity: false,
    update_unit: false,
    volatility_percent: null,
    unit: "",
    item_quantity_min: null,
    item_quantity_max: null,
  });

  const editSnapshot = ref(null);
  const batchSnapshot = ref(null);

  const buildEditSnapshot = () => ({
    name: editForm.name,
    category_id: editForm.category_id,
    unit: editForm.unit,
    base_price: editForm.base_price,
    volatility_percent: editForm.volatility_percent,
    item_quantity_min: editForm.item_quantity_min,
    item_quantity_max: editForm.item_quantity_max,
  });

  const buildBatchSnapshot = () => ({
    category_id: batchForm.category_id,
    update_volatility: batchForm.update_volatility,
    update_item_quantity: batchForm.update_item_quantity,
    update_unit: batchForm.update_unit,
    volatility_percent: batchForm.volatility_percent,
    unit: batchForm.unit,
    item_quantity_min: batchForm.item_quantity_min,
    item_quantity_max: batchForm.item_quantity_max,
  });

  const {
    volatilityTooltip,
    unitTooltip,
    quantityRuleTooltip,
    formatVolatility,
    buildRange,
    validateRangeByUnitStep,
    normalizeUnitInput,
    quantityStepByUnit,
  } = useProductRules(splittableUnits);

  const fetchCategories = async () => {
    const resp = await client.get("/api/categories", {
      params: { include_inactive: true },
    });
    categories.value = unwrap(resp).items;
  };

  const fetchUnitRules = async () => {
    const resp = await client.get("/api/products/unit-rules");
    splittableUnits.value = unwrap(resp).splittable_units || [];
  };

  const fetchProducts = async () => {
    loading.value = true;
    try {
      const resp = await client.get("/api/products", { params: query });
      const data = unwrap(resp);
      items.value = data.items;
      total.value = data.total;
    } finally {
      loading.value = false;
    }
  };

  const resolveImportErrorMessage = (error) => {
    const detail = error?.response?.data?.detail;
    if (detail && typeof detail === "object") {
      if (detail.scanned?.length) {
        const top = detail.scanned[0];
        const normalizeItem = (item) =>
          String(item)
            .replace(/[。．.]+$/g, "")
            .replace(/\s+/g, "");
        const scanned = (top.texts || [])
          .map(normalizeItem)
          .filter(Boolean);
        const expected = importHeaderLabels.map(normalizeItem);
        const ignored = new Set(["说明", "表头不可修改", ""]);
        const missing = expected.filter((label) => !scanned.includes(label));
        const extra = scanned.filter(
          (label) => !expected.includes(label) && !ignored.has(label),
        );
        importHeaderIssue.value = {
          row: top.row,
          missing,
          extra,
        };
        return "";
      }
      return detail.message || "导入失败，请检查模板表头";
    }
    return error?.response?.data?.message || error?.message || "导入失败";
  };

  const clearEditErrors = () => {
    Object.keys(editErrors).forEach((key) => {
      editErrors[key] = "";
    });
  };

  const validateEditName = () => {
    const value = String(editForm.name || "").trim();
    if (!value) {
      editErrors.name = "请输入产品名称";
      return false;
    }
    editErrors.name = "";
    return true;
  };

  const validateEditNameUnique = async () => {
    if (!validateEditName()) {
      return false;
    }
    const trimmedName = String(editForm.name || "").trim();
    nameChecking.value = true;
    try {
      const hasConflict = await checkProductNameConflict(
        trimmedName,
        editMode.value === "edit" ? editForm.id : "",
      );
      if (hasConflict) {
        editErrors.name = "产品名称已存在，请修改后再保存";
        return false;
      }
      editErrors.name = "";
      return true;
    } finally {
      nameChecking.value = false;
    }
  };

  const validateEditCategory = () => {
    if (!editForm.category_id) {
      editErrors.category_id = "请选择品类";
      return false;
    }
    editErrors.category_id = "";
    return true;
  };

  const validateEditBasePrice = () => {
    const raw = editForm.base_price;
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      editErrors.base_price = "请输入单价";
      return false;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0.01) {
      editErrors.base_price = "单价必须大于等于 0.01";
      return false;
    }
    editErrors.base_price = "";
    return true;
  };

  const validateEditVolatility = () => {
    const raw = editForm.volatility_percent;
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      editErrors.volatility_percent = "请输入单价波动";
      return false;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      editErrors.volatility_percent = "单价波动需在 0-100 之间";
      return false;
    }
    editErrors.volatility_percent = "";
    return true;
  };

  const validateEditUnit = () => {
    const raw = String(editForm.unit || "").trim();
    if (!raw) {
      editErrors.unit = "请输入单位";
      return false;
    }
    const normalized = normalizeUnitInput(raw);
    if (!normalized.ok) {
      editErrors.unit = normalized.error;
      return false;
    }
    editForm.unit = normalized.value;
    editErrors.unit = "";
    return true;
  };

  const validateEditItemRange = () => {
    const min = editForm.item_quantity_min;
    const max = editForm.item_quantity_max;
    if (min === null && max === null) {
      editErrors.item_quantity_range = "请填写采购数量范围";
      return null;
    }
    if (min === null || max === null) {
      editErrors.item_quantity_range = "请同时填写最小值和最大值";
      return null;
    }
    if (Number(min) > Number(max)) {
      editErrors.item_quantity_range = "最小值不能大于最大值";
      return null;
    }
    if (!validateEditUnit()) {
      editErrors.item_quantity_range = "请先修正单位";
      return null;
    }
    const range = { min: Number(min), max: Number(max) };
    if (!validateRangeByUnitStep(range, editForm.unit, "采购数量范围", true)) {
      editErrors.item_quantity_range = `范围值需符合单位步进 ${quantityStepByUnit(
        editForm.unit,
      )}`;
      return null;
    }
    editErrors.item_quantity_range = "";
    return range;
  };

  const editQuantityStep = computed(() => quantityStepByUnit(editForm.unit));
  const batchQuantityStep = computed(() => quantityStepByUnit(batchForm.unit));
  const importHasErrors = computed(
    () => (importResult.value?.errors || []).length > 0,
  );
  const importHasWarnings = computed(
    () => (importResult.value?.warnings || []).length > 0,
  );

  const escapeRegex = (value) =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const checkProductNameConflict = async (name, currentId = "") => {
    const keyword = `^${escapeRegex(name)}$`;
    const resp = await client.get("/api/products", {
      params: {
        keyword,
        page: 1,
        page_size: 100,
      },
    });
    const data = unwrap(resp);
    const exact = (data.items || []).filter(
      (item) => String(item.name || "").trim() === name,
    );
    return exact.some((item) => item.id !== currentId);
  };

  let keywordTimer = null;
  const onSearch = () => {
    query.page = 1;
    fetchProducts();
  };

  const toTableSortProp = (sortBy) => {
    if (sortBy === "status") return "status";
    return sortBy || "";
  };
  const toTableSortOrder = (sortOrder) => {
    if (sortOrder === "asc") return "ascending";
    if (sortOrder === "desc") return "descending";
    return null;
  };

  const applyTableSortState = async () => {
    await nextTick();
    const table = productsTableRef.value?.getTable?.();
    if (!table) return;
    const prop = toTableSortProp(query.sort_by);
    const order = toTableSortOrder(query.sort_order);
    if (!prop || !order) {
      table.clearSort();
      return;
    }
    isApplyingSort.value = true;
    table.sort(prop, order);
    await nextTick();
    isApplyingSort.value = false;
  };

  const onKeywordInput = () => {
    if (keywordTimer) {
      clearTimeout(keywordTimer);
    }
    keywordTimer = setTimeout(() => {
      onSearch();
    }, 400);
  };

  const openCreate = () => {
    editMode.value = "create";
    Object.assign(editForm, {
      id: "",
      name: "",
      category_id: "",
      category_name: "",
      unit: "",
      base_price: "",
      volatility_percent: null,
      item_quantity_min: null,
      item_quantity_max: null,
    });
    clearEditErrors();
    editOpen.value = true;
    editSnapshot.value = buildEditSnapshot();
  };

  const onNameBlur = async () => {
    await validateEditNameUnique();
  };

  const openEdit = (row) => {
    editMode.value = "edit";
    editForm.id = row.id;
    editForm.name = row.name;
    editForm.category_id = row.category_id;
    editForm.category_name = row.category_name || "";
    if (!editForm.category_id && row.category_name) {
      const match = categories.value.find(
        (item) => item.name === row.category_name,
      );
      editForm.category_id = match?.id || "";
    }
    editForm.unit = row.unit;
    editForm.base_price = row.base_price;
    editForm.volatility_percent =
      row.volatility === undefined || row.volatility === null
        ? null
        : Number(row.volatility) * 100;
    editForm.item_quantity_min = row.item_quantity_range?.min ?? null;
    editForm.item_quantity_max = row.item_quantity_range?.max ?? null;
    clearEditErrors();
    editOpen.value = true;
    editSnapshot.value = buildEditSnapshot();
  };

  const onSave = async () => {
    const validName = await validateEditNameUnique();
    const validCategory = validateEditCategory();
    const validPrice = validateEditBasePrice();
    const validVolatility = validateEditVolatility();
    const validUnit = validateEditUnit();
    const itemQuantityRange = validateEditItemRange();
    if (
      !validName ||
      !validCategory ||
      !validPrice ||
      !validVolatility ||
      !validUnit ||
      !itemQuantityRange
    ) {
      ElMessage.warning("请先修正表单校验错误");
      return;
    }
    const trimmedName = String(editForm.name).trim();
    editForm.name = trimmedName;

    const payload = {
      name: trimmedName,
      category_id: editForm.category_id,
      unit: editForm.unit,
      base_price: String(editForm.base_price),
      volatility:
        editForm.volatility_percent === null
          ? null
          : (Number(editForm.volatility_percent || 0) / 100).toString(),
      item_quantity_range: itemQuantityRange,
    };
    if (editMode.value === "create") {
      await client.post("/api/products", payload);
      ElMessage.success("已新增产品");
    } else {
      await client.put(`/api/products/${editForm.id}`, payload);
      ElMessage.success("已更新产品");
    }
    editOpen.value = false;
    editSnapshot.value = null;
    fetchProducts();
  };

  const onUnitBlur = () => {
    validateEditUnit();
    validateEditItemRange();
  };

  const openBatch = () => {
    batchForm.category_id = query.category_id || "";
    batchForm.update_volatility = false;
    batchForm.update_item_quantity = false;
    batchForm.update_unit = false;
    batchForm.volatility_percent = null;
    batchForm.unit = "";
    batchForm.item_quantity_min = null;
    batchForm.item_quantity_max = null;
    batchOpen.value = true;
    batchSnapshot.value = buildBatchSnapshot();
  };

  const onBatchUpdate = async () => {
    if (!batchForm.category_id) {
      ElMessage.warning("请选择品类");
      return;
    }
    if (
      !batchForm.update_volatility &&
      !batchForm.update_item_quantity &&
      !batchForm.update_unit
    ) {
      ElMessage.warning("请选择需要更新的字段");
      return;
    }
    let itemQuantityRange = null;
    if (batchForm.update_item_quantity) {
      itemQuantityRange = buildRange(
        batchForm.item_quantity_min,
        batchForm.item_quantity_max,
        "采购数量范围",
      );
      if (itemQuantityRange === undefined) {
        return;
      }
    }
    const payload = {
      category_id: batchForm.category_id,
    };
    if (batchForm.update_volatility) {
      if (batchForm.volatility_percent === null) {
        ElMessage.warning("请填写单价波动");
        return;
      }
      payload.volatility = (
        Number(batchForm.volatility_percent || 0) / 100
      ).toString();
    }
    if (batchForm.update_item_quantity && itemQuantityRange !== null) {
      payload.item_quantity_range = itemQuantityRange;
    }
    if (batchForm.update_unit) {
      const normalizedUnit = normalizeUnitInput(batchForm.unit);
      if (!normalizedUnit.ok) {
        ElMessage.warning(normalizedUnit.error);
        return;
      }
      batchForm.unit = normalizedUnit.value;
      if (!batchForm.unit) {
        ElMessage.warning("请填写单位");
        return;
      }
      payload.unit = batchForm.unit;
    }
    if (
      batchForm.update_item_quantity &&
      itemQuantityRange !== null &&
      batchForm.update_unit
    ) {
      if (
        !validateRangeByUnitStep(
          itemQuantityRange,
          batchForm.unit,
          "采购数量范围",
        )
      ) {
        return;
      }
    }
    await client.post("/api/products/batch-update", payload);
    ElMessage.success("批量设置已应用");
    batchOpen.value = false;
    batchSnapshot.value = null;
    fetchProducts();
  };

  const onDelete = async (row) => {
    await client.delete(`/api/products/${row.id}`);
    ElMessage.success("已移除");
    fetchProducts();
  };

  const onRestore = async (row) => {
    await client.put(`/api/products/${row.id}`, { is_deleted: false });
    ElMessage.success("已启用");
    fetchProducts();
  };

  const extractFilename = (response, fallback) => {
    const disposition = response?.headers?.["content-disposition"] || "";
    const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
    const asciiMatch = disposition.match(/filename=\"([^\"]+)\"/i);
    if (asciiMatch?.[1]) {
      return asciiMatch[1];
    }
    return fallback;
  };

  const onExportProducts = async () => {
    if (exportLoading.value) return;
    exportLoading.value = true;
    try {
      const resp = await client.get("/api/products/export", {
        responseType: "blob",
      });
      const filename = extractFilename(resp, "产品库.xlsx");
      downloadBlob(resp.data, filename);
    } finally {
      exportLoading.value = false;
    }
  };

  const onExportTemplate = async () => {
    if (templateLoading.value) return;
    templateLoading.value = true;
    try {
      const resp = await client.get("/api/products/export", {
        responseType: "blob",
      });
      const filename = extractFilename(resp, "产品库模板.xlsx");
      downloadBlob(resp.data, filename);
    } finally {
      templateLoading.value = false;
    }
  };

  const openImport = () => {
    importOpen.value = true;
    importFile.value = null;
    importResult.value = null;
    confirmDeactivate.value = false;
  };

  watch(
    () => editOpen.value,
    (open) => {
      if (!open) {
        editSnapshot.value = null;
      }
    },
  );

  watch(
    () => batchOpen.value,
    (open) => {
      if (!open) {
        batchSnapshot.value = null;
      }
    },
  );

  watch(
    () => importOpen.value,
    (open) => {
      if (!open) {
        importFile.value = null;
        importResult.value = null;
        confirmDeactivate.value = false;
      }
    },
  );

  const onImportFileChange = async (file) => {
    importFile.value = file.raw || file;
    if (!importFile.value) {
      return;
    }
    importResult.value = null;
    importHeaderIssue.value = null;
    confirmDeactivate.value = false;
    importLoading.value = true;
    try {
      const formData = new FormData();
      formData.append("file", importFile.value);
      const resp = await client.post("/api/products/import", formData, {
        params: { dry_run: true },
        headers: { "Content-Type": "multipart/form-data" },
        suppressError: true,
      });
      importResult.value = unwrap(resp);
      importHeaderIssue.value = null;
      confirmDeactivate.value = false;
    } catch (error) {
      importResult.value = null;
      const message = resolveImportErrorMessage(error);
      if (message) {
        ElMessage.error(message);
      }
    } finally {
      importLoading.value = false;
    }
  };

  const onSortChange = (payload) => {
    if (isApplyingSort.value) {
      return;
    }
    if (!payload?.prop || !payload?.order) {
      query.sort_by = "";
      query.sort_order = "";
      onSearch();
      return;
    }
    if (payload.prop === "status") {
      query.sort_by = "status";
    } else {
      query.sort_by = payload.prop;
    }
    query.sort_order = payload.order === "ascending" ? "asc" : "desc";
    onSearch();
  };

  const onApplyImport = async () => {
    if (!importFile.value) {
      ElMessage.warning("请先选择文件");
      return;
    }
    if (importHasErrors.value) {
      ElMessage.warning("请先修复错误后再导入");
      return;
    }
    const candidates = importResult.value?.deactivate_candidates || [];
    const count = candidates.length;
    if (count > 0 && !confirmDeactivate.value) {
      confirmDeactivate.value = true;
      return;
    }
    importLoading.value = true;
    try {
      const formData = new FormData();
      formData.append("file", importFile.value);
      const resp = await client.post("/api/products/import", formData, {
        params: { dry_run: false },
        headers: { "Content-Type": "multipart/form-data" },
        suppressError: true,
      });
      const data = unwrap(resp);
      importResult.value = data;
      importHeaderIssue.value = null;
      if ((data.errors || []).length) {
        ElMessage.warning("导入存在错误，请检查");
        return;
      }
      ElMessage.success(
        `导入完成，新增 ${data.created} 条，更新 ${data.updated} 条` +
          (data.deactivated ? `，作废 ${data.deactivated} 条` : ""),
      );
      importOpen.value = false;
      confirmDeactivate.value = false;
      fetchProducts();
    } catch (error) {
      const message = resolveImportErrorMessage(error);
      if (message) {
        ElMessage.error(message);
      }
    } finally {
      importLoading.value = false;
    }
  };

  const onDownloadImportReport = () => {
    if (!importResult.value) {
      return;
    }
    const rows = [];
    const headers = ["类型", "行号", "字段", "原因", "原值"];
    rows.push(headers);
    (importResult.value.errors || []).forEach((item) => {
      rows.push(["错误", item.row, item.field, item.message, item.value ?? ""]);
    });
    (importResult.value.warnings || []).forEach((item) => {
      rows.push(["警告", item.row, item.field, item.message, item.value ?? ""]);
    });
    (importResult.value.deactivate_candidates || []).forEach((name) => {
      rows.push(["作废", "", "产品名称", "Excel 中不存在，导入后作废", name]);
    });
    const content =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (cell) =>
                `"${String(cell ?? "")
                  .replace(/"/g, '""')
                  .replace(/\r?\n/g, " ")}"`,
            )
            .join(","),
        )
        .join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "产品库导入报告.csv");
  };

  const editDirty = computed(() => {
    if (!editOpen.value || !editSnapshot.value) return false;
    return JSON.stringify(buildEditSnapshot()) !== JSON.stringify(editSnapshot.value);
  });

  const batchDirty = computed(() => {
    if (!batchOpen.value || !batchSnapshot.value) return false;
    return JSON.stringify(buildBatchSnapshot()) !== JSON.stringify(batchSnapshot.value);
  });

  const importDirty = computed(() => {
    if (!importOpen.value) return false;
    return Boolean(importFile.value || importResult.value || confirmDeactivate.value);
  });

  const isDirty = computed(() => editDirty.value || batchDirty.value || importDirty.value);

  onMounted(async () => {
    fetchCategories();
    fetchUnitRules();
    fetchProducts();
    await applyTableSortState();
    isBootstrapping.value = false;
  });

  watch(
    () => query.category_id,
    () => {
      if (isBootstrapping.value) return;
      onSearch();
    },
  );

  watch(
    () => query.is_active,
    () => {
      if (isBootstrapping.value) return;
      onSearch();
    },
  );

  return {
    loading,
    editOpen,
    editMode,
    productsTableRef,
    items,
    categories,
    total,
    importOpen,
    importLoading,
    exportLoading,
    templateLoading,
    importFile,
    importResult,
    importHeaderIssue,
    confirmDeactivate,
    splittableUnits,
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
  };
};
