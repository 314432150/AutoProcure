import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockAuthApis } from "../mocks/auth";
import { mockProcurementApis } from "../mocks/procurement";
import { mockProductsApis } from "../mocks/products";
import { mockCategoriesApis } from "../mocks/categories";

const commonShotOptions = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maxDiffPixelRatio: 0.03,
};

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

test.describe("Visual Smoke", () => {
  test("登录页视觉基线", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(".login-card")).toHaveScreenshot("login-page.png", commonShotOptions);
  });

  test("计划列表视觉基线", async ({ page }) => {
    await setAuthed(page);
    await mockAuthApis(page);
    await mockProcurementApis(page);

    await page.goto("/plans");
    await expect(page.getByText("2026-01-02")).toBeVisible();
    await expect(page.locator(".layout-content")).toHaveScreenshot("plans-page.png", commonShotOptions);
  });

  test("计划明细视觉基线", async ({ page }) => {
    await setAuthed(page);
    await mockAuthApis(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    await mockPlanDetailApis(page);

    await page.goto("/plans/2026-01-02");
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
    await expect(page.locator(".layout-content")).toHaveScreenshot("plan-detail-page.png", commonShotOptions);
  });

  test("产品页工具栏视觉基线", async ({ page }) => {
    await setAuthed(page);
    await mockAuthApis(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);

    await page.goto("/products");
    await expect(page.getByPlaceholder("搜索名称")).toBeVisible();
    await expect(page.locator(".toolbar").first()).toHaveScreenshot(
      "products-toolbar.png",
      commonShotOptions,
    );
  });
});
