import { expect, test, type Browser, type Page } from "@playwright/test";

// Full vertical slice through the real UI:
// admin sets up society → invites resident + staff → resident raises complaint →
// admin assigns → staff starts + resolves → resident confirms → audit shows history.

const PASSWORD = "e2e-password-123";
const stamp = Date.now().toString(36);
const admin = { name: "Asha Admin", email: `admin-${stamp}@example.test` };
const resident = { name: "Ravi Resident", email: `resident-${stamp}@example.test` };
const staff = { name: "Sunil Staff", email: `staff-${stamp}@example.test` };

async function ready(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}

async function acceptInvite(browser: Browser, url: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ready(page, new URL(url).pathname);
  await page.getByLabel("Choose a password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Join / }).click();
  await page.waitForURL(/\/s\/[^/]+$/);
  return page;
}

async function invite(page: Page, slug: string, who: { name: string; email: string }, role: string, unit?: string): Promise<string> {
  await ready(page, `/s/${slug}/members`);
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Role").selectOption(role);
  if (unit) await page.getByLabel("Unit").selectOption({ label: unit });
  await page.getByRole("button", { name: "Create invite" }).click();
  const link = page.getByLabel("Invite link");
  await expect(link).toBeVisible();
  return link.inputValue();
}

test("resident complaint goes from report to confirmed fix", async ({ browser }) => {
  // --- Admin: sign up and set up society ---
  const adminPage = await (await browser.newContext()).newPage();
  await ready(adminPage, "/signup");
  await adminPage.getByLabel("Full name").fill(admin.name);
  await adminPage.getByLabel("Email").fill(admin.email);
  await adminPage.getByLabel("Password").fill(PASSWORD);
  await adminPage.getByRole("button", { name: "Create account" }).click();
  await adminPage.waitForURL(/\/societies/);

  await adminPage.getByLabel("Society name").fill(`E2E Heights ${stamp}`);
  await adminPage.getByLabel("Address").fill("1 Test Road");
  await adminPage.getByLabel("City").fill("Pune");
  await adminPage.getByLabel("State").fill("Maharashtra");
  await adminPage.getByRole("button", { name: "Create society" }).click();
  await adminPage.waitForURL(/\/s\/[^/]+\/setup/);
  const slug = adminPage.url().split("/s/")[1]!.split("/")[0]!;

  await adminPage.getByLabel("Name").fill("Wing A");
  await adminPage.getByLabel("Code").fill("A");
  await adminPage.getByLabel("Floors").fill("5");
  await adminPage.getByRole("button", { name: "Add building" }).click();
  await expect(adminPage.getByText("Building added.")).toBeVisible();

  await adminPage.getByLabel("Building", { exact: true }).selectOption({ index: 1 });
  await adminPage.getByLabel("Unit number").fill("A-101");
  await adminPage.getByLabel("Floor", { exact: true }).fill("1");
  await adminPage.getByRole("button", { name: "Add unit" }).click();
  await expect(adminPage.getByText("Unit added.")).toBeVisible();

  // --- Invites ---
  const residentLink = await invite(adminPage, slug, resident, "RESIDENT", "A-101");
  const staffLink = await invite(adminPage, slug, staff, "STAFF");
  const residentPage = await acceptInvite(browser, residentLink);
  const staffPage = await acceptInvite(browser, staffLink);

  // --- Resident raises complaint ---
  await ready(residentPage, `/s/${slug}/complaints/new`);
  await residentPage.getByLabel("What kind of problem?").selectOption("PLUMBING");
  await residentPage.getByLabel("Title").fill("Kitchen tap leaking");
  await residentPage.getByLabel("Details").fill("Water drips all night from the kitchen tap.");
  await residentPage.getByRole("button", { name: "Submit complaint" }).click();
  await residentPage.waitForURL(/\/complaints\/[0-9a-f-]{36}/);
  await expect(residentPage.getByText("Complaint submitted.")).toBeVisible();
  const complaintPath = new URL(residentPage.url()).pathname;
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2048)]);
  await residentPage.getByLabel("Add photos").setInputFiles({ name: "tap.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(residentPage.getByRole("heading", { name: "Photos (1)" })).toBeVisible();
  const photoSrc = await residentPage.locator("img[src^=\"/api/files/\"]").first().getAttribute("src");
  expect((await residentPage.request.get(photoSrc!)).status()).toBe(200);

  // --- Admin sees it and assigns staff ---
  await ready(adminPage, `/s/${slug}/complaints?status=NEW`);
  await adminPage.getByRole("link", { name: /Kitchen tap leaking/ }).click();
  await adminPage.getByRole("button", { name: "Assign", exact: true }).click();
  await adminPage.getByLabel("Who will handle it?").selectOption({ label: `${staff.name} (Staff)` });
  await adminPage.getByRole("button", { name: "Assign", exact: true }).last().click();
  await expect(adminPage.getByText("Assigned", { exact: true }).first()).toBeVisible();

  // --- Staff starts and resolves ---
  await ready(staffPage, complaintPath);
  await staffPage.getByRole("button", { name: "Start work" }).click();
  await expect(staffPage.getByRole("button", { name: "Mark as resolved" })).toBeVisible();
  await staffPage.getByRole("button", { name: "Mark as resolved" }).click();
  await staffPage.getByLabel("What was done?").fill("Replaced the tap washer.");
  await staffPage.getByLabel(/Cost/).fill("250.50");
  await staffPage.getByRole("button", { name: "Mark as resolved" }).last().click();
  await expect(staffPage.getByText("Replaced the tap washer.").first()).toBeVisible();

  // --- Resident gets notified and confirms ---
  await ready(residentPage, `/s/${slug}/notifications`);
  await expect(residentPage.getByText(/resolved/i).first()).toBeVisible();
  await ready(residentPage, complaintPath);
  await residentPage.getByRole("button", { name: "Yes, it’s fixed" }).click();
  await expect(residentPage.getByText("Closed", { exact: true }).first()).toBeVisible();
  await expect(residentPage.getByText("₹250.50")).toBeVisible();

  // --- Audit trail has the full history ---
  await ready(adminPage, `/s/${slug}/audit`);
  for (const label of ["raised a complaint", "assigned a complaint", "started work on a complaint", "resolved a complaint", "closed a complaint"]) {
    await expect(adminPage.getByText(label).first()).toBeVisible();
  }
});

test("resident cannot open admin pages or another society", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await ready(page, "/login");
  await page.getByLabel("Email").fill(resident.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/societies/);
  const slug = (await page.getByRole("link", { name: /E2E Heights/ }).getAttribute("href"))!.split("/s/")[1]!;

  for (const p of ["setup", "members", "audit"]) {
    const res = await page.goto(`/s/${slug}/${p}`);
    expect(res?.status()).toBe(404);
  }
  const other = await page.goto("/s/not-my-society");
  expect(other?.status()).toBe(404);
});

test("admin imports flats from a CSV with a preview", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await ready(page, "/login");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/societies/);
  const slug = (await page.getByRole("link", { name: /E2E Heights/ }).getAttribute("href"))!.split("/s/")[1]!;

  await ready(page, `/s/${slug}/setup`);
  const csv = "building_code,unit_number,floor\nA,A-201,2\nA,A-202,2\nA,A-101,1\nZ,Z-1,1\n";
  await page.locator("#csv-file").setInputFiles({ name: "flats.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("button", { name: "Import 2 flats" })).toBeVisible();
  await expect(page.getByText("already exists in Nivaso Plus")).toBeVisible();
  await expect(page.getByText('no building with code "Z"')).toBeVisible();
  await page.getByRole("button", { name: "Import 2 flats" }).click();
  await expect(page.getByText("2 flats imported. 2 rows were skipped.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "A-202", exact: true })).toBeVisible();
});
