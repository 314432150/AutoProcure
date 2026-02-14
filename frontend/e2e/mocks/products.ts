import type { Page } from "@playwright/test";
import { json } from "./utils";

type Product = {
  id: string;
  name: string;
  category_id?: string;
  category_name?: string;
  unit?: string;
  base_price?: number;
  volatility?: number;
  item_quantity_range?: { min: number; max: number };
  is_deleted?: boolean;
  updated_at?: string;
};

type Options = {
  items?: Product[];
};

const defaultItems: Product[] = [
  {
    id: "p1",
    name: "土豆",
    category_id: "c1",
    category_name: "蔬菜",
    unit: "斤",
    base_price: 3.5,
    volatility: 0.05,
    item_quantity_range: { min: 1, max: 3 },
    is_deleted: false,
    updated_at: "2026-02-14T08:00:00Z",
  },
];

export const mockProductsApis = async (page: Page, options: Options = {}) => {
  const items = options.items ?? defaultItems;

  await page.route(/.*\/api\/products\/unit-rules(\?.*)?$/, async (route) => {
    return json(route, { splittable_units: ["斤", "千克"] });
  });

  await page.route(/.*\/api\/products(\?.*)?$/, async (route, request) => {
    const method = request.method();
    if (method === "GET") {
      return json(route, { items, total: items.length });
    }
    if (method === "POST") {
      return json(route, { ok: true });
    }
    return route.fallback();
  });

  await page.route(/.*\/api\/products\/batch-update$/, async (route) => {
    return json(route, { ok: true });
  });

  await page.route(/.*\/api\/products\/[^/]+\/?(\?.*)?$/, async (route, request) => {
    if (request.method() === "PUT") {
      return json(route, { ok: true });
    }
    if (request.method() === "DELETE") {
      return json(route, { ok: true });
    }
    return route.fallback();
  });

  await page.route(/.*\/api\/products\/export(\?.*)?$/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: "PK",
    });
  });

  await page.route(/.*\/api\/products\/import(\?.*)?$/, async (route) => {
    return json(route, {
      total: 2,
      valid: 2,
      skipped: 0,
      errors: [],
      warnings: [],
      created: 1,
      updated: 0,
      deactivated: 0,
      deactivate_candidates: [],
    });
  });
};
