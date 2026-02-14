import type { Page } from "@playwright/test";
import { json } from "./utils";

type AuthOptions = {
  token?: string;
  user?: { id: string; username?: string; full_name?: string; name?: string };
};

export const mockAuthApis = async (page: Page, options: AuthOptions = {}) => {
  const token = options.token ?? "e2e-token";
  const user = options.user ?? {
    id: "u1",
    username: "admin",
    full_name: "管理员",
    name: "管理员",
  };

  await page.route(/.*\/api\/auth\/login$/, async (route) => {
    return json(route, {
      token,
      user_info: user,
    });
  });

  await page.route(/.*\/api\/auth\/me$/, async (route) => {
    return json(route, { user_info: user });
  });

  await page.route(/.*\/api\/auth\/profile$/, async (route, request) => {
    if (request.method() === "PUT") {
      const body = request.postDataJSON?.() || {};
      return json(route, { user_info: { ...user, full_name: body.full_name || user.full_name } });
    }
    return json(route, { user_info: user });
  });

  await page.route(/.*\/api\/auth\/password$/, async (route) => {
    return json(route, { ok: true });
  });
};
