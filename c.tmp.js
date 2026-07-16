const { chromium } = require("playwright");
const addOne = async (p) => {
  const a = await p.evaluate(() => {
    const els = [...document.querySelectorAll('[aria-label^="Add "]')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.top > 100 && r.top < innerHeight - 60;
    });
    if (!els[0]) return null;
    const r = els[0].getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (a) await p.mouse.click(a.x, a.y);
};
(async () => {
  const b = await chromium.launch();
  const errs = [];
  // With a table (desktop drawer).
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(process.argv[3], { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(1200);
  await addOne(p);
  await p.waitForTimeout(800);
  await p.locator('[aria-label="Open cart"]').click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: process.argv[2] + "-cart.png" });

  // Phone sheet — the badge must survive the narrow header.
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  ph.on("pageerror", (e) => errs.push("phone: " + e));
  await ph.goto(process.argv[3], { waitUntil: "networkidle" });
  await ph.waitForTimeout(2500);
  await ph.keyboard.press("ArrowRight");
  await ph.waitForTimeout(1200);
  await addOne(ph);
  await ph.waitForTimeout(800);
  await ph.locator('[aria-label="Open cart"]').click();
  await ph.waitForTimeout(800);
  await ph.screenshot({ path: process.argv[2] + "-phone.png" });

  // No table -> no badge.
  const n = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await n.goto(process.argv[4], { waitUntil: "networkidle" });
  await n.waitForTimeout(2500);
  await n.locator('[aria-label="Open cart"]').click();
  await n.waitForTimeout(700);
  console.log("no-table cart mentions a table?", await n.evaluate(() => /table/i.test(document.body.innerText)));
  console.log("errors:", errs.slice(0, 2));
  await b.close();
})();
