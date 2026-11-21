import math
N=24
SPEC=["#9b6bff","#4f8dff","#3fd89a","#ff5d6c"]  # violet, blue, green, red: the atom's jump colours
def ring(rx,ry,rot,th=0.55):
    # pixel-perfect 1-cell ellipse: sample the curve, keep each cell once, drop L-shaped corner duplicates
    a=math.radians(rot); pts=[]
    for i in range(2000):
        t=2*math.pi*i/2000
        u,v=rx*math.cos(t),ry*math.sin(t)
        x=u*math.cos(a)-v*math.sin(a)+N/2; y=u*math.sin(a)+v*math.cos(a)+N/2
        c=(int(math.floor(x)),int(math.floor(y)))
        if not pts or pts[-1][0]!=c: pts.append((c,math.degrees(t)%360))
    if pts[0][0]==pts[-1][0]: pts.pop()
    keep=[]; n=len(pts)
    for i,(c,ang) in enumerate(pts):
        p,q=pts[i-1][0],pts[(i+1)%n][0]
        if abs(p[0]-q[0])==1 and abs(p[1]-q[1])==1 and (c[0] in (p[0],q[0])) and (c[1] in (p[1],q[1])): continue
        keep.append((c,ang))
    cells={}
    for c,ang in keep:
        cells[c]=ang
        if th>0.9: cells[(c[0],c[1]+1)]=ang
    return cells
def _old_ring(rx,ry,rot,th=0.55):
    cells={}
    a=math.radians(rot)
    for y in range(N):
        for x in range(N):
            px,py=x+0.5-N/2,y+0.5-N/2
            u= px*math.cos(a)+py*math.sin(a); v=-px*math.sin(a)+py*math.cos(a)
            d=math.hypot(u/rx,v/ry)
            g=math.hypot(u/rx**2,v/ry**2)/max(d,1e-6)
            if abs(d-1)/max(g,1e-6)<th:
                ang=(math.degrees(math.atan2(v/ry,u/rx))+360)%360
                cells[(x,y)]=ang
    return cells
def mark(size, bg=True, mono=None, corner=0.22, th=0.62):
    s=size/N
    out=[]
    if bg:
        out.append(f'<defs><radialGradient id="g" cx="50%" cy="46%" r="70%"><stop offset="0" stop-color="#1d1650"/><stop offset=".55" stop-color="#0d0b2a"/><stop offset="1" stop-color="#06060f"/></radialGradient>'
                   f'<radialGradient id="e" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#d9fbff" stop-opacity=".75"/><stop offset="1" stop-color="#7fe8ff" stop-opacity="0"/></radialGradient><radialGradient id="n" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf5a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf5a" stop-opacity="0"/></radialGradient></defs>')
        out.append(f'<rect width="{size}" height="{size}" rx="{size*corner}" fill="url(#g)"/>')
        for (x,y) in [(3,4),(19,3),(21,17),(4,19),(14,2),(2,12),(20,10),(9,21)]:
            out.append(f'<rect x="{x*s}" y="{y*s}" width="{s*.5}" height="{s*.5}" fill="#8d8fb8" opacity=".7"/>')
        out.append(f'<circle cx="{size/2}" cy="{size/2}" r="{s*5.5}" fill="url(#n)"/>')
    cells=_old_ring(9.6,4.3,-24,th)
    for (x,y),ang in cells.items():
        if 8.5<=x<=15.5 and 9<=y<=14.5: continue
        col= mono or SPEC[int(ang//90)%4]
        out.append(f'<rect x="{x*s}" y="{y*s}" width="{s*.86}" height="{s*.86}" fill="{col}"/>')
    # nucleus: chunky pixel cluster (gold + teal), like the welcome atom
    nuc={(10,10):"#ffd25e",(11,10):"#ffd25e",(12,10):"#62e3e0",(13,10):"#ffd25e",
         (10,11):"#62e3e0",(11,11):"#ffd25e",(12,11):"#ffd25e",(13,11):"#ffd25e",
         (10,12):"#ffd25e",(11,12):"#ffd25e",(12,12):"#62e3e0",(13,12):"#ffd25e",
         (11,13):"#62e3e0",(12,13):"#ffd25e",(9,11):"#ffd25e",(14,12):"#62e3e0"}
    for (x,y),c in nuc.items():
        out.append(f'<rect x="{x*s}" y="{y*s}" width="{s}" height="{s}" fill="{mono or c}"/>')
    # electron on the ring (upper right), with a halo
    ex,ey=19,6
    if not mono: out.append(f'<circle cx="{(ex+1)*s}" cy="{(ey+1)*s}" r="{s*2.2}" fill="url(#e)"/>')
    out.append(f'<rect x="{ex*s}" y="{ey*s}" width="{2*s}" height="{2*s}" fill="{mono or "#ffffff"}"/>')
    return "".join(out)
def svg(w,h,body,bg="none"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{"" if bg=="none" else f"<rect width=\"{w}\" height=\"{h}\" fill=\"{bg}\"/>"}{body}</svg>'
open("/tmp/logo/icon.svg","w").write(svg(512,512,mark(512)))
open("/tmp/logo/mono.svg","w").write(svg(96,96,mark(96,bg=False,mono="#ffffff",th=1.0)))
open("/tmp/logo/square.svg","w").write(svg(512,512,mark(512,corner=0)))
open("/tmp/logo/mono-badge.svg","w").write(svg(96,96,mark(96,bg=False,mono="#ffffff",th=1.0)))
# maskable (Android adaptive): full-bleed background, artwork scaled to 80 % so it stays inside the safe circle
_m=mark(512,corner=0); _bg='<rect width="512" height="512" rx="0" fill="url(#g)"/>'
_defs,_rest=_m.split(_bg)
open("/tmp/logo/maskable.svg","w").write(svg(512,512,_defs+_bg+'<g transform="translate(51.2 51.2) scale(.8)">'+_rest+'</g>'))
