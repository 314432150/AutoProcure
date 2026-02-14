import type { Page } from "@playwright/test";

export const setAuthed = async (
  page: Page,
  user: { id?: string; name?: string } = { id: "e2e", name: "E2E" },
) => {
  await page.addInitScript((u) => {
    localStorage.setItem("auth_token", "e2e-token");
    localStorage.setItem("auth_user", JSON.stringify(u));
  }, user);
};

export const clearAuthed = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  });
};
