import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockAuthApis } from "../mocks/auth";

test.describe("User", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthed(page);
    await mockAuthApis(page);
    await page.goto("/user");
    await expect(page.getByText("账号信息")).toBeVisible();
  });

  test("修改姓名并保存", async ({ page }) => {
    await page.getByPlaceholder("请输入姓名").fill("张三");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--success")).toContainText("保存成功");
  });

  test("查看个人信息回填", async ({ page }) => {
    const nameInput = page.getByPlaceholder("请输入姓名");
    await expect(nameInput).toHaveValue("管理员");
  });

  test("修改密码流程校验", async ({ page }) => {
    const passwordInputs = page.locator('input[type="password"]');
    const currentPassword = passwordInputs.nth(0);
    const newPassword = passwordInputs.nth(1);
    const confirmPassword = passwordInputs.nth(2);

    await currentPassword.fill("oldpass123");
    await newPassword.fill("abc12345");
    await confirmPassword.fill("abc1234");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--warning")).toContainText(
      "两次输入的新密码不一致",
    );

    await confirmPassword.fill("abc12345");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--success")).toContainText("保存成功");
  });
});
