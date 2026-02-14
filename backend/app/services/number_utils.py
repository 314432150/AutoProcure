"""数值工具函数。

提供 Decimal 的随机与四舍五入处理，用于价格与数量计算。
"""
from decimal import Decimal, ROUND_HALF_UP
import random


def round_decimal(value: Decimal, precision: int) -> Decimal:
    """按指定精度对 Decimal 四舍五入。"""
    quant = Decimal("1") if precision <= 0 else Decimal("1").scaleb(-precision)
    return value.quantize(quant, rounding=ROUND_HALF_UP)


def random_decimal(min_value: Decimal, max_value: Decimal, precision: int) -> Decimal:
    """在区间内生成随机 Decimal 并按精度处理。"""
    if max_value < min_value:
        # 保证区间顺序正确
        min_value, max_value = max_value, min_value
    raw = Decimal(str(random.uniform(float(min_value), float(max_value))))
    return round_decimal(raw, precision)
