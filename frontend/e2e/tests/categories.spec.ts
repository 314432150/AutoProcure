import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockCategoriesApis } from "../mocks/categories";

test.describe("Categories", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthed(page);
    await mockCategoriesApis(page);
    await page.goto("/categories");
    await expect(page.getByPlaceholder("搜索品类")).toBeVisible();
  });

  test("品类列表加载", async ({ page }) => {
    await expect(page.getByText("共 1 条")).toBeVisible();
    await expect(page.getByText("蔬菜")).toBeVisible();
  });

  test("新增品类名称必填校验", async ({ page }) => {
    await page.getByRole("button", { name: "新增品类" }).click();
    const dialog = page.getByRole("dialog", { name: "新增品类" });
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--warning")).toContainText("请先修正表单校验错误");
    await expect(dialog.getByText("请输入品类名称")).toBeVisible();
  });

  test("新增品类时名称失焦触发校验并显示在表单下方", async ({ page }) => {
    await page.getByRole("button", { name: "新增品类" }).click();
    const dialog = page.getByRole("dialog", { name: "新增品类" });
    await expect(dialog).toBeVisible();

    const nameInput = dialog.getByRole("textbox").first();
    await nameInput.focus();
    await nameInput.blur();

    await expect(dialog.getByText("请输入品类名称")).toBeVisible();
  });

  test("新增品类时数量范围失焦触发校验并显示在表单下方", async ({ page }) => {
    await page.getByRole("button", { name: "新增品类" }).click();
    const dialog = page.getByRole("dialog", { name: "新增品类" });
    await expect(dialog).toBeVisible();

    const spinbuttons = dialog.getByRole("spinbutton");
    await spinbuttons.nth(0).fill("5");
    await spinbuttons.nth(1).fill("2");
    await spinbuttons.nth(1).blur();

    await expect(dialog.getByText("选品数量范围最小值不能大于最大值")).toBeVisible();
  });

  test("新增品类时采购模式必选校验", async ({ page }) => {
    await page.getByRole("button", { name: "新增品类" }).click();
    const dialog = page.getByRole("dialog", { name: "新增品类" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox").first().fill("新鲜品类");
    await dialog.getByRole("button", { name: "保存" }).click();

    await expect(page.locator(".el-message--warning")).toContainText("请先修正表单校验错误");
    await expect(dialog.getByText("请选择采购模式")).toBeVisible();
  });

  test("新增品类表单校验失败时 Ctrl+S 不应提示保存成功", async ({ page }) => {
    let saveCalled = false;
    await page.route(/.*\/api\/categories(\?.*)?$/, async (route, request) => {
      if (request.method() === "POST") {
        saveCalled = true;
      }
      return route.fallback();
    });

    await page.getByRole("button", { name: "新增品类" }).click();
    const dialog = page.getByRole("dialog", { name: "新增品类" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Control+S");
    await expect(page.locator(".el-message--warning")).toContainText("请先修正表单校验错误");
    await expect(dialog.getByText("请输入品类名称")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator(".el-message--success")).toHaveCount(0);
    expect(saveCalled).toBeFalsy();
  });

  test("编辑品类并保存", async ({ page }) => {
    await page.getByText("蔬菜").dblclick();
    await expect(page.getByRole("dialog", { name: "编辑品类" })).toBeVisible();
    await page.getByRole("textbox").first().fill("蔬菜A");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--success")).toContainText("品类已更新");
  });

  test("编辑品类时采购模式必选校验", async ({ page }) => {
    await mockCategoriesApis(page, {
      items: [
        {
          id: "c1",
          name: "蔬菜",
          is_active: true,
          product_count: 2,
          purchase_mode: "",
          items_count_range: { min: 1, max: 3 },
          updated_at: "2026-02-14T08:00:00Z",
        },
      ],
    });
    await page.reload();

    await page.getByText("蔬菜").dblclick();
    const dialog = page.getByRole("dialog", { name: "编辑品类" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "保存" }).click();

    await expect(page.locator(".el-message--warning")).toContainText("请先修正表单校验错误");
    await expect(dialog.getByText("请选择采购模式")).toBeVisible();
  });

  test("无产品直接作废", async ({ page }) => {
    await mockCategoriesApis(page, {
      items: [
        {
          id: "c1",
          name: "蔬菜",
          is_active: true,
          product_count: 0,
          purchase_mode: "daily",
          items_count_range: { min: 1, max: 3 },
          updated_at: "2026-02-14T08:00:00Z",
        },
      ],
    });
    await page.reload();
    const row = page.getByRole("row", { name: /蔬菜/ }).first();
    await row.getByRole("button", { name: "作废" }).click();
    await expect(page.locator(".el-message--success")).toContainText("品类已作废");
  });

  test("有产品作废需选择转移目标", async ({ page }) => {
    await mockCategoriesApis(page, {
      items: [
        {
          id: "c1",
          name: "蔬菜",
          is_active: true,
          product_count: 2,
          purchase_mode: "daily",
        },
        {
          id: "c2",
          name: "肉类",
          is_active: true,
          product_count: 0,
          purchase_mode: "daily",
        },
      ],
    });
    await page.reload();
    const row = page.getByRole("row", { name: /蔬菜/ }).first();
    await row.getByRole("button", { name: "作废" }).click();
    const dialog = page.getByRole("dialog", { name: "作废品类" });
    await expect(dialog).toBeVisible();
    const select = dialog.locator(".el-select").first();
    await select.click({ force: true });
    await page.getByRole("option", { name: "肉类" }).first().click();
    await dialog.getByRole("button", { name: "确认作废" }).click();
    await expect(page.locator(".el-message--success")).toContainText("品类已作废");
  });

  test("启用已作废品类", async ({ page }) => {
    await mockCategoriesApis(page, {
      items: [
        {
          id: "c3",
          name: "已作废品类",
          is_active: false,
          product_count: 0,
          purchase_mode: "daily",
        },
      ],
    });
    await page.reload();
    await page.getByRole("button", { name: "启用" }).click();
    await expect(page.locator(".el-message--success")).toContainText("品类已启用");
  });
});
