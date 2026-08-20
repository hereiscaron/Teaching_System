'use strict';
const { spawn } = require('child_process');
const http = require('http');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = 'http://127.0.0.1:9374/';
const PORT = 9367;
const PROFILE = require('path').join(__dirname, '_qa_theme');
function put(url) { return new Promise((res, rej) => { const q = http.request(url, { method: 'PUT' }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d)); }); q.on('error', rej); q.end(); }); }
async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1700,1100', 'about:blank'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  const target = JSON.parse(await put(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP)}`));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const exceptions = [];
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails || {}; exceptions.push((d.exception && d.exception.description) || d.text); } };
  const send = (method, params) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.exceptionDetails ? { __err: (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text } : (r.result && r.result.result && r.result.result.value); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const type = async (sel, txt) => { await ev(`(function(){var i=document.querySelector('${sel}');i.value='${txt}';i.dispatchEvent(new Event('input',{bubbles:true}))})()`); };
  await new Promise((res) => { ws.onopen = res; });
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: APP });
  await sleep(2500);
  const R = {};
  // 锁屏与学校名
  R.lockLogo = await ev(`document.querySelector('.lock-logo').textContent`);
  await type('#lockInput', 'test1234');
  await ev(`document.querySelector('#lockConfirm').click()`);
  await sleep(800);
  await ev(`document.querySelector('#subjectGrid [data-class]').click()`);
  await sleep(700);
  R.descHasYanzhou = await ev(`document.querySelector('#mainContent').textContent.indexOf('烟洲中学') >= 0`);
  R.folio = await ev(`document.documentElement.style.getPropertyValue('--workbench-folio')`);
  R.brand700Default = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--brand-700').trim()`);
  R.bodyBgDefault = await ev(`getComputedStyle(document.body).backgroundColor`);
  // 主题切换：个人信息 → 校徽配色
  await ev(`document.querySelector('#profileNav').click()`);
  await sleep(600);
  R.themeSection = await ev(`(document.querySelector('#themeSection .section-title')||{textContent:''}).textContent`);
  R.themeBtns = await ev(`Array.from(document.querySelectorAll('#themeSection button')).map(function(b){return b.textContent.trim()}).join(',')`);
  await ev(`document.querySelector('#themeBadge').click()`);
  await sleep(700);
  R.datasetTheme = await ev(`document.documentElement.dataset.theme`);
  R.brand700Badge = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--brand-700').trim()`);
  R.bodyBgBadge = await ev(`getComputedStyle(document.body).backgroundColor`);
  R.themePersisted = await ev(`TW.store.read('theme','')`);
  // 刷新后主题保持
  await send('Page.reload');
  await sleep(2500);
  R.themeAfterReload = await ev(`document.documentElement.dataset.theme`);
  R.undoNotPolluted = await ev(`!TW.store.canUndo()`); // theme 写入不应进撤销栈
  // 切回当前配色
  await ev(`document.querySelector('#lockInput')`); // 刷新后锁屏
  await type('#lockInput', 'test1234');
  await ev(`document.querySelector('#lockConfirm').click()`);
  await sleep(800);
  await ev(`document.querySelector('#profileNav').click()`);
  await sleep(600);
  await ev(`document.querySelector('#themeDefault').click()`);
  await sleep(500);
  R.datasetThemeBack = await ev(`document.documentElement.dataset.theme`);
  R.exceptions = exceptions;
  console.log(JSON.stringify(R, null, 2));
  ws.close(); chrome.kill();
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
