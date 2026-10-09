"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { STACK_3D_CORE, type Stack3DState, type StackSolid } from "@/lib/verified/precisionStackCore.v3";
import CoreCanvasGame from "./CoreCanvasGame";

function render(ctx: CanvasRenderingContext2D, state: Stack3DState) {
  const W = STACK_3D_CORE.width, H = STACK_3D_CORE.height;
  drawSpaceBackdrop(ctx, W, H, 0, state.tick);
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();
  const placementAge = state.lastPlacement?.landed ? Math.min(1,(state.tick-state.lastPlacement.tick)/36) : 1;
  const follow = placementAge*placementAge*(3-2*placementAge);
  const cameraNow = Math.max(0,state.height-8)*23;
  const cameraBefore = Math.max(0,state.height-9)*23;
  const baseY = 498 + cameraBefore + (cameraNow-cameraBefore)*follow;
  const project = (x: number, z: number, level: number, rise = 0) => ({ x: W / 2 + (x - z) * .50, y: baseY + (x + z) * .27 - level * 23 - rise });
  const polygon = (points: {x:number;y:number}[], fill: string, stroke = "rgba(220,255,255,.18)") => {
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();
  };
  const solid = (block: StackSolid, level: number, rise = 0, alpha = 1) => {
    const x = block.xMilli/1000, z = block.zMilli/1000, w = block.wMilli/1000, d = block.dMilli/1000;
    const p = [project(x,z,level,rise),project(x+w,z,level,rise),project(x+w,z+d,level,rise),project(x,z+d,level,rise)];
    const hue=165+(level*17)%135;
    ctx.save();ctx.globalAlpha=alpha;
    polygon([p[3],p[2],{x:p[2].x,y:p[2].y+21},{x:p[3].x,y:p[3].y+21}],`hsl(${hue},55%,34%)`);
    polygon([p[1],p[2],{x:p[2].x,y:p[2].y+21},{x:p[1].x,y:p[1].y+21}],`hsl(${hue},62%,44%)`);
    polygon(p,`hsl(${hue},72%,${level===state.blocks.length?70:61}%)`);
    ctx.restore();
  };
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
  if(state.phase==="moving"){
    solid(state.moving,state.blocks.length,24,state.status==="failed"?.45:1);
  }
  const last=state.lastPlacement;
  if(last?.landed&&state.tick-last.tick<75){
    const age=state.tick-last.tick;
    const src=last.source,land=last.landed;
    const cutX=src.wMilli-land.wMilli,cutZ=src.dMilli-land.dMilli;
    if(cutX>0){const piece={...src,wMilli:cutX,xMilli:src.xMilli<land.xMilli?src.xMilli:land.xMilli+land.wMilli};solid(piece,state.height, -age*age*.018,Math.max(0,1-age/75));}
    if(cutZ>0){const piece={...src,dMilli:cutZ,zMilli:src.zMilli<land.zMilli?src.zMilli:land.zMilli+land.dMilli};solid(piece,state.height,-age*age*.018,Math.max(0,1-age/75));}
    ctx.fillStyle=last.perfect?"#baffdc":"#ddefff";ctx.font="bold 16px system-ui";ctx.textAlign="center";ctx.fillText(last.perfect?`PERFECTO ×${state.combo}`:`+${last.scoreDelta}`,W/2,108);ctx.textAlign="left";
  }
  ctx.save();ctx.translate(110,72);ctx.rotate(state.axis==="x"?Math.PI/6:-Math.PI/6);
  ctx.strokeStyle="#a8dcea";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);
  ctx.moveTo(-5,-4);ctx.lineTo(-10,0);ctx.lineTo(-5,4);ctx.moveTo(5,-4);ctx.lineTo(10,0);ctx.lineTo(5,4);ctx.stroke();ctx.restore();
  ctx.fillStyle="#a8dcea";ctx.font="bold 12px system-ui";ctx.textAlign="center";ctx.fillText(state.axis==="x"?"LONGITUDINAL":"TRANSVERSAL",W/2,76);ctx.textAlign="left";
  ctx.restore();
}
const keys = { " ": "DROP", Enter: "DROP" } as const;
export default function Stack3D(props: GameRuntimeProps) {
  return <CoreCanvasGame {...props} core={STACK_3D_CORE} name="Stack" render={render} primaryAction="DROP" keys={keys} instruction="Toca al alinear las caras. La siguiente pieza cruza por el otro eje." />;
}
