"""单位标准化与数量步进规则。

规则：
- 后端落库优先保存中文标准单位。
- 可分割单位（如 克/斤/千克/毫升 等）采购数量步进为 0.1。
- 其他单位默认步进为 1。
- 英文单位仅接受内置映射；未识别英文报错。
"""

from __future__ import annotations

from decimal import Decimal
import re

_SPLITTABLE_UNITS = {"克", "千克", "斤", "两", "毫升", "升"}

_UNIT_ALIAS_MAP = {
    # 中文别名
    "公斤": "千克",
    "公升": "升",
    "ml": "毫升",
    "毫升": "毫升",
    "l": "升",
    "kg": "千克",
    "g": "克",
    "jin": "斤",
    "liang": "两",
    # 英文全称
    "gram": "克",
    "grams": "克",
    "kilogram": "千克",
    "kilograms": "千克",
    "milliliter": "毫升",
    "milliliters": "毫升",
    "millilitre": "毫升",
    "millilitres": "毫升",
    "liter": "升",
    "liters": "升",
    "litre": "升",
    "litres": "升",
    # 中文标准值
    "克": "克",
    "千克": "千克",
    "斤": "斤",
    "两": "两",
    "毫升": "毫升",
    "升": "升",
}


def _normalize_key(text: str) -> str:
    """归一化映射键：去空白并转小写。"""
    return re.sub(r"\s+", "", text).lower()


def _contains_english(text: str) -> bool:
    """判断输入是否包含英文字母。"""
    return bool(re.search(r"[a-zA-Z]", text or ""))


def normalize_unit_input(unit: str, *, allow_unknown_chinese: bool = True) -> str:
    """标准化单位。

    - 已识别别名会映射到中文标准单位。
    - 未识别英文抛出 ValueError。
    - 未识别中文在宽松模式下保留原值（去首尾空白）。
    """
    raw = str(unit or "").strip()
    if not raw:
        raise ValueError("单位不能为空")

    mapped = _UNIT_ALIAS_MAP.get(_normalize_key(raw))
    if mapped:
        return mapped

    if _contains_english(raw):
        raise ValueError("单位英文未识别，请使用中文单位")

    if allow_unknown_chinese:
        return raw

    raise ValueError("单位未识别")


def is_splittable_unit(unit: str) -> bool:
    """判断单位是否为可分割单位。"""
    try:
        normalized = normalize_unit_input(unit)
    except ValueError:
        return False
    return normalized in _SPLITTABLE_UNITS


def quantity_step_for_unit(unit: str) -> Decimal:
    """按单位返回采购数量步进：可分割 0.1，否则 1。"""
    return Decimal("0.1") if is_splittable_unit(unit) else Decimal("1")


def quantity_precision_for_unit(unit: str) -> int:
    """按单位返回数量保留小数位：可分割 1 位，否则 0 位。"""
    return 1 if is_splittable_unit(unit) else 0


def list_splittable_units() -> list[str]:
    """返回可分割单位清单（中文标准名）。"""
    return sorted(_SPLITTABLE_UNITS)
