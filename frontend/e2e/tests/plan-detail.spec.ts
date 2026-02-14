import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockProductsApis } from "../mocks/products";
import { mockCategoriesApis } from "../mocks/categories";

const mockPlanDetailApis = async (page: Page) => {
  await page.route(/.*\/api\/procurement\/plans\/\d{4}-\d{2}-\d{2}.*/, async (route, request) => {
    if (request.method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-01-02",
        total_amount: 0,
        items: [],
        updated_at: "2026-02-14T08:00:00Z",
      }),
    });
  });
};

test.describe("PlanDetail", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthed(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    await mockPlanDetailApis(page);
    const productsReady = page.waitForResponse(/.*\/api\/products(\?.*)?/);
    await page.goto("/plans/2026-01-02");
    await productsReady;
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
  });

  test("空明细保存提示", async ({ page }) => {
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--warning")).toContainText(
      "请至少保留一条明细",
    );
  });

  test("新增行后删除行", async ({ page }) => {
    await page.getByRole("button", { name: "新增行" }).click();
    await expect(page.getByRole("button", { name: "移除" })).toBeVisible();
    await page.getByRole("button", { name: "移除" }).click();
    await expect(page.getByRole("button", { name: "移除" })).toHaveCount(0);
  });

  test("选择产品后联动单位与金额", async ({ page }) => {
    await page.getByRole("button", { name: "新增行" }).click();
    const row = page.locator("tbody tr").first();
    await row.locator(".select-placeholder").click();
    const combo = row.getByRole("combobox").first();
    await combo.click();
    await expect(page.getByRole("option", { name: "土豆" }).first()).toBeVisible();
    await page.getByRole("option", { name: "土豆" }).first().click();

    await expect(page.getByText("斤")).toBeVisible();
    await expect(page.getByText("3.50")).toBeVisible();
    await expect(row.locator(".amount-text")).toHaveText(/0\.\d{2}/);
  });

  test("数量输入按单位步进", async ({ page }) => {
    await page.getByRole("button", { name: "新增行" }).click();
    const row = page.locator("tbody tr").first();
    await row.locator(".select-placeholder").click();
    const combo = row.getByRole("combobox").first();
    await combo.click();
    await expect(page.getByRole("option", { name: "土豆" }).first()).toBeVisible();
    await page.getByRole("option", { name: "土豆" }).first().click();

    const qtyInput = page.getByRole("spinbutton").first();
    await qtyInput.fill("0.15");
    await qtyInput.blur();
    await expect(qtyInput).toHaveValue("0.2");
  });

  test("保存成功提示与状态更新", async ({ page }) => {
    await page.getByRole("button", { name: "新增行" }).click();
    const row = page.locator("tbody tr").first();
    await row.locator(".select-placeholder").click();
    const combo = row.getByRole("combobox").first();
    await combo.click();
    await expect(page.getByRole("option", { name: "土豆" }).first()).toBeVisible();
    await page.getByRole("option", { name: "土豆" }).first().click();
    await page.getByRole("button", { name: "保存" }).click();
    const adjustDialog = page.getByRole("dialog", { name: "金额已调整" });
    await adjustDialog
      .waitFor({ state: "visible", timeout: 2000 })
      .then(async () => {
        await adjustDialog.getByRole("button", { name: "继续保存" }).click();
      })
      .catch(() => {});
    await expect(page.locator(".save-state--clean")).toContainText("已保存");
  });

  test("未保存修改离开提示", async ({ page }) => {
    await page.getByRole("button", { name: "新增行" }).click();
    await page.getByText("返回计划列表").click();
    await expect(
      page.getByRole("dialog", { name: "未保存修改" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "留在当前页" }).click();
    await expect(page).toHaveURL(/\/plans\/2026-01-02/);
  });
});
