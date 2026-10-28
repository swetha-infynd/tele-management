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
for (const [w, h, tag] of [[1366, 768, "1366"], [1280, 720, "1280"]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:4173/dial-data" });
  await sleep(3500);
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Upload call data'))?.click()` });
  await sleep(800);
  const doc = await send("DOM.getDocument", { depth: -1 });
  const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: 'input[type="file"]' });
  const base = "/home/ashwin/projects/tele-management/Infynd CRM";
  await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [
    base + "/BEC/Call Details for Agency BEC 19-10-2026 000000 - 25-10-2026 235959.csv",
    base + "/Cream Life Insurance Campaign/Call Details for Agency CREAM 19-10-2026 000000 - 22-10-2026 235900.csv",
    base + "/EDF Campaign/Call Details for Campaign My Utility - EDF Live 19-10-2026 000000 - 22-10-2026 235900.csv",
  ]});
  await sleep(5000);
  const info = await send("Runtime.evaluate", { expression: `(()=>{const d=document.querySelector('[role=dialog]'); const f=d.querySelector('button:nth-last-child(1)')?.closest('div'); const footer=[...d.querySelectorAll('button')].find(b=>b.textContent.includes('Upload')&&b.textContent.includes('files')); const fr=footer?.getBoundingClientRect(); const r=d.getBoundingClientRect(); const body=[...d.children].find(c=>c.scrollHeight>c.clientHeight); return JSON.stringify({dialogW:Math.round(r.width),dialogH:Math.round(r.height),vh:innerHeight, footerBottom:fr?Math.round(fr.bottom):null, footerVisible: fr ? fr.bottom<=innerHeight && fr.top>=0 : null, bodyScroll: body?{h:body.clientHeight,sh:body.scrollHeight}:null, clippedX:d.scrollWidth>d.clientWidth});})()`, returnByValue: true });
  console.log(tag, info.result?.result?.value);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`.upload-${tag}.png`, Buffer.from(shot.result.data, "base64"));
}
ws.close();
