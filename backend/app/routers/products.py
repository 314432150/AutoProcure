"""产品管理接口。

提供产品查询、创建、更新、批量更新与作废能力。
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from decimal import Decimal
import io
from urllib.parse import quote
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse

from app.core.response import ok
from app.db.mongo import get_database
from app.db.serializers import encode_for_mongo
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.product_import_export import (
    build_products_workbook,
    import_products_from_xlsx,
    normalize_base_price,
)
from app.services.unit_rules import normalize_unit_input
from app.services.unit_rules import list_splittable_units

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/unit-rules")
async def get_unit_rules() -> dict:
    """获取单位规则（用于前端提示）。"""
    return ok(
        {
            "splittable_units": list_splittable_units(),
            "splittable_step": "0.1",
            "default_step": "1",
        }
    )

def _serialize_product(doc: dict[str, Any]) -> dict[str, Any]:
    """将数据库产品文档转换为接口输出结构。"""
    doc["id"] = str(doc.pop("_id"))
    if "category_name" not in doc:
        doc["category_name"] = doc.get("category")
    doc.pop("volatility_precision", None)
    doc.pop("unit_price_precision", None)
    if doc.get("unit"):
        try:
            doc["unit"] = normalize_unit_input(str(doc["unit"]))
        except ValueError:
            doc["unit"] = str(doc["unit"]).strip()
    return doc


async def _resolve_category(db: Any, category_id: str) -> dict[str, Any]:
    """校验品类编号并返回有效品类。"""
    if not ObjectId.is_valid(category_id):
        raise HTTPException(status_code=400, detail="无效的品类编号")
    category = await db["categories"].find_one({"_id": ObjectId(category_id)})
    if not category:
        raise HTTPException(status_code=404, detail="未找到品类")
    if not category.get("is_active", True):
        raise HTTPException(status_code=409, detail="品类已停用")
    return category


def _validate_product_payload(payload: dict[str, Any], require_all: bool = True) -> None:
    """校验产品字段，确保必填项与取值范围正确。"""
    unit = payload.get("unit")
    if require_all:
        if unit is None or not str(unit).strip():
            raise HTTPException(status_code=400, detail="单位不能为空")
    if unit is not None and not str(unit).strip():
        raise HTTPException(status_code=400, detail="单位不能为空")
    if unit is not None:
        try:
            payload["unit"] = normalize_unit_input(str(unit))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    base_price = payload.get("base_price")
    if require_all:
        if base_price is None or str(base_price).strip() == "":
            raise HTTPException(status_code=400, detail="单价不能为空")
    if base_price is not None:
        value = Decimal(str(base_price))
        if value < Decimal("0.01"):
            raise HTTPException(status_code=400, detail="单价必须大于等于 0.01")
        payload["base_price"] = normalize_base_price(value)

    item_quantity_range = payload.get("item_quantity_range")
    if require_all:
        if not item_quantity_range:
            raise HTTPException(status_code=400, detail="采购数量范围不能为空")
        if item_quantity_range.get("min") is None or item_quantity_range.get("max") is None:
            raise HTTPException(status_code=400, detail="采购数量范围必须同时填写最小值与最大值")
    if item_quantity_range is not None:
        min_value = Decimal(str(item_quantity_range["min"]))
        max_value = Decimal(str(item_quantity_range["max"]))
        if min_value > max_value:
            raise HTTPException(status_code=400, detail="采购数量范围最小值不能大于最大值")

    volatility = payload.get("volatility")
    if require_all:
        if volatility is None:
            raise HTTPException(status_code=400, detail="单价波动不能为空")
    if volatility is not None:
        value = Decimal(str(volatility))
        if value < 0 or value > 1:
            raise HTTPException(status_code=400, detail="单价波动必须在 0 到 1 之间")

@router.get("")
async def list_products(
    keyword: str | None = None,
    category_id: str | None = None,
    category: str | None = None,
    is_active: bool | None = Query(default=None),
    sort_by: str | None = None,
    sort_order: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """按条件查询产品列表。"""
    db = get_database()
    query: dict[str, Any] = {}
    if keyword:
        query["name"] = {"$regex": keyword, "$options": "i"}
    selected_category = category_id or category
    if selected_category:
        query["category_id"] = selected_category
    if is_active is True:
        query["is_deleted"] = False
    if is_active is False:
        query["is_deleted"] = True

    sort_field_map = {
        "base_price": "base_price",
        "volatility": "volatility",
        "updated_at": "updated_at",
        "name": "name",
        "category_name": "category_name",
        "status": "is_deleted",
    }
    sort_field = sort_field_map.get(sort_by or "", None)
    order = 1 if (sort_order or "").lower() == "asc" else -1

    skip = max(page - 1, 0) * page_size
    if sort_field:
        sort = [(sort_field, order), ("updated_at", -1)]
    else:
        sort = [("is_deleted", 1), ("category_name", 1), ("name", 1)]

    cursor = (
        db["products"]
        .find(query)
        .skip(skip)
        .limit(page_size)
        .sort(sort)
    )
    items = [_serialize_product(doc) async for doc in cursor]
    total = await db["products"].count_documents(query)
    return ok({"items": items, "total": total})


@router.get("/export")
async def export_products(include_inactive: bool = Query(default=True)) -> StreamingResponse:
    """导出产品库 Excel 模板与数据。"""
    db = get_database()
    query: dict[str, Any] = {}
    if not include_inactive:
        query["is_deleted"] = False

    cursor = db["products"].find(query).sort([("category_name", 1), ("name", 1)])
    products = [_serialize_product(doc) async for doc in cursor]

    wb = build_products_workbook(products)
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    time_tag = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y%m%d_%H%M%S")
    filename = f"产品库_{time_tag}.xlsx"
    ascii_name = f"products_{time_tag}.xlsx"
    encoded_name = quote(filename)
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded_name}"
    headers = {"Content-Disposition": disposition}
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.post("/import")
async def import_products(file: UploadFile = File(...), dry_run: bool = Query(default=False)) -> dict:
    """导入产品库 Excel，按名称更新或新增产品。"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="未找到上传文件")
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx 文件")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="上传文件为空")
    db = get_database()
    result = await import_products_from_xlsx(db, payload, dry_run=dry_run)
    return ok(result)


@router.post("")
async def create_product(payload: ProductCreate) -> dict:
    """创建新产品并写入品类名称快照。"""
    db = get_database()
    now = datetime.utcnow()
    category = await _resolve_category(db, payload.category_id)
    doc = payload.model_dump()
    doc["name"] = str(doc.get("name", "")).strip()
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="产品名称不能为空")
    existing = await db["products"].find_one({"name": doc["name"]})
    if existing:
        raise HTTPException(status_code=409, detail="产品名称已存在")
    _validate_product_payload(doc, require_all=True)
    doc.setdefault("is_deleted", False)
    doc = encode_for_mongo(doc)
    doc["category_name"] = category.get("name", "")
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await db["products"].insert_one(doc)
    return ok({"id": str(result.inserted_id)})


@router.put("/{product_id}")
async def update_product(product_id: str, payload: ProductUpdate) -> dict:
    """更新产品信息，并在必要时同步品类名称。"""
    db = get_database()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="无效的产品编号")

    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "name" in update:
        update["name"] = str(update["name"]).strip()
        if not update["name"]:
            raise HTTPException(status_code=400, detail="产品名称不能为空")
        existing = await db["products"].find_one(
            {"name": update["name"], "_id": {"$ne": ObjectId(product_id)}}
        )
        if existing:
            raise HTTPException(status_code=409, detail="产品名称已存在")
    update = encode_for_mongo(update)
    if not update:
        return ok({"status": "无变更", "id": product_id})

    merged = await db["products"].find_one({"_id": ObjectId(product_id)})
    if not merged:
        raise HTTPException(status_code=404, detail="未找到产品")
    merged_payload = {**merged, **update}
    _validate_product_payload(merged_payload, require_all=True)
    if "base_price" in update:
        update["base_price"] = merged_payload.get("base_price")

    if "category_id" in update:
        category = await _resolve_category(db, update["category_id"])
        update["category_name"] = category.get("name", "")

    update = encode_for_mongo(update)
    update["updated_at"] = datetime.utcnow()
    await db["products"].update_one(
        {"_id": ObjectId(product_id)},
        {
            "$set": update,
            "$unset": {"volatility_precision": "", "unit_price_precision": ""},
        },
    )
    return ok({"status": "成功", "id": product_id})


@router.post("/batch-update")
async def batch_update_products(payload: dict[str, Any]) -> dict:
    """按品类批量更新产品规则字段。"""
    db = get_database()
    category_id = payload.get("category_id")
    if not category_id or not ObjectId.is_valid(category_id):
        raise HTTPException(status_code=400, detail="无效的品类编号")
    _ = await _resolve_category(db, category_id)

    update_payload: dict[str, Any] = {}
    if payload.get("volatility") is not None:
        update_payload["volatility"] = payload.get("volatility")
    if payload.get("item_quantity_range") is not None:
        update_payload["item_quantity_range"] = payload.get("item_quantity_range")
    if payload.get("unit") is not None:
        update_payload["unit"] = payload.get("unit")

    if not update_payload:
        raise HTTPException(status_code=400, detail="未选择需要更新的字段")

    _validate_product_payload(update_payload, require_all=False)
    if "unit" in update_payload and not str(update_payload["unit"]).strip():
        raise HTTPException(status_code=400, detail="单位不能为空")

    result = await db["products"].update_many(
        {"category_id": category_id},
        {"$set": {**encode_for_mongo(update_payload), "updated_at": datetime.utcnow()}},
    )
    updated = int(result.modified_count)

    return ok({"status": "成功", "updated": updated})


@router.delete("/{product_id}")
async def delete_product(product_id: str) -> dict:
    """逻辑删除产品。"""
    db = get_database()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="无效的产品编号")

    result = await db["products"].update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="未找到产品")
    return ok({"status": "成功", "id": product_id})
