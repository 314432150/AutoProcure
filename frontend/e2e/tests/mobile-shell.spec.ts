import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockProcurementApis } from "../mocks/procurement";
import { mockProductsApis } from "../mocks/products";
import { mockCategoriesApis } from "../mocks/categories";
import { mockWorkdaysApis } from "../mocks/workdays";
import { mockAuthApis } from "../mocks/auth";
import type { Page } from "@playwright/test";

const setupMocks = async (page: Parameters<typeof setAuthed>[0]) => {
  await setAuthed(page);
  await mockProcurementApis(page);
  await mockProductsApis(page);
  await mockCategoriesApis(page);
  await mockWorkdaysApis(page);
  await mockAuthApis(page);
};

const mockPlanDetailApis = async (page: Page, itemCount = 0) => {
  await page.route(/.*\/api\/procurement\/plans\/\d{4}-\d{2}-\d{2}.*/, async (route, request) => {
    if (request.method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }

    const items = Array.from({ length: itemCount }, (_, index) => ({
      id: `row-${index + 1}`,
      product_id: "p1",
      name: "土豆",
      category_id: "c1",
      category_name: "蔬菜",
      purchase_mode: "daily",
      unit: "斤",
      price: 3.5,
      quantity: 1,
      amount: 3.5,
    }));

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-01-02",
        total_amount: itemCount * 3.5,
        items,
        updated_at: "2026-02-14T08:00:00Z",
      }),
    });
  });
};

test.describe("Mobile Shell Smoke", () => {
  test("1180 以下默认使用抽屉导航", async ({ page }) => {
    await page.setViewportSize({ width: 1112, height: 834 });
    await setupMocks(page);

    await page.goto("/plans");

    await expect(page.locator(".layout > .sidenav")).toHaveCount(0);
    await expect(page.locator(".menu-toggle")).toBeVisible();

    await page.locator(".menu-toggle").click();
    await page.getByRole("menuitem", { name: /产品库/ }).click();

    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByPlaceholder("搜索名称")).toBeVisible();
  });

  test("窄屏使用卡片列表并保持主操作可用", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupMocks(page);

    await page.goto("/plans");
    await expect(page.locator(".mobile-plan-card").first()).toBeVisible();
    await page.getByRole("button", { name: "编辑明细" }).first().click();
    await expect(page).toHaveURL(/\/plans\/\d{4}-\d{2}-\d{2}/);

    await page.locator(".menu-toggle").click();
    await page.getByRole("menuitem", { name: /产品库/ }).click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.locator(".mobile-product-card").first()).toBeVisible();
    await page.getByRole("button", { name: "新增产品" }).click();
    await expect(page.getByRole("dialog", { name: "新增产品" })).toBeVisible();

    await page.locator(".menu-toggle").click();
    await page.getByRole("menuitem", { name: /品类库/ }).click();
    await expect(page.locator(".mobile-category-card").first()).toBeVisible();

    await page.locator(".menu-toggle").click();
    await page.getByRole("menuitem", { name: /工作日/ }).click();
    await expect(page.getByText("工作日清单")).toBeVisible();
  });

  test("竖屏切横屏后移动端导航模式保持可用", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMocks(page);

    await page.goto("/plans");
    await expect(page.locator(".menu-toggle")).toBeVisible();
    await expect(page.locator(".layout > .sidenav")).toHaveCount(0);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(120);

    await expect(page.locator(".menu-toggle")).toBeVisible();
    await expect(page.locator(".layout > .sidenav")).toHaveCount(0);
    await page.locator(".menu-toggle").click();
    await page.getByRole("menuitem", { name: /产品库/ }).click();
    await expect(page).toHaveURL(/\/products/);
  });

  test("移动端登录页聚焦输入后登录按钮仍可见", async ({ page }) => {
    await mockAuthApis(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/login");
    const account = page.getByPlaceholder("请输入账号");
    const password = page.getByPlaceholder("请输入密码");
    const loginBtn = page.getByRole("button", { name: "登录" });

    await account.click();
    await expect(loginBtn).toBeInViewport();
    await password.click();
    await expect(loginBtn).toBeInViewport();
  });

  test("计划明细长列表在移动端可稳定滚动到底部", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthed(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    await mockPlanDetailApis(page, 24);

    await page.goto("/plans/2026-01-02");
    await expect(page.locator(".mobile-detail-card")).toHaveCount(24);

    const content = page.locator(".layout-content");
    await content.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "auto" }));

    await expect(page.getByText("明细 24")).toBeVisible();
    await page.getByRole("button", { name: "移除" }).last().click();
    await expect(page.getByRole("dialog", { name: "移除确认" })).toBeVisible();
    await expect(page.getByText("确认移除第 24 条明细吗？")).toBeVisible();
  });
});
