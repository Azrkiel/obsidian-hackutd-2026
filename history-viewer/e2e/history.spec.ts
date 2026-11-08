import { test, expect } from "@playwright/test";
import { DbConnection } from "../src/module_bindings";
import { randomUUID } from "node:crypto";

test("local history and live phone leaderboard with ghost", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/history-viewer/");
  await expect(page.locator("#connection")).toContainText("Local SQLite");
  await expect(page.locator("#laps tr")).toHaveCount(1);
  await page.locator("#ghost").click();
  await expect(page.locator("#ghost-status")).toContainText("trace points");
  await page.screenshot({
    path: "test-results/history-local.png",
    fullPage: true,
  });
  const server = process.env.HISTORY_TEST_URL,
    db = process.env.HISTORY_TEST_DB;
  test.skip(
    !server || !db,
    "Set HISTORY_TEST_URL/DB to a fresh disposable SpacetimeDB.",
  );
  let writer: DbConnection;
  await new Promise<void>((resolve, reject) => {
    writer = DbConnection.builder()
      .withUri(server!)
      .withDatabaseName(db!)
      .onConnect(() => resolve())
      .onConnectError((_ctx, e) => reject(e))
      .build();
  });
  try {
    await writer!.reducers.registerCoach({});
    const driver = {
      driver_id: randomUUID(),
      name: "Kevin <script>safe</script>",
      source: "dashboard",
      created_at: Date.now() / 1000,
      revision: 1,
    };
    const session = {
      session_id: randomUUID(),
      driver_id: driver.driver_id,
      track: "monza",
      car: "787b",
      corner: "T1",
      mode: "drill",
      agent: false,
      started_at: Date.now() / 1000,
      revision: 1,
    };
    await writer!.reducers.upsertDriver({ payload: JSON.stringify(driver) });
    await writer!.reducers.startSession({ payload: JSON.stringify(session) });
    const query = new URLSearchParams({
      server: server!,
      db: db!,
      view: "leaderboard",
    }).toString();
    const phone = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await Promise.all([
      page.goto("/history-viewer/?" + query),
      phone.goto("http://127.0.0.1:8097/history-viewer/?" + query),
    ]);
    await expect(page.locator("#connection")).toHaveText("Live / subscribed");
    await expect(phone.locator("#connection")).toHaveText("Live / subscribed");
    const lap = {
      lap_id: randomUUID(),
      session_id: session.session_id,
      n: 1,
      attempt_id: "a-0001",
      role: "baseline",
      valid: true,
      section_s: 6.8,
      brake_board_m: 100,
      input_dropout: false,
      at: Date.now() / 1000,
      revision: 1,
    };
    const trace = {
      lap_id: lap.lap_id,
      rows: JSON.stringify([
        [240, 0, 1, 300, 0],
        [300, 0.9, 0, 270, 1],
      ]),
      revision: 1,
    };
    const started = Date.now();
    await writer!.reducers.recordLap({
      payload: JSON.stringify({ lap, trace }),
    });
    await expect(phone.locator("#board tr")).toHaveCount(1, { timeout: 1000 });
    expect(Date.now() - started).toBeLessThan(1000);
    await expect(page.locator("#board")).toContainText("6.80 s");
    await expect(page.locator("#board")).toContainText(driver.name);
    await expect(page.locator("#qr")).toHaveAttribute(
      "src",
      /^data:image\/png/,
    );
    await phone.screenshot({
      path: "test-results/leaderboard-phone.png",
      fullPage: true,
    });
    await page.locator("#history-tab").click();
    await page.locator("#ghost").click();
    await expect(page.locator("#ghost-status")).toContainText("2 trace points");
    await phone.close();
  } finally {
    writer!.disconnect();
  }
  expect(errors).toEqual([]);
});
