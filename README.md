# 采购计划管理系统（用户指南）

## 1. 系统定位
本系统用于按月区间生成采购计划，支持预算控制、品类规则、产品库管理、计划编辑与导出。适用于通用采购管理场景。

## 2. 登录与导航
1. 使用账号密码登录。
2. 左侧导航进入各模块：计划生成、计划详情、产品库、品类库、工作日、用户信息。

## 3. 核心流程（推荐）
1. 配置品类规则
   - 在“品类库”创建品类，设置采购模式与选品数量范围。
   - 定期采购需填写周期与浮动天数。
2. 维护产品库
   - 在“产品库”新增产品，填写单位、单价、波动与数量范围。
   - 如需批量调整，可使用“批量设置”。
3. 设置预算区间
   - 在“计划生成”页面进入预算设置，配置日预算区间。
4. 生成计划
   - 选择年月区间并点击生成。
   - 若存在冲突月份，会提示是否覆盖。
5. 编辑计划
   - 双击某日计划进入详情。
   - 新增/移除行，选择产品后系统自动填充单位与金额。
   - 修改数量后金额自动更新，保存即可生效。
6. 导出计划
   - 选择年月区间导出 ZIP。
   - 可在导出设置中调整模板与金额精度。

## 4. 功能说明
- 计划生成：按工作日与规则生成每日明细，预算不满足时给出提示。
- 计划详情：支持明细行编辑、数量步进校验、金额自动计算。
- 产品库：支持新增、编辑、作废/启用、导入与导出。
- 品类库：支持规则配置、启用/停用、转移产品。
- 工作日：查询指定年月的工作日清单。
- 用户信息：维护个人信息与密码。

## 5. 导入与导出
- 产品导入：上传 Excel 后可先预检，再确认导入。
- 产品导出：导出当前产品库数据。
- 计划导出：按月打包为 ZIP。
- 导出模板：支持自定义标题与列字段。
- 导出精度：支持 0/1/2 位金额精度，仅影响导出显示。

## 6. 使用建议
- 先配置品类规则与产品库，再进行计划生成。
- 若预算区间不合理，生成时会提示预算不可行。
- 导出前确认模板与精度设置，避免报表显示不一致。

## 7. Docker Compose 部署
```yaml
services:
  mongo:
    image: mongo:7
    container_name: autoprocure-mongo
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.runCommand({ ping: 1 }).ok"]
      interval: 10s
      timeout: 5s
      retries: 8

  init-admin:
    image: qiufengqi/autoprocure:latest
    container_name: autoprocure-init-admin
    restart: "no"
    depends_on:
      mongo:
        condition: service_healthy
    command: ["python", "-m", "scripts.init_admin"]
    environment:
      # 后端连接 Mongo（通过 compose 服务名 mongo）
      MONGO_URI: mongodb://mongo:27017
      MONGO_DB: autoprocure

      # 初始化管理员账号（可按需修改）
      INIT_ADMIN_USERNAME: "admin"
      INIT_ADMIN_PASSWORD: "admin123"
      INIT_ADMIN_FULL_NAME: "管理员"

  app:
    image: qiufengqi/autoprocure:latest
    container_name: autoprocure-app
    restart: unless-stopped
    depends_on:
      init-admin:
        condition: service_completed_successfully
    ports:
      - "18766:18766"
    environment:
      # 后端连接 Mongo（通过 compose 服务名 mongo）
      MONGO_URI: mongodb://mongo:27017
      MONGO_DB: autoprocure

      # 认证相关配置
      AUTH_ENABLED: "true"
      JWT_ALGORITHM: HS256
      JWT_EXPIRES_MINUTES: "10080"
      # 部署前请替换为强随机密钥（至少32位）
      JWT_SECRET: "请在部署前替换为强随机密钥"

volumes:
  mongo_data:
```

启动：
```bash
docker compose up -d
```

访问：
```text
http://HOST_IP:18766
```

默认管理员账号：
```text
用户名：admin
密码：admin123
```

如需更深入的技术说明，请参考 `PROJECT_SPEC.md`。
