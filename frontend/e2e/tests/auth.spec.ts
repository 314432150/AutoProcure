import { test, expect } from "@playwright/test";
import { clearAuthed } from "../helpers/session";
import { mockAuthApis } from "../mocks/auth";
import { mockCategoriesApis } from "../mocks/categories";
import { mockProductsApis } from "../mocks/products";

test.describe("Auth", () => {
  test("未登录访问受限页面会跳转到登录页", async ({ page }) => {
    await clearAuthed(page);
    await page.goto("/plans");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("自动采购")).toBeVisible();
  });

  test("登录成功后进入产品库", async ({ page }) => {
    await mockAuthApis(page);
    await mockCategoriesApis(page);
    await mockProductsApis(page);

    await page.goto("/login");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByPlaceholder("搜索名称")).toBeVisible();
    await expect(page.locator(".el-message--success")).toContainText("登录成功");
  });

  test("登录成功后显示用户名", async ({ page }) => {
    await mockAuthApis(page, {
      user: { id: "u2", username: "admin", full_name: "张三", name: "张三" },
    });
    await mockCategoriesApis(page);
    await mockProductsApis(page);

    await page.goto("/login");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByText("张三")).toBeVisible();
  });

  test("在密码框按回车可触发登录", async ({ page }) => {
    await mockAuthApis(page);
    await mockCategoriesApis(page);
    await mockProductsApis(page);

    await page.goto("/login");
    await page.getByPlaceholder("请输入密码").press("Enter");

    await expect(page).toHaveURL(/\/products/);
    await expect(page.locator(".el-message--success")).toContainText("登录成功");
  });

  test("登录失败时显示错误提示", async ({ page }) => {
    await page.route(/.*\/api\/auth\/login$/, async (route) => {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "账号或密码错误" }),
      });
    });

    await page.goto("/login");
    await page.getByRole("button", { name: "登录" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(".el-message--error").first()).toContainText("账号或密码错误");
  });

  test("退出登录后跳转登录页并清理状态", async ({ page }) => {
    await mockAuthApis(page);
    await mockCategoriesApis(page);
    await mockProductsApis(page);

    await page.goto("/login");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/products/);

    await page.getByRole("button", { name: "退出" }).first().click();
    await expect(page.getByRole("dialog", { name: "退出登录" })).toBeVisible();
    await page.getByRole("button", { name: "退出" }).last().click();

    await expect(page).toHaveURL(/\/login/);
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    expect(token).toBeFalsy();
  });
});
