import type { Page, Route } from "@playwright/test";

type PlanWarning = {
  reason: string;
  total_amount?: number;
  budget_max?: number;
  budget_min?: number;
  min_cost?: number;
};

type PlanRow = {
  date: string;
  total_amount: number;
  year_month: string;
  warnings?: PlanWarning[];
};

type MockOptions = {
  total?: number;
  plans?: PlanRow[];
  generateStatus?: "正常" | "冲突";
  exportPrecision?: number;
  exportPreview?: {
    precision: number;
    rows: Array<{
      index: number;
      date_text: string;
      items_text: string;
      day_total: string;
      handler?: string;
      witness?: string;
    }>;
    month_total: string;
  };
};

const defaultPlans: PlanRow[] = [
  {
    date: "2026-01-02",
    total_amount: 108.5,
    year_month: "2026-01",
    warnings: [],
  },
  {
    date: "2026-01-03",
    total_amount: 220,
    year_month: "2026-01",
    warnings: [
      {
        reason: "日采总额高于预算上限",
        total_amount: 220,
        budget_max: 100,
      },
    ],
  },
];

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });

export const mockProcurementApis = async (page: Page, options: MockOptions = {}) => {
  const plans = options.plans ?? defaultPlans;
  const total = options.total ?? plans.length;
  const generateStatus = options.generateStatus ?? "正常";
  const exportPrecision = options.exportPrecision ?? 2;
  const exportPreview = options.exportPreview ?? {
    precision: exportPrecision,
    rows: [
      {
        index: 1,
        date_text: "01月02日",
        items_text: "物资A1.0元",
        day_total: "1.0",
        handler: "",
        witness: "",
      },
    ],
    month_total: "1.0",
  };

  await page.route(/.*\/api\/procurement\/settings(\?.*)?$/, async (route, request) => {
    if (request.method() === "PUT") {
      return json(route, { ok: true });
    }
    return json(route, {
      daily_budget_range: { min: 50, max: 200 },
    });
  });

  await page.route(/.*\/api\/procurement\/exports\/settings(\?.*)?$/, async (route, request) => {
    if (request.method() === "PUT") {
      return json(route, { ok: true });
    }
    return json(route, { export_precision: exportPrecision });
  });

  await page.route(/.*\/api\/procurement\/exports\/templates\/single(\?.*)?$/, async (route) => {
    if (route.request().method() === "PUT") {
      return json(route, { ok: true });
    }
    return json(route, {
      title: "{year}年{month:02d}月采购清单",
      columns: [
        { label: "序号", field: "序号" },
        { label: "时间", field: "时间" },
        { label: "物资及金额", field: "物资及金额" },
        { label: "小计（元）", field: "小计（元）" },
      ],
    });
  });

  await page.route(/.*\/api\/procurement\/exports\/preview(\?.*)?$/, async (route) => {
    return json(route, exportPreview);
  });

  await page.route(/.*\/api\/procurement\/plans(\?.*)?$/, async (route, request) => {
    if (request.method() !== "GET") {
      return route.fallback();
    }
    return json(route, { items: plans, total });
  });

  await page.route(/.*\/api\/procurement\/plans\/\d{4}-\d{2}-\d{2}.*/, async (route) => {
    const url = new URL(route.request().url());
    const date = url.pathname.split("/").pop() || "2026-01-02";
    return json(route, {
      date,
      total_amount: 120.5,
      items: [
        { name: "蔬菜", price: 2.5 },
        { name: "鸡蛋", price: 3.2 },
      ],
    });
  });

  await page.route(/.*\/api\/procurement\/generate(\?.*)?$/, async (route, request) => {
    if (request.method() !== "POST") {
      return route.fallback();
    }
    const url = new URL(request.url());
    const forceOverwrite = url.searchParams.get("force_overwrite") === "true";
    const status = forceOverwrite ? "正常" : generateStatus;
    return json(route, { status, warnings: [] });
  });

  await page.route(/.*\/api\/procurement\/exports(\?.*)?$/, async (route, request) => {
    if (request.method() !== "POST") {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/zip",
      body: "PK",
    });
  });
};
