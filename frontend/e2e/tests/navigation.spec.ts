import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockProcurementApis } from "../mocks/procurement";
import { mockProductsApis } from "../mocks/products";
import { mockCategoriesApis } from "../mocks/categories";
import { mockWorkdaysApis } from "../mocks/workdays";
import { mockAuthApis } from "../mocks/auth";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthed(page);
    await mockProcurementApis(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    await mockWorkdaysApis(page);
    await mockAuthApis(page);
    await page.goto("/plans");
  });

  test("侧边栏跳转到各模块页面", async ({ page }) => {
    await page.getByRole("menuitem", { name: /产品库/ }).click();
    await expect(page.getByPlaceholder("搜索名称")).toBeVisible();

    await page.getByRole("menuitem", { name: /品类库/ }).click();
    await expect(page.getByPlaceholder("搜索品类")).toBeVisible();

    await page.getByRole("menuitem", { name: /工作日/ }).click();
    await expect(page.getByText("工作日清单")).toBeVisible();

    await page.getByRole("menuitem", { name: /用户信息/ }).click();
    await expect(page.getByText("账号信息")).toBeVisible();
  });
});
