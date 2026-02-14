export const formatRange = (range) => {
  if (!range) {
    return "-";
  }
  const min = range.min ?? range?.min;
  const max = range.max ?? range?.max;
  if (min === null || min === undefined || max === null || max === undefined) {
    return "-";
  }
  const minValue = Number(min);
  const maxValue = Number(max);
  if (!Number.isNaN(minValue) && !Number.isNaN(maxValue) && minValue === maxValue) {
    return `${minValue}`;
  }
  return `${min} - ${max}`;
};

export const formatDateTime = (value, placeholder = "-") => {
  if (!value) {
    return placeholder;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

/** 银行家舍入（Round half to even） */
export const bankersRound = (value, precision = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  const factor = 10 ** precision;
  const scaled = num * factor;
  const sign = scaled < 0 ? -1 : 1;
  const abs = Math.abs(scaled);
  const floor = Math.floor(abs);
  const fraction = abs - floor;
  const EPSILON = 1e-10;

  let roundedInt = floor;
  if (fraction > 0.5 + EPSILON) {
    roundedInt = floor + 1;
  } else if (fraction < 0.5 - EPSILON) {
    roundedInt = floor;
  } else {
    roundedInt = floor % 2 === 0 ? floor : floor + 1;
  }

  return (sign * roundedInt) / factor;
};

/** 金额格式化：银行家舍入后固定保留两位小数 */
export const formatMoney = (value, precision = 2) =>
  bankersRound(value, precision).toFixed(precision);
