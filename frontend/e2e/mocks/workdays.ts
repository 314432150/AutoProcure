import type { Page } from "@playwright/test";
import { json } from "./utils";

export const mockWorkdaysApis = async (page: Page, dates = ["2026-02-03", "2026-02-04"]) => {
  await page.route(/.*\/api\/workdays(\?.*)?$/, async (route) => {
    return json(route, { workdays: dates });
  });
};
