# 通用采购计划管理系统 — 设计与功能说明

## 1. 项目概览
本系统用于按月区间生成采购计划，结合工作日规则、品类采购模式、产品配置与预算约束生成每日采购明细，并支持人工调整、导出与追溯。系统面向通用采购场景，不包含特定行业或具体品类描述。

## 2. 技术选型
- 前端：Vue 3 + Vite + Element Plus
- 后端：Python (FastAPI)
- 数据库：MongoDB
- 认证：JWT（默认 7 天有效期）
- Excel 导出：openpyxl
- 数值精度：Decimal（后端）与前端格式化处理

## 3. 功能模块

### 3.1 认证与用户
- 账号密码登录
- 登录态保持与登出
- 个人信息更新
- 修改密码

### 3.2 采购计划生成
- 选择年月区间生成计划
- 冲突月份检测，支持覆盖生成
- 生成过程根据预算区间给出预警
- 生成结果按日落库

### 3.3 采购计划列表
- 按年月范围查看每日计划与金额
- 显示预算偏离提示
- 双击进入计划详情
- 支持导出与导出设置入口

### 3.4 计划详情编辑
- 明细行新增、删除
- 选择产品后自动带出单位、单价与默认数量
- 数量按单位步进规则量化
- 金额随数量变化自动计算
- 保存后更新状态与时间戳

### 3.5 产品库管理
- 产品列表查询与筛选
- 新增/编辑/作废/启用
- 批量更新（按品类更新规则字段）
- Excel 导入（支持预检与确认导入）
- Excel 导出

### 3.6 品类规则管理
- 品类新增/编辑
- 配置采购模式（每日/定期）
- 配置选品数量范围
- 定期采购周期与浮动设置
- 品类停用/启用
- 停用时可选择将现有产品转移
- 规则缺口校验提示

### 3.7 工作日查询
- 查询指定年月工作日列表
- 支持外部工作日服务与默认回退策略

### 3.8 导出与模板
- 按年月范围导出 ZIP
- 导出模板可配置（标题与列）
- 导出金额精度可配置（0/1/2 位）

### 3.9 预算设置
- 日预算区间设置
- 生成时用于预算控制与预警

### 3.10 历史查询（API）
- 按年月或关键字查询历史
- 按年汇总月度总额

## 4. 关键业务逻辑

### 4.1 工作日来源
- 支持交易日历库或外部接口获取
- 配置允许时可回退到周一至周五默认工作日

### 4.2 计划生成规则（概述）
- 品类按采购模式分为每日与定期
- 每日品类：按选品数量范围随机选品
- 定期品类：按周期与浮动天数生成目标日期
- 若目标日期非工作日，将顺延至最近工作日

### 4.3 预算控制与预警
- 预算区间为必填配置
- 每个工作日分配目标预算
- 若最低成本超预算或当日金额不在区间，生成预警
- 预警不阻断生成，但会在列表中提示

### 4.4 数量与单位规则
- 单位决定数量步进
- 可分割单位按 0.1 步进，其他单位按 1
- 数量与金额按精度进行量化与四舍五入

### 4.5 明细金额计算
- 单价在波动范围内随机生成
- 金额 = 单价 × 数量
- 导出金额精度仅影响导出显示，不影响系统内计算

## 5. 数据库设计（核心集合）

### 5.1 用户 (users)
- username
- password_hash
- full_name
- last_login
- is_active
- created_at / updated_at

### 5.2 产品 (products)
- name
- category_id
- category_name
- unit
- base_price
- volatility
- item_quantity_range { min, max }
- is_deleted
- created_at / updated_at

### 5.3 品类 (categories)
- name
- purchase_mode (daily / periodic)
- cycle_days
- float_days
- items_count_range { min, max }
- is_active
- created_at / updated_at

### 5.4 采购计划 (procurement_plans)
- date
- year_month
- total_amount
- items[]
  - product_id
  - category_id
  - category_name
  - name
  - unit
  - price
  - quantity
  - amount
- warnings[]
- creator_id
- updated_by
- created_at / updated_at

### 5.5 系统设置 (settings)
- key = "global"
- daily_budget_range { min, max }
- export_precision
- created_at / updated_at

### 5.6 导出模板 (export_templates)
- title
- columns[] { label, field }
- created_at / updated_at

## 6. 前端页面结构
- 登录
- 计划生成（列表）
- 计划详情
- 产品库
- 品类库
- 工作日
- 用户信息

## 7. 接口清单

### 7.1 健康检查
- GET /health

### 7.2 认证与用户
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- PUT /api/auth/profile
- PUT /api/auth/password

### 7.3 产品库
- GET /api/products
- POST /api/products
- PUT /api/products/{id}
- DELETE /api/products/{id}
- POST /api/products/batch-update
- GET /api/products/unit-rules
- GET /api/products/export
- POST /api/products/import (dry_run 可选)

### 7.4 品类管理
- GET /api/categories
- POST /api/categories
- PUT /api/categories/{id}
- POST /api/categories/{id}/deactivate
- POST /api/categories/{id}/activate
- GET /api/categories/validation

### 7.5 工作日
- GET /api/workdays

### 7.6 采购计划
- POST /api/procurement/generate
- GET /api/procurement/plans
- GET /api/procurement/plans/{date}
- PUT /api/procurement/plans/{date}
- DELETE /api/procurement/plans

### 7.7 预算设置
- GET /api/procurement/settings
- PUT /api/procurement/settings

### 7.8 导出
- POST /api/procurement/exports
- GET /api/procurement/exports/settings
- PUT /api/procurement/exports/settings
- GET /api/procurement/exports/templates/single
- PUT /api/procurement/exports/templates/single

### 7.9 历史查询
- GET /api/procurement/history
- GET /api/procurement/summary

## 8. 错误码约定（后端统一返回）
- 2000：成功
- 4000：参数错误
- 4001：鉴权失败
- 4004：资源不存在
- 4090：数据冲突
- 5000：系统错误

## 9. 权限与安全
- 后端预留权限中间件
- 默认允许全部权限（可由配置切换）

---

如需继续拆分为需求/接口/UI 三份文档，可在此基础上拆分。
