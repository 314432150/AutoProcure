import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockProcurementApis } from "../mocks/procurement";
import { mockProductsApis } from "../mocks/products";
import { mockCategoriesApis } from "../mocks/categories";
import { mockWorkdaysApis } from "../mocks/workdays";
import { mockAuthApis } from "../mocks/auth";

const setupMocks = async (page: Parameters<typeof setAuthed>[0]) => {
  await setAuthed(page);
  await mockProcurementApis(page);
  await mockProductsApis(page);
  await mockCategoriesApis(page);
  await mockWorkdaysApis(page);
  await mockAuthApis(page);
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

  test("桌面宽度保留固定侧栏", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setupMocks(page);

    await page.goto("/plans");

    await expect(page.locator(".layout > .sidenav")).toHaveCount(1);
    await expect(page.locator(".menu-toggle")).toHaveCount(0);
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
});
