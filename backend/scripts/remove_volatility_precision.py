"""移除产品中的波动精度字段。"""

import asyncio
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.db.mongo import get_database


async def remove_field() -> None:
    """批量清理 volatility_precision / unit_price_precision 字段。"""
    db = get_database()
    result = await db["products"].update_many(
        {},
        {"$unset": {"volatility_precision": "", "unit_price_precision": ""}},
    )
    print(f"已清理产品记录 {result.modified_count} 条")


def main() -> None:
    asyncio.run(remove_field())


if __name__ == "__main__":
    main()
