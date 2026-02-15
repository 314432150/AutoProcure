import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthed } from "../helpers/session";
import { mockAuthApis } from "../mocks/auth";
import { mockProcurementApis } from "../mocks/procurement";
import { mockProductsApis } from "../mocks/products";
import { mockCategoriesApis } from "../mocks/categories";
import { mockWorkdaysApis } from "../mocks/workdays";

const mockPlanDetailApis = async (page: Page) => {
  await page.route(/.*\/api\/procurement\/plans\/\d{4}-\d{2}-\d{2}.*/, async (route, request) => {
    if (request.method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-01-02",
        total_amount: 0,
        items: [],
        updated_at: "2026-02-14T08:00:00Z",
      }),
    });
  });
};

const openExportActionMenu = async (page: Page) => {
  const group = page.locator(".split-action", {
    has: page.getByRole("button", { name: "导出Excel" }),
  });
  await group.locator(".split-trigger").click();
};

const openMenuAndGo = async (page: Page, name: string) => {
  const menuToggle = page.locator(".menu-toggle");
  if (await menuToggle.isVisible()) {
    await menuToggle.click();
  }
  await page.getByRole("menuitem", { name: new RegExp(name) }).click();
};

const getLocatorRect = async (locator: ReturnType<Page["locator"]>) => {
  return locator.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });
};

test.describe("Smoke Matrix", () => {
  test("登录后默认进入计划生成页", async ({ page }) => {
    await mockAuthApis(page);
    await mockProcurementApis(page);

    await page.goto("/login");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/plans/);
    await expect(page.getByRole("button", { name: "生成计划" })).toBeVisible();
  });

  test("计划页导出主按钮与菜单按钮行为分离", async ({ page }) => {
    await setAuthed(page);
    await mockProcurementApis(page);

    await page.goto("/plans");
    await expect(page.getByText("2026-01-02")).toBeVisible();

    await page.getByRole("button", { name: "导出Excel" }).click();
    await expect(page.getByRole("menuitem", { name: "模板编辑" })).toHaveCount(0);

    await openExportActionMenu(page);
    await expect(page.getByRole("menuitem", { name: "模板编辑" })).toBeVisible();
  });

  test("计划明细新增后移除需二次确认（含行号）", async ({ page }) => {
    await setAuthed(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    await mockPlanDetailApis(page);

    await page.goto("/plans/2026-01-02");
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();

    await page.getByRole("button", { name: "新增行" }).click();

    const viewportWidth = page.viewportSize()?.width || 1280;
    if (viewportWidth <= 900) {
      await expect(page.locator(".mobile-detail-card").first()).toBeVisible();
      await page.getByRole("button", { name: "移除" }).first().click();
    } else {
      await page.getByRole("button", { name: "移除" }).first().click();
    }

    await expect(page.getByRole("dialog", { name: "移除确认" })).toBeVisible();
    await expect(page.getByText("确认移除第 1 条明细吗？")).toBeVisible();
  });

  test("多标签打开后页面不应出现横向溢出", async ({ page }) => {
    await setAuthed(page);
    await mockProcurementApis(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);
    await mockWorkdaysApis(page);
    await mockAuthApis(page);

    await page.goto("/plans");
    await openMenuAndGo(page, "产品库");
    await openMenuAndGo(page, "品类库");
    await openMenuAndGo(page, "工作日");
    await openMenuAndGo(page, "计划生成");

    const width = await page.locator(".layout-main").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));

    expect(width.scrollWidth).toBeLessThanOrEqual(width.clientWidth + 2);
  });

  test("产品页工具栏在平板宽度应保持单行", async ({ page }) => {
    await setAuthed(page);
    await mockProductsApis(page);
    await mockCategoriesApis(page);

    await page.goto("/products");
    await expect(page.getByPlaceholder("搜索名称")).toBeVisible();

    const viewportWidth = page.viewportSize()?.width || 1280;
    if (viewportWidth < 900 || viewportWidth > 1180) {
      return;
    }

    const toolbar = page.locator(".toolbar").first();
    const selects = toolbar.locator(".el-select");
    await expect(selects).toHaveCount(2);

    const searchRect = await getLocatorRect(page.getByPlaceholder("搜索名称"));
    const categoryRect = await getLocatorRect(selects.nth(0));
    const statusRect = await getLocatorRect(selects.nth(1));
    const queryRect = await getLocatorRect(toolbar.getByRole("button", { name: "查询" }));

    const tolerance = 8;
    expect(Math.abs(searchRect.top - categoryRect.top)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(searchRect.top - statusRect.top)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(searchRect.top - queryRect.top)).toBeLessThanOrEqual(tolerance);
  });

  test("工作日标记不应遮挡日期数字", async ({ page }) => {
    await setAuthed(page);
    await mockWorkdaysApis(page, ["2026-02-03", "2026-02-04", "2026-02-11"]);

    await page.goto("/workdays");
    const cell = page.locator(".calendar-cell.workday").first();
    await expect(cell).toBeVisible();

    const relation = await cell.evaluate((el) => {
      const mark = el.querySelector(".calendar-mark");
      const day = el.querySelector(".calendar-day");
      if (!mark || !day) return null;

      const m = mark.getBoundingClientRect();
      const d = day.getBoundingClientRect();
      const markCx = m.left + m.width / 2;
      const markCy = m.top + m.height / 2;
      const dayCx = d.left + d.width / 2;
      const dayCy = d.top + d.height / 2;

      return {
        markCx,
        markCy,
        dayCx,
        dayCy,
      };
    });

    expect(relation).not.toBeNull();
    expect(relation!.markCx).toBeGreaterThan(relation!.dayCx);
    expect(relation!.markCy).toBeLessThan(relation!.dayCy);
  });

  test("移动端登录信息条不应遮挡登录按钮", async ({ page }) => {
    await page.goto("/login");
    const loginButton = page.getByRole("button", { name: "登录" });
    await expect(loginButton).toBeVisible();

    const infoLine = page.locator(".mobile-info-line");
    if ((await infoLine.count()) === 0 || !(await infoLine.first().isVisible())) {
      return;
    }

    const btnRect = await loginButton.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    const infoRect = await infoLine.first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });

    expect(infoRect.top).toBeGreaterThanOrEqual(btnRect.bottom + 4);
  });
});
