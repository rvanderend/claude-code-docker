#!/usr/bin/env node
// Test de webapp (pwa.html) in een geëmuleerde iPhone met Playwright. Draait in claude-code
// (image gebouwd met WITH_PLAYWRIGHT=1) tegen een draaiende claude-web.
//
//   node claude-web/test-pwa.js
//
// Instellingen via omgevingsvariabelen:
//   CLAUDE_WEB_URL  adres van claude-web (standaard http://claude-web:7681/)
//   WEB_USER, WEB_PASSWORD  als ttyd met -c draait
//   BROWSER         webkit (standaard) of chromium
//   DEVICE          apparaat uit Playwright (standaard "iPhone 15")
//   OUT             map voor screenshots (standaard /tmp/claude-web-test)
//
// De test stuurt alleen onschuldige invoer naar het menu en kiest aan het eind "⏻ Sluiten".
// Er start dus geen Claude of tmux-sessie. Tmux (muis aan) en de sessie in de venstertitel
// worden in de pagina zelf nagebootst. Niet te testen zonder echte iPhone: app-modus vanaf het
// beginscherm, het schermtoetsenbord en verbreken op de achtergrond.
"use strict";
const fs = require("fs");
const path = require("path");
const pw = require("playwright");

const URL_ = process.env.CLAUDE_WEB_URL || "http://claude-web:7681/";
const BROWSER = process.env.BROWSER || "webkit";
const DEVICE = process.env.DEVICE || "iPhone 15";
const OUT = process.env.OUT || "/tmp/claude-web-test";
const PROMPT = "Kies een project >";

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log("✓ " + name); }
  catch (e) { failed++; console.log("✗ " + name + "\n    " + e.message.split("\n")[0]); }
}
function check(ok, msg) { if (!ok) throw new Error(msg); }
const show = (s) => JSON.stringify(s);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw[BROWSER].launch();
  const ctx = await browser.newContext({
    ...pw.devices[DEVICE],
    ...(process.env.WEB_USER ? { httpCredentials: { username: process.env.WEB_USER, password: process.env.WEB_PASSWORD || "" } } : {}),
  });
  // Houd de websockets bij (voor de test van opnieuw verbinden) en, omdat http geen
  // secure context is, een nep-klembord als navigator.clipboard ontbreekt
  await ctx.addInitScript(() => {
    const WS = window.WebSocket;
    window.__ws = [];
    window.WebSocket = function (...a) { const s = new WS(...a); window.__ws.push(s); return s; };
    window.WebSocket.prototype = WS.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    if (!navigator.clipboard)
      Object.defineProperty(navigator, "clipboard", { value: { readText: async () => "plaktest" } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // WebGL tekent in headless niets in een screenshot; de DOM-renderer wel
  const u = new URL(URL_);
  u.searchParams.set("rendererType", "dom");

  // Laad de pagina en wacht op een vers menu; houd bij wat de terminal naar ttyd stuurt
  async function load(nav) {
    await nav();
    await page.waitForFunction(() => window.term && document.getElementById("keybar"));
    await page.evaluate(() => { window.__sent = ""; term.onData((d) => { window.__sent += d; }); });
    await waitMenu();
  }
  const screenText = () => page.evaluate(() => {
    const b = term.buffer.active, out = [];
    for (let i = 0; i < term.rows; i++) { const l = b.getLine(b.viewportY + i); out.push(l ? l.translateToString(true) : ""); }
    return out;
  });
  const waitMenu = () => page.waitForFunction((p) => {
    const b = term.buffer.active;
    for (let i = 0; i < b.length; i++) if (b.getLine(i).translateToString(true).startsWith(p)) return true;
  }, PROMPT, { timeout: 10000 });
  const takeSent = () => page.evaluate(() => { const s = window.__sent; window.__sent = ""; return s; });
  // Maak de invoerregel van het menu leeg (ongeldige keuze = menu opnieuw) en wacht erop
  async function resetMenu() {
    await page.evaluate(() => { term.reset(); term.input("\r", true); });
    await waitMenu();
    await takeSent();
  }
  const tapKey = async (label) => {
    const box = await page.locator("#keybar button", { hasText: label }).first().boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  // Middelpunt van een schermregel van de terminal (voor tikken en vegen)
  const rowPos = (row) => page.evaluate((row) => {
    const r = term.element.querySelector(".xterm-screen").getBoundingClientRect();
    return { x: r.left + r.width / 3, y: r.top + (row + 0.5) * r.height / term.rows };
  }, row);
  const termWrite = (s) => page.evaluate((s) => new Promise((ok) => term.write(s, ok)), s);

  await load(() => page.goto(u.href));

  await test("pagina: viewport, app-modus en icoon", async () => {
    const head = await page.evaluate(() => ({
      viewport: !!document.querySelector('meta[name="viewport"]'),
      app: !!document.querySelector('meta[name="mobile-web-app-capable"]'),
      icon: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href || "",
    }));
    check(head.viewport, "viewport-tag ontbreekt");
    check(head.app, "mobile-web-app-capable ontbreekt");
    check(head.icon.startsWith("data:image/png;base64,") && head.icon.length > 100, "icoon ontbreekt");
  });

  await test("telefoon: smal menu met genummerde lijst", async () => {
    check(await page.evaluate(() => document.documentElement.classList.contains("touch")), "geen touch-klasse");
    const cols = await page.evaluate(() => term.cols);
    check(cols < 60, `te breed: ${cols} kolommen`);
    const lines = await screenText();
    check(lines.some((l) => /^\s*\d+  ⏻ Sluiten/.test(l)), "genummerde lijst niet gevonden");
  });

  await test("toetsenbalk: 12 knoppen onderaan, terminal erboven", async () => {
    const m = await page.evaluate(() => {
      const bar = document.getElementById("keybar").getBoundingClientRect();
      const tc = document.getElementById("terminal-container").getBoundingClientRect();
      return { n: document.querySelectorAll("#keybar button").length, bar: [bar.top, bar.bottom], tc: tc.bottom, h: visualViewport.height };
    });
    check(m.n === 12, `${m.n} knoppen`);
    check(Math.abs(m.bar[1] - m.h) < 1, `balk eindigt op ${m.bar[1]}, scherm is ${m.h} hoog`);
    check(m.tc <= m.bar[0] + 1, "terminal loopt onder de balk door");
  });

  await test("toetsenbalk: knoppen sturen de juiste toetsen", async () => {
    const want = { Esc: "\x1b", "⇥": "\t", "⇧⇥": "\x1b[Z", "←": "\x1b[D", "↑": "\x1b[A", "↓": "\x1b[B", "→": "\x1b[C", "⏎": "\r" };
    for (const [label, data] of Object.entries(want)) {
      await takeSent();
      await tapKey(label);
      const got = await takeSent();
      check(got === data, `${label}: ${show(got)} in plaats van ${show(data)}`);
      if (label === "⏎") await waitMenu(); else await resetMenu();
    }
    await resetMenu();
  });

  await test("toetsenbalk: Ctrl + a = Ctrl-A, daarna weer uit", async () => {
    await tapKey("Ctrl");
    check(await page.locator("#keybar button.on", { hasText: "Ctrl" }).count() === 1, "Ctrl licht niet op");
    await page.keyboard.press("a");
    const got = await takeSent();
    check(got === "\x01", `${show(got)} in plaats van "\\u0001"`);
    check(await page.locator("#keybar button.on").count() === 0, "Ctrl blijft aan");
    await resetMenu();
  });

  await test("toetsenbalk: 📋 plakt het klembord", async () => {
    await page.evaluate(() => { navigator.clipboard.readText = async () => "plaktest"; });
    await tapKey("📋");
    await page.waitForFunction(() => window.__sent.includes("plaktest"), null, { timeout: 2000 });
    await resetMenu();
  });

  await test("toetsenbalk: ⌄ haalt de focus weg (toetsenbord dicht)", async () => {
    await page.evaluate(() => term.focus());
    await tapKey("⌄");
    const focused = await page.evaluate(() => document.activeElement === term.textarea);
    check(!focused, "terminal heeft nog focus");
  });

  await test("menu: tik op een tekstregel stuurt niets", async () => {
    const lines = await screenText();
    const row = lines.findIndex((l) => l.startsWith("Tik op een keuze"));
    check(row >= 0, "kopregel niet gevonden");
    const p = await rowPos(row);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(300);
    const got = await takeSent();
    check(got === "", `stuurde ${show(got)}`);
  });

  await test("vegen: in tmux (muis aan) worden het wielstappen", async () => {
    await termWrite("\x1b[?1000h\x1b[?1006h"); // zoals tmux met 'mouse on'
    const a = await rowPos(Math.floor((await page.evaluate(() => term.rows)) * 0.8));
    const loc = page.locator(".xterm");
    const touch = (y) => [{ identifier: 1, clientX: a.x, clientY: y }];
    await loc.dispatchEvent("touchstart", { touches: touch(a.y), changedTouches: touch(a.y) });
    for (let y = a.y - 50; y >= a.y - 300; y -= 50)
      await loc.dispatchEvent("touchmove", { touches: touch(y), changedTouches: touch(y) });
    await loc.dispatchEvent("touchend", { touches: [], changedTouches: touch(a.y - 300) });
    const got = await takeSent();
    await termWrite("\x1b[?1000l\x1b[?1006l");
    const wheels = got.match(/\x1b\[<(\d+);\d+;\d+M/g) || [];
    check(wheels.length >= 3, `${wheels.length} wielstappen voor 300px vegen (${show(got)})`);
    check(wheels.every((w) => w.startsWith("\x1b[<65;")), `verkeerde richting: ${show(wheels)}`);
    await resetMenu();
  });

  await test("sessie in de titel: URL krijgt ?arg=, ☰ koppelt los (Ctrl-b d)", async () => {
    await termWrite("\x1b]0;tmux:pwtest\x07"); // zoals attach() in claude-menu.sh
    check(new URL(page.url()).searchParams.get("arg") === "pwtest", `URL is ${page.url()}`);
    await takeSent();
    await tapKey("☰");
    const got = await takeSent();
    check(got === "\x02d", `☰ stuurde ${show(got)}`);
    await resetMenu();
  });

  await test("verbinding weg: pagina herlaadt met ?arg= en het menu komt terug", async () => {
    await Promise.all([
      page.waitForEvent("load", { timeout: 10000 }),
      page.evaluate(() => window.__ws[window.__ws.length - 1].close(4000)),
    ]);
    check(new URL(page.url()).searchParams.get("arg") === "pwtest", `URL is ${page.url()}`);
    await load(async () => {});
  });

  await test("terug naar menu in de titel: ?arg= verdwijnt, ☰ herlaadt", async () => {
    await termWrite("\x1b]0;menu\x07");
    check(!new URL(page.url()).searchParams.has("arg"), `URL is ${page.url()}`);
    await load(() => Promise.all([page.waitForEvent("load", { timeout: 10000 }), tapKey("☰")]));
  });

  await test("ander formaat (toetsenbord open): balk en terminal schuiven mee", async () => {
    const vp = page.viewportSize();
    const rows = await page.evaluate(() => term.rows);
    await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) });
    await page.waitForFunction((r) => term.rows < r, rows, { timeout: 2000 });
    const m = await page.evaluate(() => ({ bar: document.getElementById("keybar").getBoundingClientRect().bottom, h: visualViewport.height }));
    await page.setViewportSize(vp);
    await page.waitForFunction((r) => term.rows === r, rows, { timeout: 2000 });
    await page.waitForTimeout(500); // laat xterm uitrazen, anders is viewportY in Chromium soms NaN
    check(Math.abs(m.bar - m.h) < 1, `balk eindigt op ${m.bar}, scherm is ${m.h} hoog`);
    await resetMenu();
  });

  await page.screenshot({ path: path.join(OUT, "menu.png") });

  await test("menu: tik op ⏻ Sluiten stuurt het nummer, verbinding sluit zonder herladen", async () => {
    const lines = await screenText();
    const row = lines.findIndex((l) => /^\s*\d+  ⏻ Sluiten/.test(l));
    const nr = lines[row].trim().split(" ")[0];
    let reloaded = false;
    page.once("load", () => { reloaded = true; });
    const closed = page.evaluate(() => new Promise((ok) =>
      window.__ws[window.__ws.length - 1].addEventListener("close", (e) => ok(e.code))));
    const p = await rowPos(row);
    await page.touchscreen.tap(p.x, p.y);
    const got = await takeSent();
    check(got === nr + "\r", `stuurde ${show(got)} in plaats van ${show(nr + "\r")}`);
    const code = await Promise.race([closed, page.waitForTimeout(5000).then(() => "geen")]);
    check(code === 1000, `sluitcode ${code}`);
    await page.waitForTimeout(1500);
    check(!reloaded, "pagina herlaadde toch");
  });

  await test("geen JavaScript-fouten", async () => {
    check(errors.length === 0, errors.join(" | "));
  });

  await browser.close();
  console.log(`\n${failed ? failed + " mislukt" : "Alles geslaagd"} (${BROWSER}, ${DEVICE}). Screenshot: ${path.join(OUT, "menu.png")}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
