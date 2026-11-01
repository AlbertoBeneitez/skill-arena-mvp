// Real touch entry, local identity isolation, reload and metadata checks.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
const context=await browser.newContext({viewport:process.env.QA_LANDSCAPE?{width:844,height:390}:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:3000');
assert.equal(await page.title(),'GALACTIC GAMES');
await page.getByRole('button',{name:'Iniciar sesión local',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Google, próximamente'}).isDisabled(),true);
assert.equal(await page.getByRole('button',{name:'Apple, próximamente'}).isDisabled(),true);
assert.equal(await page.locator('.welcomeCard p').count(),0); assert.equal(await page.locator('.welcomeCard button').count(),3); assert.match(await page.locator('.galacticEntryAction').innerText(),/SESIÓN LOCAL/);
assert.equal(/Skill Arena/i.test(await page.locator('body').innerText()),false);
assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>window.innerWidth),false);
if(process.env.QA_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.QA_ARTIFACT_DIR,`galactic-entry-${process.env.QA_LANDSCAPE?'landscape':'portrait'}.png`),fullPage:true});
await page.getByRole('button',{name:'Iniciar sesión local',exact:true}).tap();
const enter=page.getByRole('button',{name:'CONTINUAR',exact:true});assert.equal(await enter.isDisabled(),true);
await page.getByRole('button',{name:'Avatar 4',exact:true}).tap();assert.equal(await page.getByRole('button',{name:'Avatar 4',exact:true}).getAttribute('aria-pressed'),'true');
await page.getByLabel('Nombre de avatar',{exact:true}).fill('Galactic QA');await enter.tap();
await page.getByRole('button',{name:'Jugar a Stack',exact:true}).waitFor();
assert.equal(await page.locator('.tutorialOverlay').isVisible(),false,'Help must not block first play');
const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('skill-arena-v12')));assert.equal(stored.provider,null);assert.equal(stored.onboarded,true);assert.equal(stored.avatarId,3);
await page.reload();await page.getByRole('button',{name:'Jugar a Stack',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Iniciar sesión local',exact:true}).count(),0);
assert.equal(/Skill Arena/i.test(await page.locator('body').innerText()),false);
const manifest=await(await page.request.get(new URL('/manifest.webmanifest',page.url()).href)).json();assert.equal(manifest.name,'GALACTIC GAMES');assert.equal(manifest.display,'standalone');
assert.equal(await page.getByRole('button',{name:'Cómo funcionan los retos',exact:true}).count(),0);assert.equal(await page.locator('.tutorialOverlay').count(),0);
assert.deepEqual(errors,[]);
    assert.doesNotMatch(await page.locator("body").innerText(), /\bdemo\b|\bdemostración\b/iu, "frontend copy must identify local/sample scope without demo wording");console.log(JSON.stringify({title:await page.title(),storedIdentity:{provider:stored.provider,avatarId:stored.avatarId},manifest:manifest.name,errors}));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
