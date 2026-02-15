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
});

