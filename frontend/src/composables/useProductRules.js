import { computed } from "vue";
import { ElMessage } from "element-plus";
import {
  isMultipleOfUnitStep,
  normalizeUnitInput,
  quantityStepByUnit,
} from "../utils/unitRules";

const volatilityTooltip =
  "控制单价允许浮动比例，输入百分数 0-100，生成时按 ±该比例波动。";
const unitTooltip = "单位会影响采购数量步进：可分割单位按 0.1，其他单位按 1。";

const formatVolatility = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value || "-";
  }
  const percent = (numeric * 100)
    .toFixed(2)
    .replace(/\.0+$/, "")
    .replace(/\.$/, "");
  return `${percent}%`;
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

const validateRangeByUnitStep = (range, unit, label, silent = false) => {
  if (!range) return true;
  if (
    !isMultipleOfUnitStep(range.min, unit) ||
    !isMultipleOfUnitStep(range.max, unit)
  ) {
    const step = quantityStepByUnit(unit);
    if (!silent) {
      ElMessage.warning(`${label}需符合单位步进 ${step}`);
    }
    return false;
  }
  return true;
};

const useQuantityRuleTooltip = (splittableUnits) =>
  computed(() => {
    const units = splittableUnits.value.length
      ? splittableUnits.value.join("、")
      : "克、千克、斤、两、毫升、升";
    return `数量按单位自动步进：${units} 用 0.1；其他单位用 1。`;
  });

export const useProductRules = (splittableUnits) => {
  const quantityRuleTooltip = useQuantityRuleTooltip(splittableUnits);

  return {
    volatilityTooltip,
    unitTooltip,
    quantityRuleTooltip,
    formatVolatility,
    buildRange,
    validateRangeByUnitStep,
    normalizeUnitInput,
    quantityStepByUnit,
  };
};
