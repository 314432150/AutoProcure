import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockAuthApis } from "../mocks/auth";
import { mockProcurementApis } from "../mocks/procurement";
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

const openExportActionMenu = async (page: Page) => {
  const group = page.locator(".split-action", {
    has: page.getByRole("button", { name: "导出Excel" }),
  });
  await group.locator(".split-trigger").click();
};

test.describe("Smoke Matrix", () => {
  test("登录后默认进入计划生成页", async ({ page }) => {
    await mockAuthApis(page);
    await mockProcurementApis(page);

    await page.goto("/login");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/plans/);
    await expect(page.getByRole("button", { name: "生成计划" })).toBeVisible();
  });

  test("计划页导出主按钮与菜单按钮行为分离", async ({ page }) => {
    await setAuthed(page);
    await mockProcurementApis(page);

    await page.goto("/plans");
    await expect(page.getByText("2026-01-02")).toBeVisible();

    await page.getByRole("button", { name: "导出Excel" }).click();
    await expect(page.getByRole("menuitem", { name: "模板编辑" })).toHaveCount(0);

    await openExportActionMenu(page);
    await expect(page.getByRole("menuitem", { name: "模板编辑" })).toBeVisible();
  });

  test("计划明细新增后移除需二次确认（含行号）", async ({ page }) => {
    await setAuthed(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    await mockPlanDetailApis(page);

    await page.goto("/plans/2026-01-02");
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();

    await page.getByRole("button", { name: "新增行" }).click();

    const viewportWidth = page.viewportSize()?.width || 1280;
    if (viewportWidth <= 900) {
      await expect(page.locator(".mobile-detail-card").first()).toBeVisible();
      await page.getByRole("button", { name: "移除" }).first().click();
    } else {
      await page.getByRole("button", { name: "移除" }).first().click();
    }

    await expect(page.getByRole("dialog", { name: "移除确认" })).toBeVisible();
    await expect(page.getByText("确认移除第 1 条明细吗？")).toBeVisible();
  });
});

