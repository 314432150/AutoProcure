import { test, expect } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockWorkdaysApis } from "../mocks/workdays";

test.describe("Workdays", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthed(page);
    await mockWorkdaysApis(page, ["2026-02-03", "2026-02-04"]);
    await page.goto("/workdays");
    await expect(page.getByText("工作日清单")).toBeVisible();
  });

  test("工作日数量展示", async ({ page }) => {
    await expect(page.getByText("共 2 天")).toBeVisible();
    await expect(page.locator(".calendar-mark").first()).toBeVisible();
  });

  test("切换年月触发刷新", async ({ page }) => {
    await page.route(/.*\/api\/workdays(\?.*)?$/, async (route, request) => {
      const url = new URL(request.url());
      const month = url.searchParams.get("month");
      if (month === "3") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ workdays: ["2026-03-01"] }),
        });
      }
      return route.fallback();
    });

    const monthSelect = page.locator(".ym-select .el-select").nth(1);
    await monthSelect.click();
    await page.getByRole("option", { name: "3" }).click();
    await expect(page.getByText("共 1 天")).toBeVisible();
  });
});
