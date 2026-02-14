"""品类管理接口。

提供品类查询、新增、更新、停用/启用与规则校验能力。
"""
from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.response import ok
from app.db.mongo import get_database
from app.db.serializers import encode_for_mongo
from app.schemas.category import CategoryCreate, CategoryDeactivate, CategoryUpdate
from app.services.rule_validation import collect_rule_gaps

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _serialize_category(doc: dict[str, Any]) -> dict[str, Any]:
    """将数据库文档转换为接口输出结构。"""
    doc["id"] = str(doc.pop("_id"))
    return doc


def _require_object_id(category_id: str) -> ObjectId:
    """校验并转换品类编号为 ObjectId。"""
    if not ObjectId.is_valid(category_id):
        raise HTTPException(status_code=400, detail="无效的品类编号")
    return ObjectId(category_id)


def _validate_category_payload(payload: dict[str, Any]) -> None:
    """校验品类规则字段，确保采购模式与数量范围一致。"""
    purchase_mode = payload.get("purchase_mode")
    if purchase_mode is not None and purchase_mode not in {"daily", "periodic"}:
        raise HTTPException(status_code=400, detail="采购模式必须为每日或定期")

    items_count_range = payload.get("items_count_range")
    if items_count_range and items_count_range.get("min") is not None and items_count_range.get("max") is not None:
        if items_count_range["min"] > items_count_range["max"]:
            raise HTTPException(status_code=400, detail="选品数量范围最小值不能大于最大值")
        if items_count_range["min"] < 1:
            raise HTTPException(status_code=400, detail="选品数量范围最小值必须大于等于 1")

    if purchase_mode == "periodic":
        cycle_days = payload.get("cycle_days")
        float_days = payload.get("float_days")
        if cycle_days is None or float_days is None:
            raise HTTPException(status_code=400, detail="定期采购品类必须配置周期天数和浮动天数")
        if int(cycle_days) <= 0:
            raise HTTPException(status_code=400, detail="周期天数必须大于 0")
        if int(float_days) < 0:
            raise HTTPException(status_code=400, detail="浮动天数必须大于等于 0")

    if purchase_mode is not None and not items_count_range:
        raise HTTPException(status_code=400, detail="设置采购模式时必须填写选品数量范围")


async def _get_category(db: Any, category_id: str) -> dict[str, Any]:
    """按品类编号获取品类文档，不存在则报错。"""
    doc = await db["categories"].find_one({"_id": _require_object_id(category_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="未找到品类")
    return doc


@router.get("")
async def list_categories(
    include_inactive: bool = Query(default=False),
    keyword: str | None = None,
    purchase_mode: str | None = None,
    is_active: bool | None = Query(default=None),
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> JSONResponse:
    """按条件查询品类列表，并附带品类下产品数量。"""
    db = get_database()
    query: dict[str, Any] = {} if include_inactive else {"is_active": True}
    if keyword:
        query["name"] = {"$regex": keyword, "$options": "i"}
    if purchase_mode:
        query["purchase_mode"] = purchase_mode
    if is_active is True:
        query["is_active"] = True
    if is_active is False:
        query["is_active"] = False

    counts: dict[str, int] = {}
    pipeline = [
        {"$match": {"is_deleted": False, "category_id": {"$exists": True}}},
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}},
    ]
    async for doc in db["products"].aggregate(pipeline):
        if doc.get("_id"):
            counts[str(doc["_id"])] = int(doc.get("count", 0))

    sort_field_map = {
        "name": "name",
        "purchase_mode": "purchase_mode",
        "updated_at": "updated_at",
        "is_active": "is_active",
    }
    order = 1 if (sort_order or "").lower() == "asc" else -1
    sort_field = sort_field_map.get(sort_by or "", None)
    sort = (
        [(sort_field, order)]
        if sort_field
        else [("is_active", -1), ("purchase_mode", 1), ("name", 1)]
    )

    cursor = db["categories"].find(query).sort(sort)
    items: list[dict[str, Any]] = []
    async for doc in cursor:
        item = _serialize_category(doc)
        item["product_count"] = counts.get(item["id"], 0)
        items.append(item)
    if sort_by == "product_count":
        reverse = order == -1
        items.sort(key=lambda item: item.get("product_count", 0), reverse=reverse)
    return ok({"items": items})


@router.get("/validation")
async def validate_categories() -> JSONResponse:
    """返回品类规则缺口，用于前端提示。"""
    db = get_database()
    return ok(await collect_rule_gaps(db))


@router.post("")
async def create_category(payload: CategoryCreate) -> JSONResponse:
    """新增品类并初始化状态。"""
    db = get_database()
    existing = await db["categories"].find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=409, detail="品类已存在")

    now = datetime.utcnow()
    doc: dict[str, Any] = payload.model_dump()
    doc.setdefault("is_active", True)
    _validate_category_payload(doc)
    doc["created_at"] = now
    doc["updated_at"] = now
    doc = encode_for_mongo(doc)
    result = await db["categories"].insert_one(doc)
    return ok({"id": str(result.inserted_id)})


@router.put("/{category_id}")
async def update_category(category_id: str, payload: CategoryUpdate) -> JSONResponse:
    """更新品类信息，并同步产品中的品类名称。"""
    db = get_database()
    doc = await _get_category(db, category_id)

    update: dict[str, Any] = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        return ok({"status": "无变更", "id": category_id})

    if "name" in update:
        existing = await db["categories"].find_one({"name": update["name"], "_id": {"$ne": _require_object_id(category_id)}})
        if existing:
            raise HTTPException(status_code=409, detail="品类已存在")

    merged = {**doc, **update}
    _validate_category_payload(merged)
    update = encode_for_mongo(update)
    update["updated_at"] = datetime.utcnow()
    await db["categories"].update_one({"_id": _require_object_id(category_id)}, {"$set": update})

    if "name" in update:
        await db["products"].update_many({"category_id": category_id}, {"$set": {"category_name": update["name"]}})

    return ok({"status": "成功", "id": category_id})


@router.post("/{category_id}/deactivate")
async def deactivate_category(
    category_id: str,
    payload: CategoryDeactivate | None = None,
) -> JSONResponse:
    """停用品类，可选择将现有产品转移到其他品类。"""
    db = get_database()
    category = await _get_category(db, category_id)
    if not category.get("is_active", True):
        return ok({"status": "无变更", "id": category_id})

    transfer_to_id = payload.transfer_to_id if payload else None
    if transfer_to_id == category_id:
        raise HTTPException(status_code=400, detail="不能转移到同一品类")

    if transfer_to_id:
        target = await _get_category(db, transfer_to_id)
        if not target.get("is_active", True):
            raise HTTPException(status_code=409, detail="目标品类已停用")

    product_count = await db["products"].count_documents({"category_id": category_id, "is_deleted": False})
    if product_count > 0 and not transfer_to_id:
        raise HTTPException(status_code=409, detail="该品类下仍有产品")

    transferred = 0
    if transfer_to_id:
        target = await _get_category(db, transfer_to_id)
        result = await db["products"].update_many(
            {"category_id": category_id},
            {"$set": {"category_id": transfer_to_id, "category_name": target.get("name", "")}},
        )
        transferred = int(result.modified_count)

    await db["categories"].update_one(
        {"_id": _require_object_id(category_id)},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}},
    )

    return ok({"status": "成功", "id": category_id, "transferred": transferred})


@router.post("/{category_id}/activate")
async def activate_category(category_id: str) -> JSONResponse:
    """启用品类。"""
    db = get_database()
    category = await _get_category(db, category_id)
    if category.get("is_active", True):
        return ok({"status": "无变更", "id": category_id})

    await db["categories"].update_one(
        {"_id": _require_object_id(category_id)},
        {"$set": {"is_active": True, "updated_at": datetime.utcnow()}},
    )

    return ok({"status": "成功", "id": category_id})
