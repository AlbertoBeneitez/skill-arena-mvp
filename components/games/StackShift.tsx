"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type Cell = [number, number];
type Piece = { cells: Cell[]; color: string };

const COLS = 8;
const ROWS = 16;
const W = 320;
const H = 576;
const CELL = W / COLS;
const DT = 1 / 120;

const SHAPES: Piece[] = [
  { cells: [[0,0],[1,0],[2,0]], color: "#5fd4e8" },
  { cells: [[0,0],[0,1],[1,1]], color: "#f5ba5b" },
  { cells: [[0,0],[1,0],[1,1],[2,1]], color: "#73d69d" },
  { cells: [[0,0],[1,0],[0,1],[1,1]], color: "#a986e8" },
  { cells: [[1,0],[0,1],[1,1],[2,1],[1,2]], color: "#ef7d94" },
  { cells: [[0,0],[0,1],[0,2],[1,2]], color: "#6f96ed" },
];

function rotate(cells: Cell[]): Cell[] {
  const rotated = cells.map(([x, y]) => [-y, x] as Cell);
  const minX = Math.min(...rotated.map(([x]) => x));
  const minY = Math.min(...rotated.map(([, y]) => y));
  return rotated.map(([x, y]) => [x - minX, y - minY]);
}

function pieceSequence(seed: string) {
  const rng = createRng(seed);
  return Array.from({ length: 500 }, () => rng.nextInt(SHAPES.length));
}

export default function StackShift({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const seq = useMemo(() => pieceSequence(seed), [seed]);

  const stateRef = useRef({
    board: Array.from({ length: ROWS }, () => Array(COLS).fill("")) as string[][],
    piece: SHAPES[0],
    cells: SHAPES[0].cells as Cell[],
    x: 2,
    y: -1,
    sequenceIndex: 0,
    score: 0,
    lines: 0,
    running: false,
    last: 0,
    acc: 0,
    fallAccumulator: 0,
    fallInterval: 0.58,
  });

  const collides = useCallback((cells: Cell[], x: number, y: number) => {
    const s = stateRef.current;
    return cells.some(([cx, cy]) => {
      const xx = x + cx;
      const yy = y + cy;
      return (
        xx < 0 ||
        xx >= COLS ||
        yy >= ROWS ||
        (yy >= 0 && Boolean(s.board[yy][xx]))
      );
    });
  }, []);

  const finish = useCallback((won: boolean) => {
    const s = stateRef.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    gameTone(won ? "win" : "bad");
    haptic(won ? [18,28,45] : 28);
    onFinish({
      won,
      score: s.score,
      timeMs: Math.round(performance.now() - startRef.current),
    });
  }, [onFinish]);

  const spawn = useCallback(() => {
    const s = stateRef.current;
    const piece = SHAPES[seq[s.sequenceIndex % seq.length]];
    s.sequenceIndex += 1;
    s.piece = piece;
    s.cells = piece.cells.map((cell) => [...cell] as Cell);
    const width = Math.max(...s.cells.map(([x]) => x)) + 1;
    s.x = Math.floor((COLS - width) / 2);
    s.y = -1;

    if (collides(s.cells, s.x, s.y)) finish(false);
  }, [collides, finish, seq]);

  const lock = useCallback(() => {
    const s = stateRef.current;

    for (const [cx, cy] of s.cells) {
      const xx = s.x + cx;
      const yy = s.y + cy;
      if (yy < 0) {
        finish(false);
        return;
      }
      s.board[yy][xx] = s.piece.color;
    }

    const remaining = s.board.filter((row) => !row.every(Boolean));
    const cleared = ROWS - remaining.length;

    if (cleared > 0) {
      while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(""));
      s.board = remaining;
      s.lines += cleared;
      s.score += [0, 900, 2200, 3900, 6200][Math.min(4, cleared)] ?? 6200;
      gameTone("good");
      haptic([4,18,4]);
      s.fallInterval = Math.max(0.18, 0.58 - s.lines * 0.018);
    } else {
      s.score += 120;
      gameTone("tap");
    }

    if (s.score >= targetScore) {
      finish(true);
      return;
    }
    spawn();
  }, [finish, spawn, targetScore]);

  const stepDown = useCallback(() => {
    const s = stateRef.current;
    if (!collides(s.cells, s.x, s.y + 1)) {
      s.y += 1;
      return;
    }
    lock();
  }, [collides, lock]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.fillStyle = "#10182d";
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = "rgba(255,255,255,.05)";

    for (let x=0;x<=COLS;x+=1) {
      ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,H);ctx.stroke();
    }
    for (let y=0;y<=ROWS;y+=1) {
      ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(W,y*CELL);ctx.stroke();
    }

    for (let y=0;y<ROWS;y+=1) {
      for (let x=0;x<COLS;x+=1) {
        const color=s.board[y][x];
        if (!color) continue;
        ctx.fillStyle=color;
        ctx.fillRect(x*CELL+2,y*CELL+2,CELL-4,CELL-4);
      }
    }

    ctx.fillStyle=s.piece.color;
    for (const [cx,cy] of s.cells) {
      const yy=s.y+cy;
      if (yy<0) continue;
      ctx.fillRect((s.x+cx)*CELL+2,yy*CELL+2,CELL-4,CELL-4);
    }
  }, []);

  const loop = useCallback((now:number)=>{
    const s=stateRef.current;
    if(!s.running)return;
    if(!s.last)s.last=now;
    s.acc+=Math.min(.05,(now-s.last)/1000);
    s.last=now;
    while(s.acc>=DT&&s.running){
      s.fallAccumulator+=DT;
      if(s.fallAccumulator>=s.fallInterval){
        s.fallAccumulator=0;
        stepDown();
      }
      s.acc-=DT;
    }
    draw();
    if(s.running)rafRef.current=requestAnimationFrame(loop);
  },[draw,stepDown]);

  useEffect(()=>{
    if(!active)return;
    stateRef.current={
      board:Array.from({length:ROWS},()=>Array(COLS).fill("")),
      piece:SHAPES[0],
      cells:SHAPES[0].cells.map((cell)=>[...cell] as Cell),
      x:2,y:-1,sequenceIndex:0,score:0,lines:0,running:true,last:0,acc:0,
      fallAccumulator:0,fallInterval:.58,
    };
    startRef.current=performance.now();
    spawn();
    draw();
    rafRef.current=requestAnimationFrame(loop);
    return()=>{stateRef.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};
  },[active,draw,loop,spawn]);

  function move(dx:number){
    const s=stateRef.current;
    if(!s.running)return;
    if(!collides(s.cells,s.x+dx,s.y)){s.x+=dx;haptic(2);}
  }
  function spin(){
    const s=stateRef.current;
    if(!s.running)return;
    const rotated=rotate(s.cells);
    for(const kick of [0,-1,1,-2,2]){
      if(!collides(rotated,s.x+kick,s.y)){s.cells=rotated;s.x+=kick;gameTone("tap");haptic(3);return;}
    }
  }
  function hardDrop(){
    const s=stateRef.current;
    if(!s.running)return;
    let moved=0;
    while(!collides(s.cells,s.x,s.y+1)){s.y+=1;moved+=1;}
    s.score+=moved*6;
    lock();
  }

  return (
    <div className="detGameSurface stackForgeGame">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas deterministicCanvas" aria-label="Stack Shift" />
      <div className="stackForgeControls">
        <button type="button" onClick={()=>move(-1)}>←</button>
        <button type="button" onClick={spin}>↻</button>
        <button type="button" onClick={()=>move(1)}>→</button>
        <button type="button" className="drop" onClick={hardDrop}>↓</button>
      </div>
    </div>
  );
}
