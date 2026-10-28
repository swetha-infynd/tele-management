import { writeFileSync } from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1400, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:4173/seed-names.html" });
await sleep(5000);
for (const [name, path] of [["performance", "/performance"], ["employees", "/employees"], ["leaderboard", "/leaderboard"]]) {
  await send("Page.navigate", { url: "http://127.0.0.1:4173" + path });
  await sleep(3000);
  const probe = await send("Runtime.evaluate", { expression: `JSON.stringify({path: location.pathname, rows: document.querySelectorAll('tbody tr').length, more: [...document.querySelectorAll('button')].filter(b=>/^\\+.*more$/.test(b.textContent.trim())).length, dashes: [...document.querySelectorAll('tbody td')].filter(td=>td.textContent.trim()==='—').length})`, returnByValue: true });
  console.log(name, probe.result?.result?.value);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(`.shot-${name}.png`, Buffer.from(shot.result.data, "base64"));
}
ws.close();
