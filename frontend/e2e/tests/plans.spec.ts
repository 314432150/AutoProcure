import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockProcurementApis } from "../mocks/procurement";
import { setAuthed } from "../helpers/session";
import { json } from "../mocks/utils";

const openPlans = async (page: Page) => {
  await page.goto("/plans");
  await expect(page.getByText("2026-01-02")).toBeVisible();
};

const openPlanActionMenu = async (page: Page) => {
  const group = page.locator(".split-action", {
    has: page.getByRole("button", { name: "生成计划" }),
  });
  await group.locator(".split-trigger").click();
};

const openExportActionMenu = async (page: Page) => {
  const group = page.locator(".split-action", {
    has: page.getByRole("button", { name: "导出Excel" }),
  });
  await group.locator(".split-trigger").click();
};

test.describe("PlansView", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthed(page);
    await mockProcurementApis(page);
    await openPlans(page);
  });

  test("显示列表与预算警告汇总", async ({ page }) => {
    await expect(page.getByText("2026-01-02")).toBeVisible();
    await expect(page.getByText("共 2 条")).toBeVisible();
    await expect(page.getByText("共 1 条预算不可行提示")).toBeVisible();
    await expect(page.getByRole("button", { name: "生成计划" })).toBeVisible();
  });

  test("选择起止年月，列表刷新", async ({ page }) => {
    await page.route(/.*\/api\/procurement\/plans(\?.*)?$/, async (route, request) => {
      const url = new URL(request.url());
      const startMonth = url.searchParams.get("start_month");
      if (startMonth === "2") {
        return json(route, {
          items: [
            {
              date: "2026-02-01",
              total_amount: 88,
              year_month: "2026-02",
              warnings: [],
            },
          ],
          total: 1,
        });
      }
      return route.fallback();
    });

    const startMonthSelect = page.locator(".ym-select").first().locator(".el-select").nth(1);
    await startMonthSelect.click();
    await page.getByRole("option", { name: /^2$/ }).click();

    await expect(page.getByText("2026-02-01")).toBeVisible();
  });

  test("生成计划成功提示", async ({ page }) => {
    await page.getByRole("button", { name: "生成计划" }).click();
    await expect(page.locator(".el-message--success")).toContainText("生成成功");
  });

  test("生成计划冲突确认后继续生成", async ({ page }) => {
    await mockProcurementApis(page, { generateStatus: "冲突" });
    await openPlans(page);
    await page.getByRole("button", { name: "生成计划" }).click();
    await expect(page.getByText("检测到冲突月份")).toBeVisible();
    await page.getByRole("button", { name: "继续生成" }).click();
    await expect(page.locator(".el-message--success")).toContainText("生成成功");
  });

  test("未配置预算区间时自动弹出预算设置", async ({ page }) => {
    await page.route(/.*\/api\/procurement\/generate(\?.*)?$/, async (route, request) => {
      if (request.method() !== "POST") {
        return route.fallback();
      }
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: 4104,
          message: "未配置预算区间",
        }),
      });
    });

    await page.getByRole("button", { name: "生成计划" }).click();
    await expect(page.getByRole("dialog", { name: "预算设置" })).toBeVisible();
  });

  test("无数据时导出提示", async ({ page }) => {
    await page.route(/.*\/api\/procurement\/plans(\?.*)?$/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0 }),
      });
    });
    await page.reload();
    await expect(page.getByText("共 0 条")).toBeVisible();
    await page.getByRole("button", { name: "导出Excel" }).click();
    await expect(page.locator(".el-message--warning")).toContainText(
      "当前选中时间区间无采购计划数据，无法导出",
    );
  });

  test("导出精度非 2 时弹确认", async ({ page }) => {
    await mockProcurementApis(page, { exportPrecision: 1 });
    await openPlans(page);
    await page.getByRole("button", { name: "导出Excel" }).click();
    await expect(page.getByText("当前导出金额精度为 1 位")).toBeVisible();
    await page.getByRole("button", { name: "继续导出" }).click();
    await expect(page.locator(".el-message--success")).toContainText("已开始下载");
  });

  test("导出触发下载请求", async ({ page }) => {
    const waitExport = page.waitForResponse(/.*\/api\/procurement\/exports.*/);
    await page.getByRole("button", { name: "导出Excel" }).click();
    await waitExport;
  });

  test("预算设置校验与保存", async ({ page }) => {
    await openPlanActionMenu(page);
    await page.getByRole("menuitem", { name: "预算设置" }).click();
    await expect(page.getByRole("dialog", { name: "预算设置" })).toBeVisible();

    await page.getByPlaceholder("最小").fill("200");
    await page.getByPlaceholder("最大").fill("100");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--warning")).toContainText(
      "日预算区间最小值不能大于最大值",
    );

    await page.getByPlaceholder("最小").fill("50");
    await page.getByPlaceholder("最大").fill("200");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--success")).toContainText("预算设置已保存");
    await expect(page.getByRole("dialog", { name: "预算设置" })).toBeHidden();
  });

  test("预算设置取消关闭", async ({ page }) => {
    await openPlanActionMenu(page);
    await page.getByRole("menuitem", { name: "预算设置" }).click();
    await expect(page.getByRole("dialog", { name: "预算设置" })).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("dialog", { name: "预算设置" })).toBeHidden();
  });

  test("模板编辑保存成功", async ({ page }) => {
    await openExportActionMenu(page);
    await page.getByRole("menuitem", { name: "模板编辑" }).click();
    await expect(page.getByRole("dialog", { name: "导出设置" })).toBeVisible();

    await page.getByPlaceholder("模板标题").fill("2026年01月采购清单");
    await page.getByRole("button", { name: "新增列" }).click();
    await page.getByPlaceholder("列标题").last().fill("备注");
    await page.getByRole("button", { name: "保存模板" }).click();
    await expect(page.locator(".el-message--success")).toContainText("模板已保存");
    await expect(page.getByRole("dialog", { name: "导出设置" })).toBeHidden();
  });

  test("模板预览金额按导出精度显示", async ({ page }) => {
    await mockProcurementApis(page, {
      exportPrecision: 1,
      exportPreview: {
        precision: 1,
        rows: [
          {
            index: 1,
            date_text: "01月02日",
            items_text: "物资A0.1元、物资B1.3元",
            day_total: "1.4",
          },
        ],
        month_total: "1.4",
      },
    });
    await openPlans(page);

    await openExportActionMenu(page);
    await page.getByRole("menuitem", { name: "模板编辑" }).click();
    await expect(page.getByRole("dialog", { name: "导出设置" })).toBeVisible();

    await expect(page.getByText("物资A0.1元、物资B1.3元")).toBeVisible();
    await expect(page.getByRole("cell", { name: "1.4" }).first()).toBeVisible();
  });

  test("列表行双击进入详情页", async ({ page }) => {
    await page.getByText("2026-01-02").dblclick();
    await expect(page).toHaveURL(/\/plans\/2026-01-02/);
  });

  test("点击导出主按钮不会同时弹出下拉菜单", async ({ page }) => {
    await page.getByRole("button", { name: "导出Excel" }).click();
    await expect(page.getByRole("menuitem", { name: "模板编辑" })).toHaveCount(0);
  });
});
