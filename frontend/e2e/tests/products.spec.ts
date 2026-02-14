import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockProductsApis } from "../mocks/products";
import { mockCategoriesApis } from "../mocks/categories";
import { fileURLToPath } from "url";
import path from "path";

test.describe("Products", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthed(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    const categoriesReady = page.waitForResponse(/.*\/api\/categories(\?.*)?/);
    await page.goto("/products");
    await categoriesReady;
    await expect(page.getByPlaceholder("搜索名称")).toBeVisible();
  });

  test("产品列表加载", async ({ page }) => {
    await expect(page.getByText("共 1 条")).toBeVisible();
    await expect(page.getByText("土豆")).toBeVisible();
  });

  test("新增产品基础校验提示", async ({ page }) => {
    await page.getByRole("button", { name: "新增产品" }).click();
    await expect(page.getByRole("dialog", { name: "新增产品" })).toBeVisible();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--warning")).toContainText(
      "请先修正表单校验错误",
    );
  });

  test("搜索筛选刷新列表", async ({ page }) => {
    await page.route(/.*\/api\/products(\?.*)?$/, async (route, request) => {
      const url = new URL(request.url());
      const keyword = url.searchParams.get("keyword");
      if (keyword) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0 }),
        });
      }
      return route.fallback();
    });

    await page.getByPlaceholder("搜索名称").fill("不存在");
    await page.getByRole("button", { name: "查询" }).click();
    await expect(page.getByText("共 0 条")).toBeVisible();
  });

  test("编辑产品并保存", async ({ page }) => {
    await page.route(/.*\/api\/products\/[^/]+.*/, async (route, request) => {
      if (request.method() === "PUT") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.fallback();
    });
    await page.getByRole("row", { name: /土豆/ }).first().dblclick();
    const dialog = page.getByRole("dialog", { name: "修改产品" });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("请输入产品名称").fill("土豆2");
    const saveWaiter = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/products/") &&
        resp.request().method() === "PUT",
    );
    await page.keyboard.press("Control+S");
    await saveWaiter;
    await expect(dialog).toBeHidden();
  });

  test("新增产品并保存", async ({ page }) => {
    await page.getByRole("button", { name: "新增产品" }).click();
    const dialog = page.getByRole("dialog", { name: "新增产品" });
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("请输入产品名称").fill("白菜");
    const categoryCombo = dialog.getByRole("combobox", { name: "品类" });
    await categoryCombo.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { name: "蔬菜" }).first()).toBeVisible();
    await page.getByRole("option", { name: "蔬菜" }).first().click();
    await dialog.getByPlaceholder("请输入单价，如 3.50").fill("2.5");
    await dialog.getByPlaceholder("请输入波动百分比，如 5").fill("5");

    const rangeGroup = dialog.getByRole("group", { name: "采购数量范围" });
    const qtyInputs = rangeGroup.getByRole("spinbutton");
    await qtyInputs.nth(0).fill("1");
    await qtyInputs.nth(1).fill("3");
    await dialog.getByPlaceholder("如 斤 / 份 / 包").fill("斤");

    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--success")).toContainText("已新增产品");
  });

  test("作废与启用流程", async ({ page }) => {
    let deleted = false;
    await page.route(/.*\/api\/products(\?.*)?$/, async (route, request) => {
      if (request.method() !== "GET") {
        return route.fallback();
      }
      const items = [
        {
          id: "p1",
          name: "土豆",
          category_id: "c1",
          category_name: "蔬菜",
          unit: "斤",
          base_price: 3.5,
          volatility: 0.05,
          item_quantity_range: { min: 1, max: 3 },
          is_deleted: deleted,
          updated_at: "2026-02-14T08:00:00Z",
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items, total: 1 }),
      });
    });
    await page.route(/.*\/api\/products\/[^/]+$/, async (route, request) => {
      if (request.method() === "DELETE") {
        deleted = true;
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      if (request.method() === "PUT") {
        deleted = false;
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.fallback();
    });

    await page.reload();
    await page.getByRole("button", { name: "作废" }).click();
    await expect(page.locator(".el-message--success")).toContainText("已移除");
    await page.reload();
    await page.getByRole("button", { name: "启用" }).click();
    await expect(page.locator(".el-message--success")).toContainText("已启用");
  });

  test("导入Excel未选择文件提示", async ({ page }) => {
    await page.getByRole("button", { name: "更多操作" }).click();
    await page.getByRole("menuitem", { name: "导入Excel" }).click();
    const dialog = page.getByRole("dialog", { name: "导入产品库" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "开始导入" })).toBeDisabled();
  });

  test("导入Excel上传并导入成功", async ({ page }) => {
    await page.getByRole("button", { name: "更多操作" }).click();
    await page.getByRole("menuitem", { name: "导入Excel" }).click();
    const dialog = page.getByRole("dialog", { name: "导入产品库" });
    await expect(dialog).toBeVisible();

    const fileInput = dialog.locator('input[type="file"]');
    const filePath = fileURLToPath(new URL("../fixtures/products.xlsx", import.meta.url));
    await fileInput.setInputFiles(filePath);

    await expect(dialog.getByText("总行数：2")).toBeVisible();
    await dialog.getByRole("button", { name: "开始导入" }).click();
    await expect(page.locator(".el-message--success")).toContainText("导入完成");
    await expect(dialog).toBeHidden();
  });

  test("导出Excel触发请求", async ({ page }) => {
    const downloadWaiter = page.waitForResponse(/.*\/api\/products\/export.*/);
    await page.getByRole("button", { name: "更多操作" }).click();
    await page.getByRole("menuitem", { name: "导出Excel" }).click();
    await downloadWaiter;
  });

  test("加载状态显示", async ({ page }) => {
    let allowResolve;
    const blocker = new Promise((resolve) => {
      allowResolve = resolve;
    });
    await page.route(/.*\/api\/products(\?.*)?$/, async (route) => {
      await blocker;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0 }),
      });
    });
    await page.reload();
    await expect(page.locator(".el-loading-mask").first()).toBeVisible();
    allowResolve();
  });

  test("状态筛选触发刷新", async ({ page }) => {
    await page.route(/.*\/api\/products(\?.*)?$/, async (route, request) => {
      const url = new URL(request.url());
      const isActive = url.searchParams.get("is_active");
      if (isActive === "false") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0 }),
        });
      }
      return route.fallback();
    });

    const toolbar = page.locator(".toolbar").first();
    const statusSelect = toolbar.locator(".el-select").nth(1);
    await statusSelect.click();
    await page.getByRole("option", { name: "已作废" }).click();
    await expect(page.getByText("共 0 条")).toBeVisible();
  });

  test("品类筛选触发刷新", async ({ page }) => {
    await page.route(/.*\/api\/products(\?.*)?$/, async (route, request) => {
      const url = new URL(request.url());
      const categoryId = url.searchParams.get("category_id");
      if (categoryId === "c1") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0 }),
        });
      }
      return route.fallback();
    });

    const toolbar = page.locator(".toolbar").first();
    const categorySelect = toolbar.locator(".el-select").nth(0);
    await categorySelect.click();
    await page.getByRole("option", { name: "蔬菜" }).click();
    await expect(page.getByText("共 0 条")).toBeVisible();
  });
});
