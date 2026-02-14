import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockProcurementApis } from "../mocks/procurement";
import { mockAuthApis } from "../mocks/auth";

const ONBOARDING_DONE_KEY = "autoprocure:onboarding:done:v1";

const forceHumanClient = async (page: Page) => {
  await page.addInitScript(() => {
    const apply = (target: object) => {
      try {
        Object.defineProperty(target, "webdriver", {
          configurable: true,
          get: () => false,
        });
      } catch {
        // no-op: keep fallback behavior if property is not configurable
      }
    };

    apply(Navigator.prototype);
    apply(window.navigator);
  });
};

test.describe("Onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await forceHumanClient(page);
    await setAuthed(page);
    await mockProcurementApis(page);
    await mockAuthApis(page);
  });

  test("首次进入自动弹出引导", async ({ page }) => {
    await page.goto("/plans");

    await expect(page.getByRole("dialog", { name: "系统使用引导" })).toBeVisible();
    await expect(page.getByText("先完善品类库")).toBeVisible();
  });

  test("完成引导后刷新不再自动弹出", async ({ page }) => {
    await page.goto("/plans");

    const dialog = page.getByRole("dialog", { name: "系统使用引导" });
    await expect(dialog).toBeVisible();

    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "完成引导" }).click();

    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), ONBOARDING_DONE_KEY)).toBe(
      "1",
    );

    await page.reload();
    await expect(dialog).toBeHidden();
  });

  test("常驻入口可重新打开引导", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "1"), ONBOARDING_DONE_KEY);
    await page.goto("/plans");

    const dialog = page.getByRole("dialog", { name: "系统使用引导" });
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "新手引导" }).click();
    await expect(dialog).toBeVisible();
  });
});
