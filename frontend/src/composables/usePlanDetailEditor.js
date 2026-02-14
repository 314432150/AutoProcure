import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import client, { unwrap } from "../api/client";
import { bankersRound } from "../utils/formatters";
import { quantityPrecisionByUnit, quantityStepByUnit } from "../utils/unitRules";

const MONEY_PRECISION = 2;

/** 采购计划详情编辑器业务逻辑 */
export const usePlanDetailEditor = (planDateRef) => {
  // =========================
  // 页面状态
  // =========================
  const plan = ref(null);
  const products = ref([]);
  const productsLoading = ref(false);
  const categories = ref([]);
  const editItems = ref([]);
  const savingPlan = ref(false);
  const hasUnsavedChanges = ref(false);
  const lastSavedAt = ref(null);
  const splittableUnits = ref([]);
  const sortState = reactive({
    prop: "",
    order: "",
  });

  // =========================
  // 计算属性
  // =========================
  /** 数量步进规则提示文案 */
  const quantityRuleTooltip = computed(() => {
    const units = splittableUnits.value.length
      ? splittableUnits.value.join("、")
      : "克、千克、公斤、斤、两、毫升、升";
    return `数量按单位自动步进：${units} 用 0.1；其他单位用 1。`;
  });

  /** 汇总明细总金额（银行家舍入） */
  const totalAmount = computed(() =>
    bankersRound(
      editItems.value.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      MONEY_PRECISION,
    ),
  );

  /** 按采购周期汇总金额（每日/定期） */
  const purchaseModeByCategory = (categoryId) => {
    if (!categoryId) return "daily";
    const category = categories.value.find((item) => item.id === categoryId);
    return category?.purchase_mode || "daily";
  };

  const dailyAmount = computed(() =>
    bankersRound(
      editItems.value.reduce((sum, item) => {
        const mode = purchaseModeByCategory(item.category_id);
        if (mode === "periodic") return sum;
        return sum + Number(item.amount || 0);
      }, 0),
      MONEY_PRECISION,
    ),
  );

  const periodicAmount = computed(() =>
    bankersRound(
      editItems.value.reduce((sum, item) => {
        const mode = purchaseModeByCategory(item.category_id);
        if (mode !== "periodic") return sum;
        return sum + Number(item.amount || 0);
      }, 0),
      MONEY_PRECISION,
    ),
  );

  // =========================
  // 基础工具
  // =========================
  /** 创建空明细行 */
  const createEmptyRow = () => ({
    product_id: "",
    category_id: null,
    category_name: null,
    name: "",
    unit: "",
    price: 0,
    quantity: 0,
    amount: 0,
  });

  /** 接口明细 -> 页面编辑行 */
  const mapApiItemToRow = (item) => ({
    product_id:
      item.product_id === null || item.product_id === undefined
        ? ""
        : String(item.product_id),
    category_id: item.category_id ?? null,
    category_name: item.category_name ?? null,
    name: item.name || "",
    unit: item.unit || "",
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 0),
    amount: Number(item.amount || 0),
  });

  /** 计算金额（单价 * 数量） */
  const buildAmount = (price, quantity) =>
    bankersRound(Number(price) * Number(quantity), MONEY_PRECISION);

  /** 解析时间戳 */
  const parseTimestamp = (value) => {
    const ts = Date.parse(String(value || ""));
    return Number.isFinite(ts) ? ts : null;
  };

  /** 按单位步进把数量量化到合法值 */
  const quantizeQuantityByUnit = (value, unit) => {
    const num = Number(value);
    const stepValue = quantityStepByUnit(unit);
    if (!Number.isFinite(num)) {
      return 0;
    }
    if (!Number.isFinite(stepValue) || stepValue <= 0) {
      return bankersRound(num, 0);
    }
    const steps = Math.round(num / stepValue);
    return bankersRound(steps * stepValue, quantityPrecisionByUnit(unit));
  };

  /** 数量变化后同步刷新金额 */
  const updateAmountByQuantity = (row, { markDirty = true } = {}) => {
    const qty = quantizeQuantityByUnit(row.quantity, row.unit);
    row.quantity = qty;
    row.amount = buildAmount(row.price, qty);
    if (markDirty) {
      hasUnsavedChanges.value = true;
    }
  };

  /** 金额低于1元时，自动抬升数量到最小合法金额 */
  const adjustRowToMinAmount = (row) => {
    const price = Number(row.price);
    const amount = Number(row.amount);
    if (!(price > 0) || amount >= 1) {
      return false;
    }
    const step = quantityStepByUnit(row.unit);
    const needed = Math.ceil((1 / price) / step) * step;
    row.quantity = quantizeQuantityByUnit(needed, row.unit);
    row.amount = buildAmount(row.price, row.quantity);
    return true;
  };

  /** 重置行（重复选择产品时使用） */
  const resetRow = (row) => {
    row.product_id = "";
    row.name = "";
    row.unit = "";
    row.price = 0;
    row.quantity = 0;
    row.amount = 0;
    row.category_id = null;
    row.category_name = null;
  };

  /** 根据产品主数据填充当前行，并处理单位变化导致的步进变更 */
  const applyProductToRow = (row, product) => {
    if (!product) {
      return;
    }
    const prevUnit = row.unit || "";
    row.product_id = product.id;
    row.name = product.name;
    row.unit = product.unit || "";
    row.price = Number(product.base_price || 0);
    row.category_id = product.category_id || null;
    row.category_name = product.category_name || product.category || null;

    if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) {
      row.quantity = quantityStepByUnit(row.unit);
    }
    if (prevUnit !== row.unit) {
      row.quantity = quantizeQuantityByUnit(row.quantity, row.unit);
    }
    updateAmountByQuantity(row);
  };

  /** 构建保存请求体 */
  const buildSavePayload = () => ({
    items: editItems.value.map((row) => ({
      product_id: row.product_id,
      category_id: row.category_id,
      category_name: row.category_name,
      name: row.name,
      unit: row.unit,
      price: String(bankersRound(row.price, MONEY_PRECISION)),
      quantity: String(bankersRound(row.quantity, quantityPrecisionByUnit(row.unit))),
      amount: String(bankersRound(row.amount, MONEY_PRECISION)),
    })),
    total_amount: String(totalAmount.value),
  });

  // =========================
  // 数据加载
  // =========================
  /** 查询可分割单位规则 */
  const fetchUnitRules = async () => {
    const resp = await client.get("/api/products/unit-rules");
    splittableUnits.value = unwrap(resp).splittable_units || [];
  };

  /** 查询品类列表（缓存） */
  const fetchCategories = async () => {
    if (categories.value.length) {
      return;
    }
    const resp = await client.get("/api/categories", {
      params: { include_inactive: true },
    });
    categories.value = unwrap(resp).items;
  };

  /** 分页拉取全部产品（缓存） */
  const fetchAllProducts = async () => {
    if (products.value.length || productsLoading.value) {
      return;
    }
    productsLoading.value = true;
    try {
      const collected = [];
      let page = 1;
      const pageSize = 200;
      while (true) {
        const resp = await client.get("/api/products", {
          params: { page, page_size: pageSize, is_active: true },
        });
        const data = unwrap(resp);
        collected.push(...(data.items || []));
        if (
          collected.length >= (data.total || 0) ||
          (data.items || []).length < pageSize
        ) {
          break;
        }
        page += 1;
      }
      products.value = collected.map((item) => ({
        ...item,
        id: item.id === null || item.id === undefined ? item.id : String(item.id),
      }));
    } finally {
      productsLoading.value = false;
    }
  };

  // =========================
  // 排序逻辑
  // =========================
  /** 文本比较器（中文排序） */
  const compareText = (left, right) =>
    String(left ?? "").localeCompare(String(right ?? ""), "zh-CN");

  /** 数值比较器 */
  const compareNumber = (left, right) => Number(left ?? 0) - Number(right ?? 0);

  /** 采购周期排序权重：每日 < 定期 < 其他 */
  const purchaseModeRank = (categoryId) => {
    const category = categories.value.find((item) => item.id === categoryId);
    if (!category?.purchase_mode) return 99;
    if (category.purchase_mode === "daily") return 1;
    if (category.purchase_mode === "periodic") return 2;
    return 99;
  };

  /** 按列排序（前端本地排序） */
  const sortPlanItems = ({ prop, order }) => {
    sortState.prop = prop || "";
    sortState.order = order || "";
    if (!prop || !order) {
      return;
    }
    const direction = order === "ascending" ? 1 : -1;
    editItems.value = [...editItems.value].sort((a, b) => {
      if (prop === "price" || prop === "quantity" || prop === "amount") {
        return compareNumber(a[prop], b[prop]) * direction;
      }
      if (prop === "purchase_mode") {
        return (purchaseModeRank(a.category_id) - purchaseModeRank(b.category_id)) * direction;
      }
      if (prop === "category_name") {
        return compareText(a.category_name || "", b.category_name || "") * direction;
      }
      return compareText(a[prop], b[prop]) * direction;
    });
  };

  /** 重载数据后恢复排序状态 */
  const restoreSort = () => {
    if (!sortState.prop || !sortState.order) {
      return;
    }
    sortPlanItems({ prop: sortState.prop, order: sortState.order });
  };

  /** 查询指定日期计划详情 */
  const fetchPlan = async () => {
    const planDate = String(planDateRef.value || "");
    if (!planDate) {
      ElMessage.warning("缺少计划日期");
      return;
    }
    const resp = await client.get(`/api/procurement/plans/${planDate}`);
    const data = unwrap(resp);
    plan.value = data;
    editItems.value = (data.items || []).map(mapApiItemToRow);
    editItems.value.forEach((row) => updateAmountByQuantity(row, { markDirty: false }));
    hasUnsavedChanges.value = false;
    lastSavedAt.value = parseTimestamp(data.updated_at);
    restoreSort();
  };

  // =========================
  // 保存逻辑
  // =========================
  /** 保存前校验：必填、数值合法、最低金额修正 */
  const validateRowsBeforeSave = async () => {
    if (!editItems.value.length) {
      ElMessage.warning("请至少保留一条明细");
      return false;
    }
    const lowAmountRows = [];
    for (const [index, row] of editItems.value.entries()) {
      if (!row.product_id) {
        ElMessage.warning(`第 ${index + 1} 行请选择产品`);
        return false;
      }
      if (!row.name) {
        ElMessage.warning(`第 ${index + 1} 行产品名称不能为空`);
        return false;
      }
      if (!row.unit) {
        ElMessage.warning(`第 ${index + 1} 行单位不能为空`);
        return false;
      }
      const price = Number(row.price);
      if (!Number.isFinite(price) || price < 0) {
        ElMessage.warning(`第 ${index + 1} 行单价无效`);
        return false;
      }
      if (adjustRowToMinAmount(row)) {
        hasUnsavedChanges.value = true;
        lowAmountRows.push(row.name || `第${index + 1}行`);
      }
    }

    if (lowAmountRows.length) {
      try {
        await ElMessageBox.confirm(
          `以下产品金额低于 1 元，已自动调整到不少于 1 元：\n${lowAmountRows.join("、")}`,
          "金额已调整",
          {
            confirmButtonText: "继续保存",
            cancelButtonText: "取消",
            type: "warning",
          },
        );
      } catch {
        return false;
      }
    }
    return true;
  };

  /** 提交保存计划 */
  const onSavePlan = async () => {
    if (!plan.value) {
      return;
    }
    const pass = await validateRowsBeforeSave();
    if (!pass) {
      return;
    }
    savingPlan.value = true;
    try {
      const payload = buildSavePayload();
      await client.put(`/api/procurement/plans/${plan.value.date}`, payload);
      ElMessage.success("计划已保存");
      plan.value.total_amount = totalAmount.value;
      plan.value.items = payload.items;
      hasUnsavedChanges.value = false;
      lastSavedAt.value = Date.now();
    } finally {
      savingPlan.value = false;
    }
  };

  // =========================
  // 编辑动作
  // =========================
  /** 行内切换产品，包含去重拦截 */
  const onProductChange = (row, value) => {
    if (!value) {
      return;
    }
    const duplicate = editItems.value.find(
      (item) => item !== row && item.product_id === value,
    );
    if (duplicate) {
      ElMessage.warning("该产品已在明细中，请勿重复选择");
      resetRow(row);
      hasUnsavedChanges.value = true;
      return;
    }
    const product = products.value.find((item) => item.id === value);
    applyProductToRow(row, product);
  };

  /** 在表头新增一行空数据 */
  const addRow = () => {
    editItems.value.unshift(createEmptyRow());
    hasUnsavedChanges.value = true;
  };

  /** 删除指定索引行 */
  const removeRow = (index) => {
    editItems.value.splice(index, 1);
    hasUnsavedChanges.value = true;
  };

  /** 数量输入失焦后做量化与金额重算 */
  const onQuantityBlur = (row) => {
    updateAmountByQuantity(row);
  };

  /** 页面加载入口：并发拉取计划、产品、品类与单位规则 */
  const load = async () => {
    await Promise.all([fetchPlan(), fetchAllProducts(), fetchCategories(), fetchUnitRules()]);
  };

  return {
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
  };
};
