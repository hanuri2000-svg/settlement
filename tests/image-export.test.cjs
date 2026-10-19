const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const image=require('../image-export.js');
const ios={userAgent:'iPhone'},pc={};
for(const count of [20,50,100,150])test(`${count} entries stay within budgets`,()=>{
 const h=400+count*140;
 for(const nav of [ios,pc]){
  const b=image.limits(nav);
  if(h>b.maxSide||720*h>b.maxPixels){assert.throws(()=>image.plan(720,h,b));continue;}
  const scale=image.plan(720,h,b);
  assert.ok(scale>=1&&scale<=3);assert.ok(720*h*scale*scale<=b.maxPixels);assert.ok(h*scale<=b.maxSide);
 }
});
test('iPad desktop UA and low memory use smaller budget',()=>{
 assert.equal(image.limits({platform:'MacIntel',maxTouchPoints:5}).maxPixels,12000000);
 assert.equal(image.limits({deviceMemory:2}).maxPixels,12000000);
});
test('invalid dimensions and unreadable output rejected',()=>{
 for(const h of [0,NaN,Infinity,100000])assert.throws(()=>image.plan(720,h,image.limits(ios)));
});
function environment(mode='ok'){
 const allocated=[];
 const context={module:{exports:{}},document:{createElement(){
  const c={width:0,height:0,getContext(){return {fillRect(){},getImageData(x,y,w,h){return {data: y===c.height-1?new Uint8Array([18,52,86,255]):mode==='blank'?new Uint8Array(4):new Uint8Array([20,30,40,255])}}}},toBlob(cb){cb(mode==='null'?null:{size:200,type:'image/png'})}};
  allocated.push(c);return c;
 }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../image-export.js'),'utf8'),context);
 return {api:context.module.exports,allocated};
}
const box={getBoundingClientRect:()=>({width:720,height:3200}),scrollHeight:3200};
test('failed render retries with lower resolution and releases every canvas',async()=>{
 const {api,allocated}=environment();let attempts=0;
 const result=await api.render(box,async()=>{if(++attempts===1)throw Error('memory')},pc);
 assert.ok(result.scale<3&&attempts===2);assert.ok(allocated.every(c=>c.width===1&&c.height===1));
});
for(const mode of ['blank','null'])test(`${mode} output is never saved`,async()=>{
 const {api,allocated}=environment(mode);
 await assert.rejects(api.render(box,async()=>{},ios));assert.ok(allocated.every(c=>c.width===1&&c.height===1));
});
test('source preserves storage, calculations and date sorting',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 new vm.Script(html.match(/<script>\n([\s\S]*?)<\/script>/)[1]);
 assert.match(html,/pageSize=items.length,pageCount=1/);
 assert.match(html,/function sortedExpenses\(\)\{return S.expenses.slice\(\).sort/);
 assert.match(html,/settlementReceiptsV1/);
 assert.match(html,/showPaymentImage\(files\[0\]\)/);
});
