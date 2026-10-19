/* Single-image export. Budgets are conservative policy, not hardware guarantees. */
(function(root){
'use strict';
function limits(nav={}){
 const ios=/iPad|iPhone|iPod/.test(nav.userAgent||'')||(/Mac/.test(nav.platform||'')&&nav.maxTouchPoints>1);
 const constrained=ios||(nav.deviceMemory&&nav.deviceMemory<=4);
 return {maxPixels:constrained?12000000:32000000,maxSide:ios?16384:32767};
}
function plan(width,height,budget){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('이미지 크기를 확인하지 못했어.');
 const scale=Math.floor(Math.min(3,budget.maxSide/width,budget.maxSide/height,Math.sqrt(budget.maxPixels/width/height))*100)/100;
 if(scale<1)throw Error(`전체 내역(${Math.ceil(width)} × ${Math.ceil(height)}px)이 이 기기의 한 장 이미지 안전 범위를 넘어. 글자가 작아지거나 내역이 잘릴 수 있어 저장을 중단했어. PC에서 다시 시도하거나 데이터 백업으로 전체 내역을 보관해줘.`);
 return scale;
}
function release(canvas){if(canvas){canvas.width=1;canvas.height=1;}}
function verify(canvas,width,height,scale){
 if(canvas.width!==Math.floor(width*scale)||canvas.height!==Math.floor(height*scale))throw Error('이미지 크기가 일치하지 않아.');
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지 메모리가 부족해.');
 // The export has dark text in both header and footer; reject blank/truncated output.
 for(const [start,end] of [[0,Math.min(canvas.height,250*scale)],[Math.max(0,canvas.height-120*scale),canvas.height]]){
  const data=ctx.getImageData(0,Math.floor(start),canvas.width,Math.max(1,Math.floor(end-start))).data;
  let ink=false;for(let i=0;i<data.length;i+=4)if(data[i+3]>0&&data[i]<140&&data[i+1]<160&&data[i+2]<180){ink=true;break;}
  if(!ink)throw Error('이미지 일부가 비어 있어.');
 }
}
async function render(box,renderer,nav,onProgress=()=>{}){
 const width=Math.ceil(box.getBoundingClientRect().width),height=Math.ceil(Math.max(box.scrollHeight,box.getBoundingClientRect().height));
 let scale=plan(width,height,limits(nav));
 for(;;){
  let canvas;
  try{
   onProgress(scale);
   // Allocate once, verify the last pixel, then let html2canvas reuse the allocation.
   canvas=document.createElement('canvas');canvas.width=Math.floor(width*scale);canvas.height=Math.floor(height*scale);
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('캔버스 할당 실패');
   ctx.fillStyle='#123456';ctx.fillRect(canvas.width-1,canvas.height-1,1,1);
   if(ctx.getImageData(canvas.width-1,canvas.height-1,1,1).data[3]!==255)throw Error('캔버스 크기 제한');
   await renderer(box,{canvas,scale,width,height,windowWidth:width,windowHeight:height,scrollX:0,scrollY:0,backgroundColor:'#f3f5f9'});
   verify(canvas,width,height,scale);
   const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(resolve,'image/png')}catch(e){reject(e)}});
   if(!blob||!blob.size||blob.type!=='image/png')throw Error('PNG 변환 실패');
   return {blob,width:canvas.width,height:canvas.height,scale};
  }catch(e){
   if(scale<=1)throw Error('전체 내역을 한 장 이미지로 만들 메모리나 캔버스 공간이 부족해. 빈 이미지 저장을 중단했어. 다른 앱을 닫고 재시도하거나 PC에서 저장해줘.');
   scale=Math.max(1,Math.floor(scale*.75*100)/100);
  }finally{release(canvas)}
 }
}
const api={limits,plan,verify,render,release};
if(typeof module!=='undefined')module.exports=api;else root.PaymentImage=api;
})(typeof globalThis!=='undefined'?globalThis:this);
