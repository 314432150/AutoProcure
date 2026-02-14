# AutoProcure 后端测试清单

## 1. 认证与权限
- 登录成功返回 token
- 错误账号/密码返回 401
- 受保护接口未带 token 返回 401
- token 过期/无效返回 401

## 2. 规则与产品基础数据
- 新增产品成功
- 逻辑删除后列表不再返回（is_active=true）
- 品类规则（daily/periodic）校验通过
- periodic 品类缺少 cycle_days/float_days 返回 400
- items_count_range.min > max 返回 400
- 产品 item_quantity_range.min > max 返回 400（采购数量范围）

## 3. 配置校验
- precision < 0 或 > 6 返回 400
- daily_budget_range.min > max 返回 400

## 4. 生成清单
- start_month/end_month 超范围返回 400
- start > end 返回 400
- 规则缺失返回 409 + RULE_MISSING
- 预算未配置返回 409 + BUDGET_RANGE_INVALID
- 产品库为空返回 409 + PRODUCTS_EMPTY
- 当月已有数据，force_overwrite=false 返回冲突列表
- force_overwrite=true 覆盖旧数据

## 5. 工作日接口
- 正常返回 SSE 交易日列表
- workday_provider 不可用时 fallback 生效

## 6. 采购清单查询与更新
- list_plans 返回当月工作日列表
- get_plan 返回完整明细
- update_plan 记录 updated_by

## 7. 历史查询
- 按年/月筛选
- 按产品名/类别筛选
- summary 返回按月汇总

## 8. 导出
- 跨月导出生成 zip
- 空月不生成 Excel
- 单价/金额按 precision
- 数量按产品 quantity_step 的精度
- 当日合计与本月总计存在
