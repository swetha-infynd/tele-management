import { writeFileSync } from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:4173/dial-data" });
await sleep(4000);
const click = await send("Runtime.evaluate", { expression: `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Upload call data')); b?.click(); return !!b;})()`, returnByValue: true });
console.log("opened:", click.result?.result?.value);
await sleep(1000);
const doc = await send("DOM.getDocument", { depth: -1 });
const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: 'input[type="file"]' });
console.log("file input node:", q.result?.nodeId);
const base = "/home/ashwin/projects/tele-management/Infynd CRM";
const set = await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [
  base + "/BEC/Call Details for Agency BEC 19-10-2026 000000 - 25-10-2026 235959.csv",
  base + "/Cream Life Insurance Campaign/Call Details for Agency CREAM 19-10-2026 000000 - 22-10-2026 235900.csv",
  base + "/EDF Campaign/Call Details for Campaign My Utility - EDF Live 19-10-2026 000000 - 22-10-2026 235900.csv",
]});
console.log("set files err:", set.error?.message);
await sleep(6000);
const info = await send("Runtime.evaluate", { expression: `(()=>{const d=document.querySelector('[role=dialog]'); if(!d) return 'no dialog'; const r=d.getBoundingClientRect(); const c=d.firstElementChild; return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),vw:innerWidth,vh:innerHeight,scrollW:d.scrollWidth,scrollH:d.scrollHeight, clientW:d.clientWidth, clientH:d.clientHeight, clippedX: d.scrollWidth>d.clientWidth, clippedY: d.scrollHeight>d.clientHeight});})()`, returnByValue: true });
console.log("dialog metrics:", info.result?.result?.value);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(".upload-dialog.png", Buffer.from(shot.result.data, "base64"));
console.log("saved");
ws.close();
