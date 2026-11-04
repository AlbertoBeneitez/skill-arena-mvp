"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { STACK_3D_CORE, type Stack3DState, type StackSolid } from "@/lib/verified/precisionStackCore.v4";
import CoreCanvasGame from "./CoreCanvasGame";

import { t as tx, useI18n } from "@/lib/i18n";
/** Material grain tiles (made once per page): brushed metal for the sides and a fine weave for the tops. Drawn as
 * light and dark specks on transparent, laid over each face along its own axes. */
let textureCache: { brushed: CanvasPattern | null; weave: CanvasPattern | null } | null | undefined;
function textures(ctx: CanvasRenderingContext2D) {
  if (textureCache !== undefined) return textureCache;
  if (typeof document === "undefined" || typeof DOMMatrix === "undefined") return (textureCache = null);
  const tile = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"); if (!g) return null;
    draw(g); return ctx.createPattern(c, "repeat");
  };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  textureCache = {
    brushed: tile((g) => {
      for (let y = 0; y < 64; y++) { g.fillStyle = rnd() < .5 ? `rgba(255,255,255,${.06 + rnd() * .16})` : `rgba(0,0,0,${.08 + rnd() * .2})`; g.fillRect(0, y, 64, rnd() < .3 ? 1 : .5); }
      for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(0,0,0,${rnd() * .2})`; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); }
    }),
    weave: tile((g) => {
      g.strokeStyle = "rgba(255,255,255,.24)"; g.lineWidth = 1;
      for (let k = -64; k < 128; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke(); }
      g.strokeStyle = "rgba(0,0,0,.22)";
      for (let k = -64; k < 128; k += 8) { g.beginPath(); g.moveTo(k + 4, 64); g.lineTo(k + 68, 0); g.stroke(); }
      for (let k = 0; k < 260; k++) { g.fillStyle = rnd() < .5 ? `rgba(255,255,255,${rnd() * .3})` : `rgba(0,0,0,${rnd() * .32})`; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); }
    }),
  };
  return textureCache;
}
function rig(ctx: CanvasRenderingContext2D, state: Stack3DState) {
  const W = STACK_3D_CORE.width;
  const placementAge = state.lastPlacement?.landed ? Math.min(1,(state.tick-state.lastPlacement.tick)/36) : 1;
  const follow = placementAge*placementAge*(3-2*placementAge);
  const cameraNow = Math.max(0,state.height-8)*23;
  const cameraBefore = Math.max(0,state.height-9)*23;
  const baseY = 498 + cameraBefore + (cameraNow-cameraBefore)*follow;
  const project = (x: number, z: number, level: number, rise = 0) => ({ x: W / 2 + (x - z) * .50, y: baseY + (x + z) * .27 - level * 23 - rise });
  const polygon = (points: {x:number;y:number}[], fill: string, stroke = "rgba(220,255,255,.18)") => {
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();
  };
  // v143: textured modules instead of flat paint — each face has its own light gradient and a material grain
  // (brushed on the sides, a fine weave on the top) laid along the face, an engraved inset panel on top, a lit groove
  // with rivets round the sides and bright bevels on the edges that face the light. Presentation only.
  const solid = (block: StackSolid, level: number, rise = 0, alpha = 1) => {
    const x = block.xMilli/1000, z = block.zMilli/1000, w = block.wMilli/1000, d = block.dMilli/1000;
    const p = [project(x,z,level,rise),project(x+w,z,level,rise),project(x+w,z+d,level,rise),project(x,z+d,level,rise)];
    const hue=165+(level*17)%135, top = level===state.blocks.length;
    const tex = textures(ctx);
    ctx.save();ctx.globalAlpha=alpha;
    const face = (pts: {x:number;y:number}[], fill: CanvasGradient | string, pattern: CanvasPattern | null, m: [number,number,number,number,number,number], grainAlpha: number) => {
      ctx.beginPath(); pts.forEach((q,i) => i ? ctx.lineTo(q.x,q.y) : ctx.moveTo(q.x,q.y)); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      if (pattern) { pattern.setTransform(new DOMMatrix(m)); ctx.save(); ctx.globalAlpha = alpha * grainAlpha; ctx.fillStyle = pattern; ctx.fill(); ctx.restore(); }
    };
    // Front-left face (along x at z+d) and front-right face (along z at x+w), 21 px tall.
    const fl=[p[3],p[2],{x:p[2].x,y:p[2].y+21},{x:p[3].x,y:p[3].y+21}], fr=[p[1],p[2],{x:p[2].x,y:p[2].y+21},{x:p[1].x,y:p[1].y+21}];
    const side = (pts: typeof fl, l0: number, l1: number, sat: number) => {
      const g = ctx.createLinearGradient(0, pts[0].y, 0, pts[3].y);
      g.addColorStop(0, `hsl(${hue},${sat}%,${l0}%)`); g.addColorStop(.55, `hsl(${hue},${sat}%,${(l0+l1)/2}%)`); g.addColorStop(1, `hsl(${hue},${sat+6}%,${l1}%)`);
      return g;
    };
    face(fl, side(fl, 40, 22, 58), tex?.brushed ?? null, [.5,.27,0,1,p[3].x,p[3].y], .9);
    face(fr, side(fr, 52, 30, 64), tex?.brushed ?? null, [-.5,.27,0,1,p[1].x,p[1].y], .85);
    // Groove with rivets round the sides, a third of the way down.
    for (const [a, b, light] of [[p[3], p[2], .22], [p[1], p[2], .34]] as const) {
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y + 8); ctx.lineTo(b.x, b.y + 8); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${light})`; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(a.x, a.y + 9.3); ctx.lineTo(b.x, b.y + 9.3); ctx.stroke();
      const len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(len / 22);
      ctx.fillStyle = `rgba(255,255,255,${light + .2})`;
      for (let k = 1; k < n; k++) { const t = k / n; ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + 15, .9, 0, Math.PI * 2); ctx.fill(); }
    }
    // Top: lit from the back corner, a fine weave, an engraved inset panel.
    const tg = ctx.createLinearGradient(p[0].x, p[0].y, p[2].x, p[2].y);
    const lt = top ? 74 : 64;
    // A slow shift of hue across the plate (anodised metal), not a single flat tone.
    tg.addColorStop(0, `hsl(${hue-10},82%,${lt+8}%)`); tg.addColorStop(.5, `hsl(${hue+6},74%,${lt}%)`); tg.addColorStop(1, `hsl(${hue+22},70%,${lt-11}%)`);
    face(p, tg, tex?.weave ?? null, [.5,.27,-.5,.27,p[0].x,p[0].y], .85);
    const inset = Math.min(9, w * .12, d * .12);
    if (inset > 3) {
      const q = [project(x+inset,z+inset,level,rise),project(x+w-inset,z+inset,level,rise),project(x+w-inset,z+d-inset,level,rise),project(x+inset,z+d-inset,level,rise)];
      ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); q.forEach((r,i) => i ? ctx.lineTo(r.x,r.y) : ctx.moveTo(r.x,r.y)); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(q[3].x, q[3].y + 1); ctx.lineTo(q[2].x, q[2].y + 1); ctx.lineTo(q[1].x, q[1].y + 1); ctx.stroke();
    }
    // Bevels: bright rim on the two back edges of the top, a soft one on the front corner, dark seams below.
    ctx.lineCap = "round";
    ctx.strokeStyle = `hsla(${hue},90%,92%,.9)`; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(p[3].x, p[3].y); ctx.lineTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
    ctx.strokeStyle = `hsla(${hue},90%,88%,.55)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p[3].x, p[3].y); ctx.lineTo(p[2].x, p[2].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.beginPath(); ctx.moveTo(p[2].x, p[2].y); ctx.lineTo(p[2].x, p[2].y + 21); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(p[3].x, p[3].y + 21); ctx.lineTo(p[2].x, p[2].y + 21); ctx.lineTo(p[1].x, p[1].y + 21); ctx.stroke();
    ctx.restore();
  };
  return { project, polygon, solid, baseY };
}

function render(ctx: CanvasRenderingContext2D, state: Stack3DState) {
  const W = STACK_3D_CORE.width, H = STACK_3D_CORE.height;
  drawSpaceBackdrop(ctx, W, H, 0, state.tick);
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();
  const { project, polygon, solid, baseY } = rig(ctx, state);
  ctx.save();ctx.fillStyle="rgba(0,5,18,.5)";ctx.beginPath();ctx.ellipse(W/2,baseY+45,150,48,0,0,Math.PI*2);ctx.fill();ctx.restore();
  polygon([project(-165,-165,0),project(165,-165,0),project(165,165,0),project(-165,165,0)],"#142d43","#44798e");
  for(let n=-120;n<=120;n+=40){
    ctx.strokeStyle="rgba(109,205,226,.14)";ctx.beginPath();let a=project(n,-150,0),b=project(n,150,0);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  state.blocks.forEach((block,index)=>{
    if(index<state.blocks.length-27)return;
    const rise=index===state.blocks.length-1&&state.phase==="settling"?22*(state.settleRemaining/24)**2:0;
    solid(block,index,rise);
  });
  if(state.phase==="moving"&&state.status!=="failed"){
    solid(state.moving,state.blocks.length,24);
  }
  const last=state.lastPlacement;
  if(last?.landed&&state.tick-last.tick<75){
    const age=state.tick-last.tick;
    const src=last.source,land=last.landed;
    const cutX=src.wMilli-land.wMilli,cutZ=src.dMilli-land.dMilli;
    if(cutX>0){const piece={...src,wMilli:cutX,xMilli:src.xMilli<land.xMilli?src.xMilli:land.xMilli+land.wMilli};solid(piece,state.height, -age*age*.018,Math.max(0,1-age/75));}
    if(cutZ>0){const piece={...src,dMilli:cutZ,zMilli:src.zMilli<land.zMilli?src.zMilli:land.zMilli+land.dMilli};solid(piece,state.height,-age*age*.018,Math.max(0,1-age/75));}
    ctx.fillStyle=last.perfect?"#baffdc":"#ddefff";ctx.font="bold 16px system-ui";ctx.textAlign="center";ctx.fillText(last.perfect?tx("play.perfect", { n: state.combo }):tx("stack.surface", { n: Math.floor((last.landed.wMilli*last.landed.dMilli)/1e8) }),W/2,108);ctx.textAlign="left";
  }
  ctx.restore();
}
/* Failed drop: the block lands where the player let go and the overhang drags it off the tower. */
const FALL_MS = 1900;
function fallFinale(ctx: CanvasRenderingContext2D, state: Stack3DState, elapsedMs: number) {
  const src = state.lastPlacement?.source;
  if (!src) return;
  const top = state.blocks[state.blocks.length - 1];
  const { solid } = rig(ctx, state);
  const level = state.blocks.length;
  const missed = state.failure === "NO_OVERLAP";
  const dir = state.axis === "x" ? Math.sign(src.xMilli + src.wMilli / 2 - top.xMilli - top.wMilli / 2) || 1 : Math.sign(src.zMilli + src.dMilli / 2 - top.zMilli - top.dMilli / 2) || 1;
  const t = elapsedMs / 1000;
  const landT = Math.min(t / .22, 1);
  const rise = 24 * (1 - landT * landT);
  const slide = missed ? 0 : Math.max(0, t - .3);
  const topple = missed ? 0 : Math.min(1, slide / .5);
  const gravity = missed ? t * t * 120 : Math.max(0, t - .55) ** 2 * 260;
  const shift = (missed ? Math.max(0, t - .22) * 0 : slide * slide * 90 + topple * 40) * dir * 1000;
  const block = { ...src, xMilli: src.xMilli + (state.axis === "x" ? shift : 0), zMilli: src.zMilli + (state.axis === "z" ? shift : 0) };
  const alpha = Math.max(0, 1 - Math.max(0, t - 1.2) / .7);
  ctx.save();
  if (t < .35) ctx.translate(Math.sin(t * 90) * (1 - t / .35) * 3, 0);
  solid(block, level, rise - gravity - topple * 4, alpha);
  ctx.restore();
  if (t < 1.3) {
    ctx.save(); ctx.globalAlpha = Math.min(1, t * 4) * Math.max(0, 1 - (t - .8) / .5);
    ctx.fillStyle = "#ffd5d5"; ctx.font = "bold 17px system-ui"; ctx.textAlign = "center";
    ctx.fillText(missed ? tx("stack.miss") : tx("stack.noSupport"), STACK_3D_CORE.width / 2, 108);
    ctx.restore();
  }
}
const finale = { durationMs: FALL_MS, render: fallFinale };
const hudLabel = (state: Stack3DState) => tx("stack.hud", { h: state.height, s: Math.floor(state.surfaceMilli2 / 1e8) });
const keys = { " ": "DROP", Enter: "DROP" } as const;
export default function Stack3D(props: GameRuntimeProps) {
  useI18n();
  return <CoreCanvasGame {...props} core={STACK_3D_CORE} name="Stack" render={render} failureFinale={finale} hideHudScore hudLabel={hudLabel} primaryAction="DROP" keys={keys} instruction={tx("stack.instruction")} />;
}
