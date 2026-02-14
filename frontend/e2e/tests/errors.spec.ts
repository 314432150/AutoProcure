import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";

test.describe("Errors", () => {
  test("工作日接口失败提示", async ({ page }) => {
    await setAuthed(page);
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(/.*\/api\/workdays(\?.*)?$/, async (route) => {
      await gate;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "服务器内部错误" }),
      });
    });
    await page.goto("/workdays");
    const messages = page.locator(".el-message--error");
    const messageWaiter = expect(messages.first()).toBeVisible();
    release();
    await messageWaiter;
    const texts = await messages.allTextContents();
    expect(texts.join("|")).toMatch(/获取工作日失败|服务器内部错误/);
  });

  test("401 自动跳回登录", async ({ page }) => {
    await setAuthed(page);
    await page.route(/.*\/api\/auth\/me$/, async (route) => {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "未授权" }),
      });
    });
    await page.goto("/user");
    await expect(page).toHaveURL(/\/login/);
  });
});
