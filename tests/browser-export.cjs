// npm install && npx playwright install chromium webkit
// BROWSER=webkit npm run test:browser (WebKit is not an iPhone hardware test).
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
const root=path.resolve(__dirname,'..');
process.env.FONT_DIR ||= path.dirname(require.resolve('@fontsource/noto-sans-kr/400.css'));
const server=createServer((req,res)=>{const urlPath=new URL(req.url,'http://localhost').pathname;const p=process.env.FONT_DIR&&urlPath.startsWith('/test-fonts/')?path.join(process.env.FONT_DIR,urlPath.slice(12)):path.join(root,urlPath==='/'?'index.html':urlPath);try{res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(p))}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
const engine=process.env.BROWSER==='webkit'?webkit:chromium;
browser=await engine.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
const results=[];
for(const mobile of [false,true]){
const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1280,height:900}});
const page=await context.newPage();
await page.route('**/tesseract.min.js',r=>r.fulfill({body:''}));
await page.route('**/html2canvas.min.js',r=>r.fulfill({path:process.env.HTML2CANVAS_PATH||require.resolve('html2canvas/dist/html2canvas.min.js'),contentType:'application/javascript'}));
page.on('dialog',async d=>{page.lastAlert=d.message();await d.dismiss()});
for(const count of [20,50,100,200]){
await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.evaluate(count=>{
 const members=[{id:'a',name:'김정성',active:true},{id:'b',name:'은종근',active:true},{id:'c',name:'이이한',active:true}];
 const expenses=Array.from({length:count},(_,i)=>({id:'expense-'+i,payer:members[i%3].id,amount:12.34+i,date:`2026-10-${String(1+i%18).padStart(2,'0')}`,store:`테스트 매장 ${i}`,memo:'식재료와 생필품 구매 내역',memberIds:['a','b','c'],receipt:i===0}));
 localStorage.setItem('settlementV1',JSON.stringify({title:'회귀검사',members,expenses,settlements:[],archives:[]}));
},count);
await page.reload();await page.waitForFunction(()=>typeof html2canvas==='function');
if(process.env.FONT_DIR){let css=['400.css','700.css'].map(f=>fs.readFileSync(path.join(process.env.FONT_DIR,f),'utf8')).join('\n').replaceAll('./files/','/test-fonts/files/').replaceAll('Noto Sans KR','Apple SD Gothic Neo');await page.addStyleTag({content:css});await page.evaluate(()=>document.fonts.ready)}
const before=await page.evaluate(()=>localStorage.getItem('settlementV1'));const calculations=await page.evaluate(()=>JSON.stringify({total:document.querySelector('#total').textContent,bals:document.querySelector('#bals').textContent,tx:window.CURRENT_TX}));
await page.evaluate(async()=>{await putReceipt('expense-0','receipt-sentinel');window.exportMetrics=null;const original=PaymentImage.render;PaymentImage.render=async(...args)=>{window.sourceHeight=Math.ceil(args[0].getBoundingClientRect().height);const r=await original(...args);window.exportMetrics={width:r.width,height:r.height,scale:r.scale};return r}});
page.lastAlert=null;
await page.click('#payImage');await page.waitForFunction(()=>!document.querySelector('#payImage').disabled,{},{timeout:60000});
const metrics=await page.evaluate(()=>({result:window.exportMetrics,sourceHeight:window.sourceHeight,rows:document.querySelectorAll('#pays .item').length}));
assert.equal(metrics.rows,count);assert.equal(await page.evaluate(()=>JSON.stringify({total:document.querySelector('#total').textContent,bals:document.querySelector('#bals').textContent,tx:window.CURRENT_TX})),calculations);assert.equal(await page.evaluate(()=>localStorage.getItem('settlementV1')),before);assert.equal(await page.evaluate(()=>getReceipt('expense-0')),'receipt-sentinel');
if(metrics.result){
 const downloadPromise=page.waitForEvent('download');
 await page.locator('dialog[open] a').click();const download=await downloadPromise;
 const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const png=Buffer.concat(chunks);
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),metrics.result.width);assert.equal(png.readUInt32BE(20),metrics.result.height);assert.ok(png.length>10000);if(process.env.PREVIEW_PATH&&!mobile&&count===20)fs.writeFileSync(process.env.PREVIEW_PATH,png);
 const completeness=await page.evaluate(()=>{const dates=[...document.querySelectorAll('#pays .date-heading')].map(e=>e.textContent);return dates.every((d,i)=>!i||dates[i-1]>=d)});assert.ok(completeness);
 // Share has to run from the next user click; cancellation retains the download.
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.sharedWithActivation=navigator.userActivation.isActive;throw new DOMException('cancelled','AbortError')}})});
 await page.locator('dialog[open] button.btn').click();assert.equal(await page.evaluate(()=>window.sharedWithActivation),true);assert.equal(await page.locator('dialog[open]').count(),1);
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('denied','NotAllowedError')}}));await page.locator('dialog[open] button.btn').click();await page.locator('dialog[open] .status').waitFor({state:'visible'});
 await page.locator('dialog[open] .x').click();await page.waitForFunction(()=>paymentImageURL===null);
 results.push({engine:process.env.BROWSER||'chromium',profile:mobile?'iPhone UA (not hardware)':'desktop',count,...metrics,bytes:png.length,status:'downloaded'});
}else{
 assert.ok(page.lastAlert?.includes('안전 범위'));assert.equal(await page.locator('dialog[open]').count(),0);
 results.push({profile:mobile?'iPhone UA (not hardware)':'desktop',count,...metrics,status:'safely refused'});
}
}
await context.close();
}
console.log(JSON.stringify({browser:await browser.version(),results},null,2));
}finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
