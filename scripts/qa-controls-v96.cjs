const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const assert = require('node:assert/strict');
const {register}=require('node:module'); const {pathToFileURL}=require('node:url');
register(pathToFileURL(require('node:path').resolve('scripts/determinism-loader.mjs')));
(async()=>{
const {BILLIARDS_CORE_V3:core}=await import(pathToFileURL(require('node:path').resolve('.det-test/lib/verified/billiardsCore.v3.js')));
const {getBilliardsCamera,projectBilliardsPoint}=await import(pathToFileURL(require('node:path').resolve('.det-test/lib/billiardsPresentation.js')));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('skill-arena-v12',JSON.stringify({onboarded:true,playerName:'QA',balance:25,netEarnings:0,nextTurn:'create',musicOn:false,earnings:[],movements:[],wins:0,losses:0,streak:0,group:null})));
 await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:3131');
 await page.getByRole('button',{name:'Entrenamiento gratis',exact:true}).tap();
 const cdp=await context.newCDPSession(page);
 const touch=async(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x:p.x,y:p.y,id:1,radiusX:2,radiusY:2}]});
 const swipe=async(a,b)=>{await touch('touchStart',a);for(let i=1;i<=8;i++){await touch('touchMove',{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8});await page.waitForTimeout(20);}await touch('touchEnd',b);};
 let issued;
 const starting=page.waitForResponse(r=>r.url().includes('/verified-match/start'));
 await page.getByRole('button',{name:'Jugar a Billar',exact:true}).tap(); issued=await(await starting).json();
 assert.equal(issued.manifest.game_version,'3.0.0');
 await page.locator('.countdownOverlay').waitFor({state:'hidden'});await page.locator('.verificationOverlay').waitFor({state:'hidden'});
 const canvas=page.locator('canvas.gameCanvas'), box=await canvas.boundingBox();
 const width=Math.max(390,box.width/box.height*620), camera=getBilliardsCamera({width,height:620},box.height/620);
 const initial=core.create(issued.manifest.seed), cue={x:initial.balls[0].x/1000,y:initial.balls[0].y/1000};
 const screen=p=>{const projected=projectBilliardsPoint(camera,p);return {x:box.x+projected.x*box.width/width,y:box.y+projected.y*box.height/620};};
 const a=screen(cue),b=screen({x:cue.x-62,y:cue.y});
 await touch('touchStart',a);await touch('touchMove',b);await touch('touchCancel',b);await page.waitForTimeout(150);
 assert.match(await page.locator('.coreHud').innerText(),/18 TIROS/);
 await swipe(a,b);await page.waitForTimeout(400);assert.match(await page.locator('.coreHud').innerText(),/17 TIROS/);
 await page.screenshot({path:`work/billiards-${viewport.width}.png`});
 const rec=page.waitForResponse(r=>r.url().includes('/verified-match/verify'));
 await page.getByRole('button',{name:'Volver',exact:true}).tap();const receipt=await(await rec).json();assert.ok(receipt);
 console.log(JSON.stringify({game:'billiards',viewport,version:issued.manifest.game_version,cancelNoShot:true,releaseShot:true,recordSubmitted:true}));
 await page.getByRole('button',{name:'Jugar a Solitaire Sprint',exact:true}).tap();
 await page.locator('.countdownOverlay').waitFor({state:'hidden'});
 const red=s=>s.includes('♥')||s.includes('♦'),rank=s=>{const t=s.split(' ')[0];return {A:1,J:11,Q:12,K:13}[t]||Number(t);};
 async function legal(){
   const columns=await page.locator('.solitaireColumn').evaluateAll(cols=>cols.map((col,index)=>({index,cards:[...col.querySelectorAll('.faceUp')].map(el=>({label:el.getAttribute('aria-label'),index:[...col.children].indexOf(el)}))})));
   for(const source of columns)for(const card of source.cards){
    if(rank(card.label)===1) return {source:source.index,card,foundation:true};
    for(const dest of columns){if(dest.index===source.index)continue;const top=dest.cards.at(-1);if(top&&rank(top.label)===rank(card.label)+1&&red(top.label)!==red(card.label)) return {source:source.index,card,dest:dest.index};}
   }
   return null;
 }
 let move=await legal();
 if(!move){for(let n=0;n<24&&!move;n++){await page.getByRole('button',{name:'Mazo',exact:true}).tap();move=await legal();}}
 assert.ok(move,'visible legal move available');
 const source=page.locator('.solitaireColumn').nth(move.source).getByRole('button',{name:move.card.label,exact:true});
 await source.tap();await page.waitForTimeout(120);
 assert.equal(await page.locator('.solitaireColumn').nth(move.source).getByRole('button',{name:move.card.label,exact:true}).count(),0,'predictive tap moved selected card');
 // Draw through the stock using visible cards only until a legal waste move appears.
 let dragVerified = false;
 for(let n=0;n<24;n++){
   await page.getByRole('button',{name:'Mazo',exact:true}).tap();
   const waste=page.getByRole('button',{name:'Descarte',exact:true}),text=(await waste.innerText()).replace(/\s+/g,' ');
   const topRank=rank(text), topRed=red(text);
   const targets=await page.locator('.solitaireColumn').evaluateAll(cols=>cols.map((col,index)=>({index,label:col.querySelector('.faceUp:last-child')?.getAttribute('aria-label')})));
   const target=targets.find(t=>t.label&&rank(t.label)===topRank+1&&red(t.label)!==topRed);
   if(!target)continue;
   const from=await waste.boundingBox(),to=await page.locator('.solitaireColumn').nth(target.index).boundingBox();
   await swipe({x:from.x+from.width/2,y:from.y+from.height/2},{x:to.x+to.width/2,y:to.y+Math.min(100,to.height/2)});
   await page.waitForTimeout(120);assert.notEqual((await waste.innerText()).replace(/\s+/g,' '),text,'drag snapped into legal column');
   dragVerified = true;
   break;
 }
 assert.ok(dragVerified, "native legal waste drag completed");
 await page.screenshot({path:`work/solitaire-${viewport.width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Volver',exact:true}).tap();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({game:'solitaire',viewport,predictiveTap:true,snapDrag:true,noPageErrors:true}));
 await context.close();
}
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
