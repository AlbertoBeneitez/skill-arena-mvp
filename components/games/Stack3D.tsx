"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { STACK_3D_CORE, type Stack3DState, type StackSolid } from "@/lib/verified/precisionStackCore.v3";
import CoreCanvasGame from "./CoreCanvasGame";

function render(ctx: CanvasRenderingContext2D, state: Stack3DState) {
  const W = STACK_3D_CORE.width, H = STACK_3D_CORE.height;
  drawSpaceBackdrop(ctx, W, H, 0, state.tick);
  const baseY = 495 + Math.max(0, state.height - 11) * 20;
  const project = (x: number, z: number, level: number, rise = 0) => ({ x: W / 2 + (x - z) * .48, y: baseY + (x + z) * .24 - level * 20 - rise });
  const polygon = (points: {x:number;y:number}[], fill: string, stroke = "rgba(220,255,255,.18)") => {
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();
  };
  const solid = (block: StackSolid, level: number, rise = 0, alpha = 1) => {
    const x = block.xMilli/1000, z = block.zMilli/1000, w = block.wMilli/1000, d = block.dMilli/1000;
    const p = [project(x,z,level,rise),project(x+w,z,level,rise),project(x+w,z+d,level,rise),project(x,z+d,level,rise)];
    const hue=165+(level*17)%135;
    ctx.save();ctx.globalAlpha=alpha;
    polygon([p[3],p[2],{x:p[2].x,y:p[2].y+18},{x:p[3].x,y:p[3].y+18}],`hsl(${hue},55%,34%)`);
    polygon([p[1],p[2],{x:p[2].x,y:p[2].y+18},{x:p[1].x,y:p[1].y+18}],`hsl(${hue},62%,44%)`);
    polygon(p,`hsl(${hue},72%,${level===state.blocks.length?70:61}%)`);
    ctx.restore();
  };
  polygon([project(-165,-165,0),project(165,-165,0),project(165,165,0),project(-165,165,0)],"#142d43","#44798e");
  for(let n=-120;n<=120;n+=40){
    ctx.strokeStyle="rgba(109,205,226,.14)";ctx.beginPath();let a=project(n,-150,0),b=project(n,150,0);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  state.blocks.forEach((block,index)=>{
    if(index<state.blocks.length-27)return;
    const rise=index===state.blocks.length-1&&state.phase==="settling"?22*(state.settleRemaining/24)**2:0;
    solid(block,index,rise);
  });
  const top=state.blocks[state.blocks.length-1];
  if(state.phase==="moving"){
    const x=(top.xMilli+top.wMilli/2)/1000,z=(top.zMilli+top.dMilli/2)/1000;
    const a=state.axis==="x"?project(x-state.sweepMilli/1000,z,state.blocks.length,24):project(x,z-state.sweepMilli/1000,state.blocks.length,24);
    const b=state.axis==="x"?project(x+state.sweepMilli/1000,z,state.blocks.length,24):project(x,z+state.sweepMilli/1000,state.blocks.length,24);
    ctx.save();ctx.setLineDash([5,7]);ctx.strokeStyle="rgba(193,240,255,.45)";ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
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
  ctx.fillStyle="#a8dcea";ctx.font="bold 12px system-ui";ctx.textAlign="center";ctx.fillText(state.axis==="x"?"EJE X":"EJE Z",W/2,76);ctx.textAlign="left";
}
const keys = { " ": "DROP", Enter: "DROP" } as const;
export default function Stack3D(props: GameRuntimeProps) {
  return <CoreCanvasGame {...props} core={STACK_3D_CORE} name="Stack" render={render} primaryAction="DROP" keys={keys} instruction="Toca para acoplar. Alterna los ejes X y Z; conserva la superficie." />;
}
