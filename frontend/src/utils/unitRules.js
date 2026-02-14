const SPLITTABLE_UNITS = new Set(["克", "千克", "斤", "两", "毫升", "升"]);

const UNIT_ALIAS_MAP = {
  "公斤": "千克",
  "公升": "升",
  "g": "克",
  "gram": "克",
  "grams": "克",
  "kg": "千克",
  "kilogram": "千克",
  "kilograms": "千克",
  "ml": "毫升",
  "milliliter": "毫升",
  "milliliters": "毫升",
  "millilitre": "毫升",
  "millilitres": "毫升",
  "l": "升",
  "liter": "升",
  "liters": "升",
  "litre": "升",
  "litres": "升",
  "jin": "斤",
  "liang": "两",
  "克": "克",
  "千克": "千克",
  "斤": "斤",
  "两": "两",
  "毫升": "毫升",
  "升": "升",
};

const normalizeKey = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();

const hasEnglish = (value) => /[a-zA-Z]/.test(String(value || ""));

export const normalizeUnitInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { ok: false, error: "单位不能为空", value: "" };
  }
  const mapped = UNIT_ALIAS_MAP[normalizeKey(raw)];
  if (mapped) {
    return { ok: true, value: mapped };
  }
  if (hasEnglish(raw)) {
    return { ok: false, error: "单位英文未识别，请使用中文单位", value: raw };
  }
  return { ok: true, value: raw };
};

export const isSplittableUnit = (value) => {
  const normalized = normalizeUnitInput(value);
  if (!normalized.ok) {
    return false;
  }
  return SPLITTABLE_UNITS.has(normalized.value);
};

export const quantityStepByUnit = (value) => (isSplittableUnit(value) ? 0.1 : 1);

export const quantityPrecisionByUnit = (value) => (isSplittableUnit(value) ? 1 : 0);

export const isMultipleOfUnitStep = (numberValue, unit) => {
  const value = Number(numberValue);
  if (!Number.isFinite(value)) {
    return false;
  }
  const step = quantityStepByUnit(unit);
  const scaled = value / step;
  return Math.abs(scaled - Math.round(scaled)) < 1e-8;
};
