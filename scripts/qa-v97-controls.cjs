// Native gestures and public UI observations; no React state/core/clock overrides.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
const {register}=require('node:module'),{pathToFileURL}=require('node:url');
register(pathToFileURL(path.join(__dirname,'determinism-loader.mjs')));
(async()=>{
 const root=path.resolve(__dirname,'..'),load=p=>import(pathToFileURL(path.join(root,'.det-test',p)));
 const {BIRDS_CORE_V5:birds}=await load('lib/verified/galacticBirdsCore.v5.js');
 const {chooseBirdsShot}=await load('scripts/birds-v4-play-fixture.js');
 const {applyCoreInput,stepCore,replayCore}=await load('lib/verified/coreRuntime.v1.js');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const text=CanvasRenderingContext2D.prototype.fillText;window.__gameTexts=[];
   CanvasRenderingContext2D.prototype.fillText=function(t,...args){if(this.canvas.classList.contains('gameCanvas')){window.__gameTexts.push(String(t));if(window.__gameTexts.length>3000)window.__gameTexts.splice(0,1000);}return text.call(this,t,...args);};
  });
  await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:3134');
  await page.getByRole('button',{name:'Iniciar sesión local',exact:true}).tap();
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Subir foto de avatar',exact:true}).tap();
  await(await chooser).setFiles(path.join(root,'public/avatars/avatar-8.svg'));
  await page.getByRole('button',{name:'USAR FOTO',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('.avatarPortrait img')?.src.startsWith('data:image/'));
  await page.getByLabel('Nombre de avatar',{exact:true}).fill(`QA_${viewport.width}`);
  await page.getByRole('button',{name:'CONTINUAR',exact:true}).tap();
  await page.getByRole('button',{name:'Entrenamiento gratis',exact:true}).tap();
  const cdp=await context.newCDPSession(page);
  const touch=async(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x:p.x,y:p.y,id:1}]});
  const swipe=async(from,to,cancel=false)=>{await touch('touchStart',from);for(let i=1;i<=8;i++){await touch('touchMove',{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8});await page.waitForTimeout(15);}await touch(cancel?'touchCancel':'touchEnd',to);};
  const point=async(x,y)=>{const r=await page.locator('canvas.gameCanvas').boundingBox(),scale=Math.min(r.width/390,r.height/620);return{x:r.x+(r.width-390*scale)/2+x*scale,y:r.y+(r.height-620*scale)/2+y*scale};};
  const start=async(name,version)=>{const response=page.waitForResponse(r=>r.url().includes('/verified-match/start'));await page.getByRole('button',{name:`Jugar a ${name}`,exact:true}).tap();const issued=await(await response).json();assert.equal(issued.manifest.game_version,version);await page.locator('.countdownOverlay').waitFor({state:'hidden'});await page.locator('.verificationOverlay').waitFor({state:'hidden'});return issued;};
  const exit=async()=>{const r=page.waitForResponse(r=>r.url().includes('/verified-match/verify'));await page.getByRole('button',{name:'Volver',exact:true}).tap();const reply=await r;assert.equal((await reply.json()).received,true);return reply.request().postDataJSON();};
  console.log(JSON.stringify({game:'avatar',viewport,directUpload:true,croppedPhoto:true,original16:'not-available'}));
  await start('Galactic Slot','2.0.0');
  for(let reel=1;reel<=3;reel++){await page.getByRole('button',{name:`Reducir avance de ruleta ${reel}`,exact:true}).tap();await page.waitForTimeout(80);}
  await page.waitForFunction(()=>document.querySelector('.coreHud')?.textContent.includes('000 NO PERMITIDO'));
  await page.getByRole('button',{name:'Girar ruletas por 5 euros ficticios',exact:true}).tap();await page.waitForTimeout(200);
  assert.match(await page.locator('.coreHud').innerText(),/^100\.00/);
  await page.getByRole('button',{name:'Aumentar avance de ruleta 1',exact:true}).tap();await page.waitForTimeout(80);
  await page.getByRole('button',{name:'Girar ruletas por 5 euros ficticios',exact:true}).tap();await page.waitForTimeout(1600);
  const slotRecord=await exit();assert.equal(slotRecord.inputs.filter(i=>i.action==='SPIN').length,1);
  console.log(JSON.stringify({game:'slot',viewport,zeroWagerBlocked:true,oneShortSpin:true}));
  await start('Dardos','3.0.0');await page.evaluate(()=>window.__gameTexts=[]);
  await swipe(await point(195,550),await point(195,285));await page.waitForTimeout(1400);
  const texts=await page.evaluate(()=>window.__gameTexts);assert.ok(texts.some(t=>/^\d+ PUNTOS$/.test(t)));assert.ok(texts.some(t=>/^ÚLTIMO: \d+$/.test(t)));
  await exit();console.log(JSON.stringify({game:'darts',viewport,throwPoints:true,persistentLastScore:true}));
  const issued=await start('Galactic Birds','5.0.0');let model=birds.create(issued.manifest.seed),shots=0;
  const terminal=page.waitForResponse(r=>r.url().includes('/verified-match/verify'),{timeout:120000});terminal.catch(()=>{});
  while(model.status==='running'&&shots<30){
   const shot=chooseBirdsShot(model),trial=structuredClone(model);
   const angle=(10+shot.aim)*Math.PI/180,length=15+shot.power*7;
   const from=await point(110,440),to=await point(110-Math.cos(angle)*length,440+Math.sin(angle)*length);
   if(!shots){await swipe(from,to,true);await page.waitForTimeout(150);assert.match(await page.locator('.coreHud').innerText(),/30 TIROS/);}
   await swipe(from,to);shots++;
   for(const action of [`AIM_${String(shot.aim).padStart(2,'0')}`,`POWER_${String(shot.power).padStart(2,'0')}`,'SHOOT']){applyCoreInput(birds,trial,action,1e9);stepCore(birds,trial,1e9);}
   while(trial.status==='running'&&trial.phase!=='aim')stepCore(birds,trial,1e9);
   await page.waitForTimeout(Math.max(100,(trial.tick-model.tick)/120*1000+150));model=trial;
   if(model.status==='running')assert.match(await page.locator('.coreHud').innerText(),new RegExp(`NIVEL ${model.level+1}/6`));
  }
  const response=await terminal,payload=response.request().postDataJSON(),result=await response.json();
  assert.equal(result.verified,true);assert.equal(result.won,true);
  const replay=replayCore(birds,payload.inputs,payload.final_tick,issued.manifest.seed,issued.manifest.competition.target_score);assert.equal(replay.valid,true);assert.equal(replay.state.level,5);assert.equal(replay.state.completedKills+replay.state.kills,12);
  console.log(JSON.stringify({game:'birds',viewport,sixFixedLevels:true,shots,verified:true}));
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
