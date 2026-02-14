import type { Page } from "@playwright/test";
import { json } from "./utils";

type Category = {
  id: string;
  name: string;
  is_active: boolean;
  product_count?: number;
  purchase_mode?: "daily" | "periodic" | "";
  items_count_range?: { min: number; max: number } | null;
  cycle_days?: number | null;
  float_days?: number | null;
  updated_at?: string;
};

type Options = {
  items?: Category[];
};

const defaultItems: Category[] = [
  {
    id: "c1",
    name: "蔬菜",
    is_active: true,
    product_count: 2,
    purchase_mode: "daily",
    items_count_range: { min: 1, max: 3 },
    updated_at: "2026-02-14T08:00:00Z",
  },
];

export const mockCategoriesApis = async (page: Page, options: Options = {}) => {
  const items = options.items ?? defaultItems;

  await page.route(/.*\/api\/categories(\?.*)?$/, async (route, request) => {
    if (request.method() === "GET") {
      return json(route, { items });
    }
    if (request.method() === "POST") {
      return json(route, { ok: true });
    }
    return route.fallback();
  });

  await page.route(/.*\/api\/categories\/[^/]+$/, async (route, request) => {
    if (request.method() === "PUT") {
      return json(route, { ok: true });
    }
    return route.fallback();
  });

  await page.route(/.*\/api\/categories\/[^/]+\/deactivate$/, async (route) => {
    return json(route, { ok: true });
  });

  await page.route(/.*\/api\/categories\/[^/]+\/activate$/, async (route) => {
    return json(route, { ok: true });
  });
};
