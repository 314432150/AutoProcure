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

  test("姓名输入框失焦触发校验并显示在下方", async ({ page }) => {
    const nameInput = page.getByPlaceholder("请输入姓名");
    await nameInput.fill("");
    await nameInput.blur();
    await expect(page.getByText("请输入姓名")).toBeVisible();
  });

  test("查看个人信息回填", async ({ page }) => {
    const nameInput = page.getByPlaceholder("请输入姓名");
    await expect(nameInput).toHaveValue("管理员");
  });

  test("默认不展开密码表单，点击后再展开", async ({ page }) => {
    await expect(page.getByRole("button", { name: "修改密码" })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.getByRole("button", { name: "修改密码" }).click();
    await expect(page.locator('input[type="password"]')).toHaveCount(3);
  });

  test("修改密码流程校验", async ({ page }) => {
    await page.getByRole("button", { name: "修改密码" }).click();
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

  test("保存成功后关闭用户页标签不应提示未保存", async ({ page }) => {
    await page.getByPlaceholder("请输入姓名").fill("张三");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--success")).toContainText("保存成功");

    const activeClose = page.locator(".el-tabs__item.is-active .is-icon-close").first();
    await activeClose.click({ force: true });
    await expect(page.getByRole("dialog", { name: "未保存数据" })).toHaveCount(0);
  });
});
