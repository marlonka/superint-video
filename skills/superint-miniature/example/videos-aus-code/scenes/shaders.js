// Alle Shader des Films. Licht, Holz, Papier, Filmkorn: alles steht hier als Text.
export const MAXL = 8, MAXR = 24;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler2DArray;
precision highp sampler2DShadow;
precision highp samplerCube;
`;

const NOISE = `
float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float h31(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float vn3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm2(vec2 p){float a=0.,w=.5;for(int i=0;i<5;i++){a+=w*vn2(p);p=p*2.03+vec2(17.1,9.2);w*=.5;}return a;}
float fbm3(vec3 p){float a=0.,w=.5;for(int i=0;i<4;i++){a+=w*vn3(p);p=p*2.03+vec3(17.1,9.2,4.7);w*=.5;}return a;}
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
`;

// ---------------------------------------------------------------- Ecken
export const VS = (inst) => HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aMat;
layout(location=5) in vec4 aAux;
${inst ? `
layout(location=6) in vec4 iM0;
layout(location=7) in vec4 iM1;
layout(location=8) in vec4 iM2;
layout(location=9) in vec4 iM3;
layout(location=10) in vec4 iA; // Biegung: k, Anker, Welle, Phase
layout(location=11) in vec4 iB; // uv: su, sv, ou, ov
layout(location=12) in vec4 iC; // Textur, Raum, Helligkeit, Deckkraft
` : ''}
uniform mat4 uVP;
uniform mat4 uM;
uniform float uRoomOv;
out vec3 vW; out vec3 vN; out vec2 vUv; out vec3 vL;
out vec4 vCol; flat out vec4 vMat; flat out vec4 vAux; out float vAlpha;
void main(){
  vec3 p=aPos, n=aNor; vec2 uv=aUv; vec4 mat=aMat, aux=aAux; vec4 col=aCol; vAlpha=1.;
  ${inst ? `
  // Papier, das sich biegt: ein Blatt ist ein Stueck Zylinder.
  float k=iA.x; if(abs(k)>1e-4){float x=p.x-iA.y;float th=k*x;float sn=sin(th),cs=cos(th);
    float nx=sn/k,ny=(1.-cs)/k; vec3 q=vec3(iA.y+nx,p.y+ny,p.z);
    n=vec3(-sn*n.y+cs*n.x,cs*n.y+sn*n.x,n.z); p=q;}
  if(iA.z!=0.){float w=sin(p.x*7.+p.z*5.+iA.w)*iA.z;p.y+=w;n=normalize(n+vec3(-cos(p.x*7.+p.z*5.+iA.w)*iA.z*7.,0,-cos(p.x*7.+p.z*5.+iA.w)*iA.z*5.));}
  uv=uv*iB.xy+iB.zw;
  if(iC.x>=0.) mat.w=iC.x/255.;
  if(iC.y>=0.) aux.x=iC.y/255.;
  col.rgb*=iC.z; vAlpha=iC.w;
  mat4 MM=mat4(iM0,iM1,iM2,iM3);
  ` : `mat4 MM=uM; if(uRoomOv>=0.) aux.x=uRoomOv/255.;`}
  vec4 w=MM*vec4(p,1.);
  vW=w.xyz; vN=mat3(MM)*n; vUv=uv; vL=p;
  vCol=vec4(col.rgb*col.rgb,col.a); vMat=mat; vAux=aux;
  gl_Position=uVP*w;
}`;

export const VS_DEPTH = (inst) => HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
layout(location=4) in vec4 aMat;
layout(location=5) in vec4 aAux;
${inst ? `
layout(location=6) in vec4 iM0;
layout(location=7) in vec4 iM1;
layout(location=8) in vec4 iM2;
layout(location=9) in vec4 iM3;
layout(location=10) in vec4 iA;
layout(location=12) in vec4 iC;
` : ''}
uniform mat4 uVP; uniform mat4 uM; uniform float uNoShell;
out float vAlpha; flat out float vGlass;
void main(){
  vec3 p=aPos; vAlpha=1.;
  { float mm=aMat.z*255.; vGlass=max(step(abs(mm-9.),.5),step(abs(mm-24.),.5)); }
  ${inst ? `
  float k=iA.x; if(abs(k)>1e-4){float x=p.x-iA.y;float th=k*x;p=vec3(iA.y+sin(th)/k,p.y+(1.-cos(th))/k,p.z);}
  if(iA.z!=0.){p.y+=sin(p.x*7.+p.z*5.+iA.w)*iA.z;}
  vAlpha=iC.w;
  gl_Position=uVP*mat4(iM0,iM1,iM2,iM3)*vec4(p,1.);
  ` : `gl_Position=uVP*uM*vec4(p,1.);`}
  // Fuer die Verschattung zaehlen nur Dinge: Waende, Decke und Boden liefern ja das Licht.
  if(uNoShell>.5 && (int(aAux.w*255.+.5)&33)!=0) gl_Position=vec4(2.,2.,2.,1.);
}`;
export const FS_DEPTH = HEAD + NOISE + `
in float vAlpha; flat in float vGlass; uniform float uSub;
void main(){ if(vGlass>.5) discard; if(vAlpha<.999 && vAlpha<ign(gl_FragCoord.xy+5.588238*uSub)) discard; }`;

// ---------------------------------------------------------------- Oberflaechen und Licht
export const FS_MAIN = HEAD + NOISE + `
in vec3 vW; in vec3 vN; in vec2 vUv; in vec3 vL; in vec4 vCol; flat in vec4 vMat; flat in vec4 vAux; in float vAlpha;
out vec4 fragColor;
uniform vec3 uEye; uniform float uSub; uniform float uT;
uniform int uNL;
uniform vec4 uLPos[${MAXL}];   // xyz, Raum
uniform vec4 uLDir[${MAXL}];   // xyz, cos aussen
uniform vec4 uLCol[${MAXL}];   // rgb, cos innen
uniform vec4 uLSh[${MAXL}];    // Kachel x, y, Bias, Reichweite
uniform mat4 uLVP[${MAXL}];
uniform sampler2DShadow uShadow;
uniform sampler2DArray uTexA; uniform sampler2DArray uTexB;
uniform sampler2D uLive0; uniform sampler2D uLive1; uniform sampler2D uLive2; uniform sampler2D uLive3;
uniform vec4 uRoomUp[${MAXR}];  // Umgebungslicht von oben, Leistung
uniform vec4 uRoomDn[${MAXR}];  // Umgebungslicht von unten, Glanz
uniform vec4 uRoomMin[${MAXR}]; uniform vec4 uRoomMax[${MAXR}];
uniform vec4 uRoomFill[${MAXR}]; // sanftes Licht von vorn
uniform float uClipY; uniform float uRefl; uniform vec2 uView;
// Verschattung: Je Teilbild kommt das Umgebungslicht aus einer anderen Richtung, der Mittelwert ist echte Naehe.
uniform sampler2DShadow uAO; uniform mat4 uAOVP; uniform vec3 uAODir; uniform float uAOOn; uniform float uAOBias;
// Die Sonde: So sieht der Raum aus, in dem die Kamera steht. Darin spiegelt sich alles, was glaenzt.
uniform samplerCube uProbe; uniform vec3 uProbePos; uniform vec4 uProbeMin; uniform vec4 uProbeMax; uniform float uProbeOn;
// Eine spiegelnde Ebene, zum Beispiel die lackierte Tischplatte.
uniform float uPlaneY; uniform float uPlaneOn; uniform float uPlaneSoft;
uniform vec4 uHero; uniform vec3 uHeroA; uniform vec3 uHeroB; uniform float uMaxCol;

struct S { vec3 a; float r; float m; vec3 N; float alpha; vec3 e; float tr; float sheen; };
vec3 gDx, gDy;

// Hoehe zu Normale, nach Mikkelsen. So bekommt jede Formel ein Relief.
vec3 bump(vec3 N, float h, float k){
  vec3 r1=cross(gDy,N), r2=cross(N,gDx); float det=dot(gDx,r1);
  vec3 g=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);
  return normalize(abs(det)*N-k*g);
}

// Das Holz: eine Formel. Bretter aus einem Stamm: Jedes hat seine eigene Mitte, darum stehen die Jahresringe auf der Flaeche als Bogen.
// Die Faser laeuft entlang x. Kein Relief: Geschliffenes, lackiertes Holz ist glatt, das Bild kommt aus der Farbe.
void matWood(inout S s, vec3 p, float axis, float seedK, float planks){
  vec3 q = axis<.5 ? p : axis<1.5 ? p.yzx : p.zxy;
  const float BW=.205;
  vec2 yz=q.yz/BW; vec2 id=floor(yz); vec2 f=(fract(yz)-.5)*BW;
  float hA=h21(id+seedK*9.13), hB=h21(id.yx+3.7+seedK*5.31), hC=h21(id*1.7+11.+seedK*2.);
  float px=q.x+hA*41.;
  // Wo der Kern des Stamms liegt: knapp unter der Flaeche, und er wandert langsam.
  vec2 c=vec2(f.x-(.06+.1*hB)-.05*(vn2(vec2(px*1.15,hA*53.))-.5)-.012*(vn2(vec2(px*4.1,hC*31.))-.5),
              f.y+(hC-.5)*.09+.06*(vn2(vec2(px*.8,hB*47.))-.5));
  if(planks>.5){ c.x+=.022*(vn2(vec2(px*2.3,hB*19.+f.y*4.))-.5); }
  float d=length(c)+(planks>.5?.0115:.0052)*(fbm2(vec2(px*2.4,f.y*30.+hA*9.))-.5)+.0007*(vn2(vec2(px*16.,f.y*170.))-.5);
  float rr=d*(planks>.5?122.:148.); float r0=fract(rr), rid=floor(rr);
  // Fruehholz hell und weit, Spaetholz dunkel, zur Grenze hin hart.
  float late=pow(r0,2.6)*(1.-smoothstep(.975,1.,r0));
  float ringTone=h21(vec2(rid,hA*7.+3.));
  float tone=vn2(vec2(px*.35,f.y*11.+hB*20.));
  float streak=vn2(vec2(px*1.6,f.y*58.+hA*40.));
  // Lange, feine Fasern. Dazwischen die Poren als kurze dunkle Striche.
  float fib=vn3(vec3(px*11.,q.y*1250.,q.z*1250.));
  float fib2=vn3(vec3(px*3.5,q.y*360.,q.z*360.));
  float pore=smoothstep(.70,.86,vn3(vec3(px*165.,q.y*4600.,q.z*4600.)));
  float pore2=smoothstep(.74,.9,vn3(vec3(px*60.+7.,q.y*2300.+3.,q.z*2300.)));
  vec3 lightW=s.a*1.32, darkW=s.a*.44;
  vec3 col=mix(lightW,darkW,late*(.34+.42*ringTone));
  col*=mix(.8,1.16,tone);
  col*=mix(vec3(1.09,.99,.9),vec3(.9,.98,1.08),streak);
  col*=.9+.2*fib2;
  col*=.955+.09*fib;
  col*=1.-(.44*pore+.28*pore2)*(.45+.55*late);
  // Stoesse zwischen den Brettern, kaum sichtbar.
  if(planks>.5){
    float e=min(BW*.5-abs(f.y),1.); col*=mix(.42,1.,smoothstep(.0003,.0012,e));
    col*=mix(.88,1.1,hC);
  }
  s.a=col;
  s.r=clamp(s.r+(tone-.5)*.07+late*.03,.04,1.);
}
// Fischgraet-Parkett: Bretter, jedes mit eigener Maserung.
void matParquet(inout S s, vec3 p){
  vec2 q=p.xz*vec2(1.,1.)*5.2; vec2 r=vec2(q.x+q.y,q.x-q.y)*.7071;
  float L=4.; vec2 c=floor(r*vec2(1.,1./L));
  float row=mod(floor(r.x),2.); vec2 uv=r; if(row>.5) uv=r.yx;
  vec2 cell=vec2(floor(uv.x),floor(uv.y/L+.5*mod(floor(uv.x),2.)));
  vec2 f=vec2(fract(uv.x),fract(uv.y/L+.5*mod(floor(uv.x),2.)));
  float id=h21(cell+row*17.);
  float gap=smoothstep(.0,.03,f.x)*smoothstep(1.,.97,f.x)*smoothstep(0.,.012,f.y)*smoothstep(1.,.988,f.y);
  float gr=vn2(vec2(f.x*26.+id*40.,f.y*2.5+id*9.));
  float gr2=vn2(vec2(f.x*90.+id*70.,f.y*7.));
  s.a*=mix(.72,1.2,id)*(.78+.38*gr)*(.9+.2*gr2);
  s.a*=mix(.25,1.,gap);
  s.r=mix(.62,s.r,gap)+ (gr-.5)*.1;
  s.N=bump(s.N,gap*.002+gr*.0005,1.);
}
void matChecker(inout S s, vec3 p){
  vec2 q=p.xz*2.6; vec2 c=floor(q); float ch=mod(c.x+c.y,2.); vec2 f=fract(q);
  float gap=smoothstep(0.,.012,f.x)*smoothstep(1.,.988,f.x)*smoothstep(0.,.012,f.y)*smoothstep(1.,.988,f.y);
  float v=fbm2(q*1.7+h21(c)*20.); float vein=1.-smoothstep(.0,.05,abs(v-.5));
  vec3 w=vec3(.82,.79,.72), b=vec3(.022,.024,.028);
  s.a=mix(w*(1.-vein*.2),b*(1.+vein*1.9),ch);
  s.a*=mix(.3,1.,gap); s.r=mix(.14,.1,ch)+vein*.1;
}
void matFoam(inout S s, vec3 p){
  vec2 q=vec2(p.x,p.y)*7.;
  vec2 f=fract(q)-.5; float h=1.-2.*max(abs(f.x),abs(f.y));
  s.a*=mix(.34,1.15,smoothstep(0.,.9,h));
  s.N=normalize(s.N+vec3(sign(f.x)*step(abs(f.y),abs(f.x)),sign(f.y)*step(abs(f.x),abs(f.y)),0.)*.9);
  s.r=.95;
}
void matBrushed(inout S s, vec3 p, float axis){
  vec3 q=axis<.5?p:axis<1.5?p.yzx:p.zxy;
  float n=vn3(vec3(q.x*6.,q.y*420.,q.z*420.));
  s.r=clamp(s.r+(n-.5)*.16,.05,1.);
  s.a*=.92+.16*n;
  s.N=bump(s.N,n*.00022,1.);
}
void matPlaster(inout S s, vec3 p){
  float n=fbm3(p*vec3(5.,5.,5.)); float m=vn3(p*vec3(55.));
  s.a*=.90+.20*n; s.N=bump(s.N,n*.004+m*.0006,1.); s.r=clamp(s.r+(n-.5)*.15,0.,1.);
}
// Tapeten. Drei Muster, jedes eine Zeile Geometrie.
float scallop(vec2 p){ // Faecher wie in einem Kino von 1930
  vec2 q=p; float row=floor(q.y); q.x+=mod(row,2.)*.5; vec2 f=fract(q)-vec2(.5,0.);
  float best=0.;
  float d0=length(f); float d1=length(f-vec2(0.,1.));
  float ang=atan(f.x,f.y);
  float fan=.5+.5*cos(ang*18.);
  float ring=smoothstep(.02,.0,abs(d0-.5))+smoothstep(.02,.0,abs(d0-.34))*.6+smoothstep(.015,.0,abs(d0-.2))*.6;
  float top=step(d0,.5);
  return clamp(ring+top*fan*.22*smoothstep(.2,.3,d0)*smoothstep(.5,.34,d0),0.,1.);
}
void matWallA(inout S s, vec3 p){ float m=scallop(vec2(p.x,p.y)*2.6); s.a=mix(s.a,s.a*1.5+.015,m*.75); s.r=mix(s.r,.28,m); float n=fbm3(p*3.); s.a*=.92+.16*n; }
void matWallB(inout S s, vec3 p){ // Streifen
  float x=fract(p.x*3.6); float m=smoothstep(.46,.48,x)*smoothstep(.98,.96,x);
  float l=smoothstep(.02,.0,abs(x-.47))+smoothstep(.02,.0,abs(x-.97)); s.a*=mix(.8,1.12,m); s.a=mix(s.a,s.a*1.8,l*.5); float n=vn2(p.xy*60.); s.a*=.96+.08*n; }
void matWallC(inout S s, vec3 p){ // Rauten
  vec2 q=vec2(p.x,p.y)*3.2; vec2 r=vec2(q.x+q.y,q.x-q.y); vec2 f=fract(r)-.5;
  float d=max(abs(f.x),abs(f.y)); float m=smoothstep(.47,.49,d); float dot1=smoothstep(.09,.07,length(f));
  s.a=mix(s.a,s.a*1.6+.01,m*.55+dot1*.7); s.r=mix(s.r,.3,m+dot1); }
void matFabric(inout S s, vec3 p){ vec2 q=vec2(p.x+p.z,p.y+p.z*.3)*260.; float w=sin(q.x)*sin(q.y)*.5+.5; float n=vn2(q*.05); s.a*=.78+.3*w+.1*n; s.N=bump(s.N,w*.0004,1.); s.r=.95; s.sheen=.25; }
void matVelvet(inout S s, vec3 p){ float n=fbm3(p*vec3(9.,9.,9.)); s.a*=.72+.5*n; s.sheen=1.; s.r=.86; }
void matLeather(inout S s, vec3 p){ float m=vn3(p*420.), n=vn3(p*1500.), big=fbm3(p*vec3(16.)); s.a*=.84+.3*big+.05*m; s.N=bump(s.N,m*.00007+n*.00002,1.); s.r=clamp(s.r+(big-.5)*.1+(m-.5)*.05,0.,1.); }
// Der Buchblock von aussen: Tausend Blattkanten.
void matPages(inout S s, vec3 p, float axis){ vec3 q=axis<.5?p:axis<1.5?p.yzx:p.zxy; float l=vn2(vec2(q.x*3100.,q.z*6.))*.55+vn2(vec2(q.x*1100.,q.z*3.))*.45; s.a*=.72+.5*l; s.r=.92; }
// Bilder aus dem Inneren der Welt sind schon entwickelt. Damit sie beim zweiten Mal gleich aussehen, rechnen wir Filmkurve und Saettigung zurueck.
vec3 unfilm(vec3 y){ float l0=dot(y,vec3(.2126,.7152,.0722)); y=mix(vec3(l0),y,1./1.06); y=clamp(y,0.,.985); const float A=2.51,B=.03,C=2.43,D=.59,E=.14; vec3 a=A-C*y,b=B-D*y,c=-E*y; return (-b+sqrt(max(b*b-4.*a*c,vec3(0.))))/(2.*a)/.82; }
void matPaper(inout S s, vec3 p){ float n=vn3(p*vec3(900.)); float f=vn3(p*vec3(240.)); s.a*=.965+.05*n; s.N=bump(s.N,f*.00025+n*.00012,1.); s.r=.82; s.tr=.45; }
void matPoche(inout S s, vec3 p){
  float d=fract((p.x+p.y)*5.); float l=smoothstep(.06,.0,d)+smoothstep(.94,1.,d);
  s.a=mix(vec3(.02,.021,.027),vec3(.11,.115,.14),l*.8); s.r=.92;
}
void matRug(inout S s, vec3 p){
  vec2 q=p.xz; float n=vn2(q*140.)*.5+vn2(q*300.)*.5;
  s.a*=.72+.5*n; s.r=.98; s.N=bump(s.N,n*.002,1.);
}
void matStreet(inout S s, vec3 p){
  vec2 q=p.xz*3.; vec2 c=floor(vec2(q.x+.5*mod(floor(q.y),2.),q.y)); float id=h21(c);
  vec2 f=fract(vec2(q.x+.5*mod(floor(q.y),2.),q.y));
  float gap=smoothstep(0.,.05,f.x)*smoothstep(1.,.95,f.x)*smoothstep(0.,.05,f.y)*smoothstep(1.,.95,f.y);
  float wet=smoothstep(.35,.62,fbm2(p.xz*.8));
  s.a=vec3(.018,.018,.022)*mix(.6,1.4,id)*mix(.35,1.,gap);
  s.r=mix(.5,.09,wet*gap); s.N=bump(s.N,gap*.006+vn2(q*9.)*.003,1.);
}
void matBrick(inout S s, vec3 p){
  vec2 q=vec2(p.x*4.,p.y*9.); float row=floor(q.y); q.x+=mod(row,2.)*.5; vec2 c=floor(q),f=fract(q);
  float gap=smoothstep(0.,.05,f.x)*smoothstep(1.,.95,f.x)*smoothstep(0.,.09,f.y)*smoothstep(1.,.91,f.y);
  float id=h21(c); s.a=mix(s.a*.3,s.a*mix(.7,1.25,id)*(.85+.3*vn2(q*7.)),gap); s.r=.9; s.N=bump(s.N,gap*.008,1.);
}
void matSky(inout S s, vec3 p){
  // Nachthimmel ueber einer fernen Stadt. Die Stadt besteht aus zwei Reihen Umrissen und ein paar erleuchteten Fenstern.
  float h=smoothstep(-2.,52.,p.y);
  vec3 c=mix(vec3(.040,.054,.098),vec3(.005,.007,.018),h);
  float cl=fbm2(p.xy*vec2(.011,.028)+vec2(uT*.0025,1.7));
  c+=vec3(.015,.019,.034)*smoothstep(.36,.82,cl)*(1.-h*.4);
  vec2 mp=vec2(-30.,41.); float md=length(p.xy-mp);
  float mk=smoothstep(3.3,3.05,md);
  if(mk>0.){
    vec2 mu=(p.xy-mp)/3.2;
    float limb=sqrt(max(0.,1.-dot(mu,mu)));
    float seas=smoothstep(.41,.6,fbm2(mu*1.9+vec2(4.3,1.2)));
    float fine=fbm2(mu*7.+vec2(1.7,9.1));
    c+=vec3(.9,.95,1.05)*mix(1.,.46,seas)*(.78+.44*fine)*(.72+.28*limb)*mk*1.02;
  }
  c+=vec3(.05,.066,.11)*exp(-md*.085);
  s.a=vec3(0.);
  for(int k=0;k<2;k++){
    float fk=float(k), sc=mix(.085,.14,fk), base=mix(11.,4.5,fk);
    float x=p.x*sc+fk*37.; float b=floor(x);
    float H=base*(.45+1.25*h21(vec2(b,fk+3.)));
    if(p.y<H){
      vec3 bc=mix(vec3(.018,.024,.044),vec3(.006,.007,.012),fk);
      vec2 g=vec2(p.x*3.4,p.y*2.6); vec2 id=floor(g); vec2 f=fract(g);
      float lit=step(.955,h21(id+vec2(fk*5.,b)));
      float win=smoothstep(.14,.2,f.x)*smoothstep(.86,.8,f.x)*smoothstep(.22,.3,f.y)*smoothstep(.78,.7,f.y);
      vec3 lc=mix(vec3(1.,.66,.32),vec3(.7,.8,1.),step(.82,h21(id+11.)));
      c=bc+lc*lit*win*(.12+.5*h21(id+7.))*mix(.5,1.,fk);
    }
  }
  s.e=c;
}
void matDrawer(inout S s, vec3 p){
  float n=vn3(vec3(p.x*40.,p.y*90.,p.z*6.)); s.a*=.86+.28*n; s.r=clamp(s.r+(n-.5)*.2,0.,1.);
}

// Dampf: duenne Schleier, die sich beim Steigen verdrehen und aufloesen. uv.y 0 am Kaffee.
void matSteam(inout S s, vec2 uv){
  float y=uv.y, tt=uT*.55, x0=(uv.x-.5)*2.;
  vec2 P=vec2(x0*1.9,y*3.1-tt*1.05);
  float w1=fbm2(P+vec2(3.1,1.7));
  float w2=fbm2(P*2.1+vec2(w1*2.6,7.4)-vec2(0.,tt*.35));
  // Oben treibt er weiter auseinander als unten.
  float x=x0+(w1-.5)*(.16+y*1.15)+(w2-.5)*(.05+y*.55)+.05*sin(y*7.-tt*3.1)*y;
  float wid=.075+y*.44;
  float env=exp(-x*x/(wid*wid));
  // Schichten: gebogene Linien, die mit der Hoehe breiter werden.
  float ph=x*(7.5/(.3+y*1.5))+(w2-.5)*7.+y*2.4+sin(y*4.3-tt*1.7)*.9;
  float sheet=pow(.5+.5*sin(ph*3.14159),2.6);
  float puff=smoothstep(.28,.72,fbm2(vec2(x*4.5,y*5.5-tt*1.9)+w1*2.3));
  float a=env*smoothstep(0.,.05,y)*pow(max(1.-y,0.),1.25)*puff*(.42+.58*sheet);
  s.alpha=clamp(a*.46,0.,1.);
  s.a=vec3(.86,.84,.8); s.r=1.; s.e=vec3(.2,.18,.15);
}
float D_GGX(float a2,float NoH){float d=(NoH*a2-NoH)*NoH+1.;return a2/(3.14159265*d*d+1e-7);}
float V_Sm(float a2,float NoV,float NoL){float gv=NoL*sqrt(NoV*NoV*(1.-a2)+a2);float gl=NoV*sqrt(NoL*NoL*(1.-a2)+a2);return .5/(gv+gl+1e-5);}

float roomAO(vec3 P,int room){
  if(room<=1) return 1.;
  vec3 d0=max(P-uRoomMin[room].xyz,0.), d1=max(uRoomMax[room].xyz-P,0.);
  float r=.5, a=1.;
  a*=1.-.5*exp(-d0.y/r); a*=1.-.4*exp(-d1.y/r); a*=1.-.38*exp(-d0.x/r); a*=1.-.38*exp(-d1.x/r); a*=1.-.3*exp(-d0.z/r);
  return a;
}

vec3 envSpec(vec3 R,float rough,int room){
  vec3 up=uRoomUp[room].rgb, dn=uRoomDn[room].rgb; float g=uRoomDn[room].a;
  float k=smoothstep(-.7,.7,R.y);
  vec3 c=mix(dn,up,k);
  // Ein Raum spiegelt sich nie gleichmaessig: helle Flaechen, dunkle Ecken.
  float bands=.72+.28*sin(R.x*5.3+R.z*2.1+1.3)*sin(R.y*7.1+R.z*1.3);
  c*=mix(bands,1.,rough);
  float strip=smoothstep(.72-rough*.5,.95,R.y);
  c+=up*strip*(3.5*(1.-rough)+.6);
  return c*g;
}

vec3 probeDir(vec3 P,vec3 R){
  vec3 inv=1./(abs(R)+1e-5)*sign(R+1e-9);
  vec3 t1=(uProbeMax.xyz-P)*inv,t2=(uProbeMin.xyz-P)*inv; vec3 tm=max(t1,t2);
  float d=min(min(tm.x,tm.y),tm.z);
  return P+R*d-uProbePos;
}
vec3 envAt(vec3 P,vec3 R,float rough,int room){
  if(uProbeOn>.5 && room==int(uProbeMax.w+.5)){
    float lod=pow(rough,.72)*7.2;
    return textureLod(uProbe,probeDir(P,R),lod).rgb;
  }
  return envSpec(R,rough,room);
}
// ---- Tasse, Untertasse, Loeffel: Was dicht daneben steht, wird im Spiegelbild ausgerechnet statt aus dem Raumbild gelesen.
// Dazu helle Karten wie im Fotostudio: Sie sind nirgends zu sehen, nur als Fenster in der Glasur.
float heroCard(vec3 ro,vec3 rd,vec3 c,vec3 ax,vec3 ay,float soft){
  vec3 n=cross(ax,ay); float dn=dot(rd,n); if(abs(dn)<1e-6) return 0.;
  float t=dot(c-ro,n)/dn; if(t<=0.) return 0.;
  vec3 q=ro+rd*t-c; float u=abs(dot(q,ax)/dot(ax,ax)),v=abs(dot(q,ay)/dot(ay,ay));
  return smoothstep(1.,1.-soft,u)*smoothstep(1.,1.-soft,v);
}
vec3 heroCards(vec3 ro,vec3 rd){
  vec3 k=vec3(0.),warm=vec3(1.,.87,.68);
  k+=warm*17.*heroCard(ro,rd,vec3(-.72,.0,.69),vec3(.09,0.,.094),vec3(0.,.42,0.),.34);
  k+=warm*9.*heroCard(ro,rd,vec3(-.86,.0,.5),vec3(.022,0.,.038),vec3(0.,.42,0.),.5);
  k+=warm*3.2*heroCard(ro,rd,vec3(.9,.0,-.44),vec3(.022,0.,.045),vec3(0.,.42,0.),.8);
  k+=warm*1.9*heroCard(ro,rd,vec3(-.31,.2,-.93),vec3(.12,0.,-.04),vec3(0.,.14,0.),.4);
  k+=warm*1.5*heroCard(ro,rd,vec3(-.1,.95,.25),vec3(.55,0.,0.),vec3(0.,.1,.55),.5);
  return k;
}
// Schnitt mit einem Kegelstumpf um die Hochachse: kleinstes t>0 oder -1.
float heroCone(vec3 ro,vec3 rd,float y0,float r0,float y1,float r1){
  float k=(r1-r0)/(y1-y0),b=r0-k*y0;
  float A=rd.x*rd.x+rd.z*rd.z-k*k*rd.y*rd.y;
  float rb=k*ro.y+b;
  float B=ro.x*rd.x+ro.z*rd.z-k*rd.y*rb;
  float C=ro.x*ro.x+ro.z*ro.z-rb*rb;
  float D=B*B-A*C; if(D<0.||abs(A)<1e-7) return -1.;
  D=sqrt(D);
  for(int i=0;i<2;i++){
    float t=(-B+(i==0?-D:D))/A; if(t<1e-4) continue;
    float y=ro.y+rd.y*t; if(y>=y0&&y<=y1) return t;
  }
  return -1.;
}
// who: 0 Tasse, 1 Untertasse, 2 Loeffel.
vec3 heroEnv(vec3 P,vec3 R,float rough,int room,int who,vec3 cardDir){
  vec3 ro=P-uHero.xyz;
  float r1=fract(ign(gl_FragCoord.xy)+uSub*.61803398875),r2=fract(ign(gl_FragCoord.yx+11.)+uSub*.75487766624);
  vec3 T=normalize(cross(R,vec3(.31,.87,.38))),Bt=cross(R,T);
  float ang=r2*6.2831853,ra=sqrt(r1)*rough;
  vec3 jit=(T*cos(ang)+Bt*sin(ang))*ra;
  vec3 rd=normalize(R+jit);
  vec3 c=envAt(P,rd,max(rough,.04),room)*(who==2?.62:1.);
  vec3 cardsC=heroCards(ro,normalize(cardDir+jit));
  if(who==2) c+=vec3(1.,.9,.74)*7.*heroCard(ro,rd,vec3(.02,.62,.22),vec3(.3,0.,0.),vec3(0.,.03,.16),.35)*.45;
  float best=1e9; vec3 hit=vec3(-1.);
  const vec3 CREAM=vec3(.92,.8,.6),DARK=vec3(.11,.045,.02);
  float pw=uRoomUp[room].a;
  // Die Tischplatte
  if(rd.y<-1e-3){
    float t=-ro.y/rd.y; vec3 q=ro+rd*t; float rq=length(q.xz);
    if(rq>.08){ best=t; hit=DARK*(.5+.5*smoothstep(.08,.22,rq))*(.9+.25*sin(q.x*90.+sin(q.z*6.)*4.))*pw; }
  }
  // Die Untertasse: Fahne als Kegel, Spiegel als Scheibe.
  if(who!=1){
    if(rd.y<-1e-3){
      float t=(.0066-ro.y)/rd.y; vec3 q=ro+rd*t; float rq=length(q.xz);
      if(t>1e-4&&t<best&&rq<.038){ best=t; hit=CREAM*.8*mix(.42,1.,smoothstep(.024,.04,rq))*pw; }
    }
    float t=heroCone(ro,rd,.0087,.0405,.0208,.0795);
    if(t>0.&&t<best){ vec3 q=ro+rd*t; best=t; hit=CREAM*(.92+.25*smoothstep(.04,.08,length(q.xz)))*pw; }
  }
  // Die Tasse
  if(who!=0){
    float t=heroCone(ro,rd,.0072,.026,.0837,.0434);
    if(t>0.&&t<best){
      vec3 q=ro+rd*t; vec3 n=normalize(vec3(q.x,-.24*length(q.xz),q.z));
      float d=max(dot(n,normalize(vec3(-.55,.35,.76))),0.);
      best=t; hit=CREAM*(.3+.72*d)*mix(.42,1.,smoothstep(.0072,.03,q.y))*pw;
    }
  }
  // Der Loeffel im Spiegel der Untertasse
  if(who==1){
    vec3 oc=(ro-uHeroA)*vec3(1.,3.2,1.),dv=rd*vec3(1.,3.2,1.); float a=dot(dv,dv),b=dot(oc,dv),cc=dot(oc,oc)-.0158*.0158,D=b*b-a*cc;
    if(D>0.){ float t=(-b-sqrt(D))/a; if(t>1e-4&&t<best){ best=t; hit=vec3(.42,.4,.36)*pw; } }
    vec3 ba=uHeroB-uHeroA,o2=ro-uHeroA; float baba=dot(ba,ba),bard=dot(ba,rd),baoa=dot(ba,o2),rdoa=dot(rd,o2),oaoa=dot(o2,o2),rc=.0042;
    float a2_=baba-bard*bard,b2_=baba*rdoa-baoa*bard,c2_=baba*oaoa-baoa*baoa-rc*rc*baba,D2=b2_*b2_-a2_*c2_;
    if(D2>0.&&a2_>1e-9){ float t=(-b2_-sqrt(D2))/a2_; float y=baoa+t*bard; if(t>1e-4&&t<best&&y>0.&&y<baba){ best=t; hit=vec3(.34,.32,.29)*pw; } }
  }
  if(hit.x>=0.){ float haze=clamp(best/.35,0.,1.); c=mix(hit,c,haze*.35); }
  // Auf der Tassenwand stehen die Fenster immer. Sonst nur dort, wo nichts davorsteht.
  if(who==0||hit.x<0.) c+=cardsC;
  return c;
}
void main(){
  if(vW.y<uClipY) discard;
  gDx=dFdx(vW); gDy=dFdy(vW);
  vec3 V=normalize(uEye-vW);
  vec3 N=normalize(vN); if(dot(N,V)<0.) N=-N;
  int mat=int(vMat.z*255.+.5); int layer=int(vMat.w*255.+.5); int room=int(vAux.x*255.+.5); int flagv=int(vAux.w*255.+.5);
  S s; s.a=vCol.rgb; s.r=vMat.x; s.m=vMat.y; s.N=N; s.alpha=vAlpha; s.e=vec3(0.); s.tr=0.; s.sheen=0.;
  float em=vAux.y*vAux.y*64.;
  float ao=vCol.a;

  // Texturen: Papier mit Schrift, Bildschirme, alles, was man lesen kann.
  if(layer>0){
    vec4 t;
    if(layer>=200){
      if(layer==200){ t=texture(uLive0,vUv); t.rgb=unfilm(t.rgb); } else if(layer==201) t=texture(uLive1,vUv); else if(layer==202) t=texture(uLive2,vUv); else t=texture(uLive3,vUv);
    } else if(layer>=64) t=texture(uTexA,vec3(vUv,float(layer-64)));
    else t=texture(uTexB,vec3(vUv,float(layer-1)));
    if((flagv&1)!=0){ s.alpha*=t.a; s.a=mix(s.a,t.rgb,step(.001,t.a)); }
    else s.a=mix(s.a,t.rgb*mix(vec3(1.),s.a,float((flagv&4)!=0)),t.a);
    if((flagv&2)!=0) em*=dot(t.rgb,vec3(.3,.6,.1))*1.+.0;
  }
  // Was sich bewegt, traegt sein Muster mit (Flag 16): sonst wuerde das Holz durch den Tisch fliessen.
  vec3 Pm=(flagv&16)!=0?vL+vec3(vAux.z*255.*3.7):vW;
  float axisM=(flagv&16)!=0?0.:vAux.z*255.;
  if(mat==1) matWood(s,Pm,axisM,h21(vec2(vAux.z*255.,float(room))),float((flagv&128)!=0));
  else if(mat==2) matParquet(s,Pm);
  else if(mat==3) matPaper(s,Pm);
  else if(mat==4) matChecker(s,Pm);
  else if(mat==5) matFoam(s,Pm);
  else if(mat==6) matBrushed(s,Pm,axisM);
  else if(mat==7) matVelvet(s,Pm);
  else if(mat==8) matPoche(s,Pm);
  else if(mat==10) matFabric(s,Pm);
  else if(mat==11) matPlaster(s,Pm);
  else if(mat==12){ vec2 q=vUv*vec2(1920.,1080.)*.5; vec2 f=fract(q); float g=smoothstep(0.,.14,f.x)*smoothstep(1.,.86,f.x)*smoothstep(0.,.14,f.y)*smoothstep(1.,.86,f.y); s.a*=mix(.72,1.,g); s.r=.14; }
  else if(mat==13) matWallA(s,Pm);
  else if(mat==14) matWallB(s,Pm);
  else if(mat==15) matWallC(s,Pm);
  else if(mat==16) matLeather(s,Pm);
  else if(mat==17) matRug(s,Pm);
  else if(mat==18){ matStreet(s,Pm);
    if(uRefl>0.){
      // Nasse Strasse: Im selben Bildpunkt des gespiegelten Bildes steht, was sich hier spiegelt.
      vec2 q=gl_FragCoord.xy/uView; float wet=smoothstep(.3,.62,fbm2(vW.xz*.8));
      float rip=vn2(vW.xz*vec2(13.,4.)+vec2(0.,uT*2.6))-.5, rip2=vn2(vW.xz*vec2(31.,9.)-vec2(uT*1.7,uT*3.1))-.5;
      vec3 c=textureLod(uLive3,q+vec2(rip*.007,rip2*.03),1.2+2.6*(1.-wet)).rgb;
      vec3 c2=textureLod(uLive3,q+vec2(rip2*.005,-.016+rip*.05),3.2).rgb;
      float nv=clamp(dot(N,V),0.,1.); float fr=.05+.95*pow(1.-nv,5.);
      s.e+=(c*.62+c2*.38)*mix(.3,1.,fr)*mix(.22,.95,wet)*uRefl;
    }
  }
  else if(mat==19) matSky(s,Pm);
  else if(mat==21) matBrick(s,Pm);
  else if(mat==22) matDrawer(s,Pm);
  else if(mat==23){ vec3 n0=s.N; float r0=s.r; matWood(s,Pm*6.,axisM,.3,0.); s.N=n0; s.r=r0; }
  else if(mat==24) matSteam(s,vec2(vUv.x,1.-vUv.y));
  else if(mat==25) matPages(s,Pm,axisM);

  float NoV=clamp(dot(s.N,V),1e-3,1.);
  vec3 F0=mix(vec3(.04),s.a,s.m);
  vec3 diffC=s.a*(1.-s.m);
  float fres=pow(1.-NoV,5.);

  // Glas: nur Spiegelung und ein Hauch Farbe. Die Durchsicht macht der Zufall.
  float glass=float(mat==9);
  if(mat==9){ F0=vec3(.05); diffC=s.a*.08; s.alpha=clamp(.06+fres*.9+vMat.y*.8,0.,1.); s.m=0.; }

  // Durchsichtiges wird nicht sortiert: Jedes Teilbild laesst zufaellig Pixel weg, der Mittelwert ist die Deckkraft.
  if(s.alpha<.999 && s.alpha<ign(gl_FragCoord.xy+5.588238*uSub)) discard;

  vec3 col=vec3(0.);
  float a=max(s.r*s.r,mat==27?.04:.0016), a2=a*a;
  // Klarlack (Flag 64): eine zweite, ruhige Schicht ueber allem, auf der glatten Form statt auf dem Relief.
  float coat=float((flagv&64)!=0), NoVc=clamp(dot(N,V),1e-3,1.);
  float Fc=coat*(.04+.96*pow(1.-NoVc,5.));
  float ac=(mat==26||mat==28)?.035:.0064, a2c=ac*ac;
  vec3 coatCol=vec3(0.);
  for(int i=0;i<uNL;i++){
    int lr=int(uLPos[i].w+.5); if(lr!=room) continue;
    vec3 L=uLPos[i].xyz-vW; float d2=dot(L,L); float d=sqrt(d2); L/=d;
    float cd=dot(-L,uLDir[i].xyz);
    float cone=smoothstep(uLDir[i].w,uLCol[i].w,cd); if(cone<=0.) continue;
    float NoL=dot(s.N,L);
    float trans=s.tr*max(-NoL,0.);
    float nl=max(NoL,0.); if(nl<=0.&&trans<=0.) continue;
    vec4 cl=uLVP[i]*vec4(vW+N*uLSh[i].z*(1.+d*.5),1.);
    vec3 pr=cl.xyz/cl.w*.5+.5;
    float vis=1.;
    if(pr.x>0.&&pr.x<1.&&pr.y>0.&&pr.y<1.&&pr.z<1.){
      vec2 uvs=(pr.xy*.998+.001+uLSh[i].xy)/vec2(4.,2.);
      vis=textureLod(uShadow,vec3(uvs,pr.z),0.);
    }
    if(vis<=0.) continue;
    float rng=uLSh[i].w; float win=clamp(1.-pow(d/rng,4.),0.,1.); win*=win;
    vec3 rad=uLCol[i].rgb*cone*vis*win/(d2+.04);
    col+=diffC*rad*(nl+trans)/3.14159265;
    if(coat>0.){
      float nlc=max(dot(N,L),0.);
      if(nlc>0.){ vec3 Hc=normalize(L+V); float NoHc=max(dot(N,Hc),0.),VoHc=max(dot(V,Hc),0.); float Fl=.04+.96*pow(1.-VoHc,5.); coatCol+=Fl*D_GGX(a2c,NoHc)*V_Sm(a2c,NoVc,nlc)*nlc*rad; }
    }
    if(nl>0.){
      vec3 H=normalize(L+V); float NoH=max(dot(s.N,H),0.),VoH=max(dot(V,H),0.);
      vec3 F=F0+(1.-F0)*pow(1.-VoH,5.);
      col+=F*D_GGX(a2,NoH)*V_Sm(a2,NoV,nl)*nl*rad;
      if(s.sheen>0.){ col+=s.a*s.sheen*pow(1.-NoV,3.)*nl*rad*.9; }
    }
  }
  // Umgebung: das Licht, das von Waenden zurueckkommt. Was davor steht, nimmt es weg.
  vec3 up=uRoomUp[room].rgb, dn=uRoomDn[room].rgb;
  float rao=roomAO(vW,room)*ao;
  float aoK=1.;
  if(uAOOn>.5){
    float nd=dot(N,uAODir);
    // Je Teilbild eine Richtung: Mittelwert 1, wenn nichts im Weg steht.
    aoK=0.;
    if(nd>0.){
      vec4 cl=uAOVP*vec4(vW+N*uAOBias+uAODir*uAOBias*.5,1.);
      vec3 pr=cl.xyz*.5+.5; float vis=1.;
      if(pr.x>0.&&pr.x<1.&&pr.y>0.&&pr.y<1.&&pr.z<1.) vis=textureLod(uAO,pr,0.);
      aoK=4.*nd*vis;
    }
    // Rueckseiten duenner Dinge sollen nicht schwarz werden: Papier und Stoff lassen etwas durch.
    aoK=mix(aoK,1.,s.tr*.6);
  }
  vec3 amb=mix(dn,up,s.N.y*.5+.5);
  col+=diffC*amb*rao*aoK;
  { vec3 fd=vec3(0.,.28,.96); col+=diffC*uRoomFill[room].rgb*max(dot(s.N,fd),0.)*mix(rao,1.,.4)*mix(1.,aoK,.75); }
  if(s.sheen>0.) col+=s.a*s.sheen*pow(1.-NoV,3.)*amb*1.2*rao*aoK;
  vec3 R=reflect(-V,s.N);
  vec3 F=F0+(max(vec3(1.-s.r),F0)-F0)*fres;
  float aoSp=mix(1.,aoK,.55);
  col+=F*(mat==27?heroEnv(vW,R,s.r*.5,room,2,R):envAt(vW,R,s.r,room))*mix(rao,1.,.3)*aoSp;
  // Der Lack legt sich darueber: was er spiegelt, nimmt er dem Darunter weg.
  if(coat>0.){
    vec3 Rc=reflect(-V,N);
    vec3 ec; float planeK=1.;
    if(uPlaneOn>.5 && N.y>.97 && abs(vW.y-uPlaneY)<.004){
      // Die Platte selbst ist ein Spiegel: Das Bild kommt aus einem zweiten Blick von unten.
      // Seidenmatt: Je Teilbild ein anderer Punkt im Spiegelbild, der Mittelwert ist die Unschaerfe.
      vec2 q=gl_FragCoord.xy/uView;
      float wob=vn2(vW.xz*vec2(4.,13.))-.5, wob2=vn2(vW.xz*vec2(21.,70.))-.5;
      float r1=fract(ign(gl_FragCoord.xy)+uSub*.61803398875), r2=fract(ign(gl_FragCoord.yx+7.)+uSub*.75487766624);
      float ra=sqrt(r1)*6.2831853*.0+r2*6.2831853, rd=sqrt(r1);
      float blur=mix(.0028,.0085,uPlaneSoft);
      q+=vec2(cos(ra),sin(ra)*2.4)*rd*blur+vec2(wob*.0022+wob2*.0007,wob*.005+wob2*.0018);
      ec=min(unfilm(textureLod(uLive3,q,0.).rgb),vec3(1.5));
      planeK=.6;
    } else if(mat==26||mat==28){
      // Glasur: Sie ist nie ganz plan. Darum zittern die Spiegelungen ein wenig.
      vec3 hl=vW-uHero.xyz;
      vec3 Ng=normalize(N+.012*(vec3(vn2(hl.xy*52.+3.),vn2(hl.zy*47.+9.),vn2(hl.xz*55.+5.))-.5)+.006*(vec3(vn2(hl.xy*170.),vn2(hl.zy*160.+4.),vn2(hl.xz*150.+8.))-.5));
      vec3 Rg=reflect(-V,Ng);
      float rr=length(hl.xz),wallY=hl.y-.0066;
      // Kegelwand: Die Fenster stehen als lange Striche auf der Tasse, so wie sie der Fotograf setzt.
      bool body=mat==26&&rr<.0272+.236*max(wallY-.0058,0.)+.0012&&wallY>.0022&&wallY<.076;
      vec3 Nc=normalize(vec3(Ng.x,0.,Ng.z)); vec3 Rc2=reflect(-V,Nc);
      vec3 cd=body?Rc2:Rg;
      ec=heroEnv(vW,Rg,mat==26?.05:.02,room,mat==26?0:1,cd);
      if(body){ ec=mix(envAt(vW,Rg,.1,room),ec,smoothstep(.006,.026,wallY)*smoothstep(.0765,.066,wallY)); }
      Fc=coat*(.055+.945*pow(1.-NoVc,5.));
    } else ec=envAt(vW,Rc,.06,room);
    col=col*(1.-Fc*planeK)+Fc*planeK*ec*mix(1.,aoSp,.7)+coat*coatCol;
  }

  // Was selbst leuchtet.
  float power=uRoomUp[room].a;
  if(em>0.&&(flagv&8)==0) col+=vCol.rgb*em*power;
  if(layer==200&&(flagv&8)!=0){ col=s.a*em; } // Bild im Bild ist reines Licht.
  else if(layer>0&&(flagv&8)!=0){ col+=s.a*power*em; }
  col+=s.e;
  if(mat==9&&s.alpha>0.) col/=max(s.alpha,.08);
  fragColor=vec4(clamp(col,vec3(0.),vec3(uMaxCol)),1.);
}`;

export const VS_FS = HEAD + `
out vec2 vUv;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); vUv=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;

// ---------------------------------------------------------------- Licht im Dunst
export const FS_VOL = HEAD + NOISE + `
in vec2 vUv; out vec4 f;
uniform sampler2D uDepth; uniform mat4 uInvVP; uniform vec3 uEye; uniform float uSub;
uniform int uNL;
uniform vec4 uLPos[${MAXL}]; uniform vec4 uLDir[${MAXL}]; uniform vec4 uLCol[${MAXL}]; uniform vec4 uLSh[${MAXL}]; uniform mat4 uLVP[${MAXL}];
uniform vec4 uLHaze[${MAXL}]; // Dichte; Raum-Min steht in uLBoxA, Raum-Max in uLBoxB
uniform vec4 uLBoxA[${MAXL}]; uniform vec4 uLBoxB[${MAXL}];
uniform sampler2DShadow uShadow;
void main(){
  float dz=texelFetch(uDepth,ivec2(gl_FragCoord.xy),0).r;
  vec4 w=uInvVP*vec4(vUv*2.-1.,dz*2.-1.,1.); vec3 pw=w.xyz/w.w;
  vec3 rd=pw-uEye; float L=length(rd); rd/=L;
  vec3 sum=vec3(0.);
  for(int i=0;i<uNL;i++){
    float dens=uLHaze[i].x; if(dens<=0.) continue;
    float rnd=fract(ign(gl_FragCoord.xy)+uLHaze[i].z*.61803398875);
    // Strecke des Sehstrahls im Raum dieses Lichts.
    vec3 bmin=uLBoxA[i].xyz,bmax=uLBoxB[i].xyz;
    vec3 inv=1./(abs(rd)+1e-5)*sign(rd+1e-9);
    vec3 t0=(bmin-uEye)*inv,t1=(bmax-uEye)*inv; vec3 tn=min(t0,t1),tf=max(t0,t1);
    float ta=max(max(tn.x,tn.y),max(tn.z,0.)), tb=min(min(tf.x,tf.y),min(tf.z,L));
    if(tb<=ta) continue;
    vec3 lp=uLPos[i].xyz; float dl=dot(lp-uEye,rd); vec3 cp=uEye+rd*dl-lp; float DD=sqrt(dot(cp,cp)+.1);
    float thA=atan((ta-dl)/DD), thB=atan((tb-dl)/DD); float t=dl+DD*tan(mix(thA,thB,rnd)); vec3 p=uEye+rd*t;
    vec3 Lv=lp-p; float d2=dot(Lv,Lv); float d=sqrt(d2); Lv/=d;
    float cd=dot(-Lv,uLDir[i].xyz); float cone=smoothstep(uLDir[i].w,uLCol[i].w,cd); if(cone<=0.) continue;
    vec4 cl=uLVP[i]*vec4(p,1.); vec3 pr=cl.xyz/cl.w*.5+.5; float vis=1.;
    if(pr.x>0.&&pr.x<1.&&pr.y>0.&&pr.y<1.&&pr.z<1.){ vis=textureLod(uShadow,vec3((pr.xy*.998+.001+uLSh[i].xy)/vec2(4.,2.),pr.z),0.); }
    float rng=uLSh[i].w; float win=clamp(1.-pow(d/rng,4.),0.,1.);
    float cth=dot(-Lv,rd); float phase=.6+.8*pow(max(cth,0.),6.);
    // Dunst ist nie gleichmaessig.
    float n=.55+.9*vn3(p*1.7+vec3(0.,uSub*0.+uLHaze[i].y*.08,uLHaze[i].y*.05));
    sum+=uLCol[i].rgb*cone*vis*win*dens*phase*n*(thB-thA)/DD;
  }
  f=vec4(sum,0.);
}`;

export const FS_COPY = HEAD + `in vec2 vUv; out vec4 f; uniform sampler2D uTex; void main(){ f=texelFetch(uTex,ivec2(gl_FragCoord.xy),0); }`;

// ---------------------------------------------------------------- Bloom: was hell ist, blendet ein wenig
export const FS_DOWN = HEAD + `in vec2 vUv; out vec4 f; uniform sampler2D uTex; uniform vec2 uPx; uniform float uFirst; uniform float uScale;
vec3 s(vec2 o){return texture(uTex,vUv+o*uPx).rgb;}
void main(){
  vec3 c=s(vec2(0))*.125+(s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1)))*.125
    +(s(vec2(-2,0))+s(vec2(2,0))+s(vec2(0,-2))+s(vec2(0,2)))*.0625
    +(s(vec2(-2,-2))+s(vec2(2,-2))+s(vec2(-2,2))+s(vec2(2,2)))*.03125;
  if(uFirst>.5){ c*=uScale; float b=max(c.r,max(c.g,c.b)); c*=smoothstep(.55,1.6,b); c=min(c,vec3(40.)); }
  f=vec4(c,1.);
}`;
export const FS_UP = HEAD + `in vec2 vUv; out vec4 f; uniform sampler2D uTex; uniform vec2 uPx; uniform float uK;
void main(){ vec3 c=vec3(0.); for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ float w=(x==0?2.:1.)*(y==0?2.:1.); c+=texture(uTex,vUv+vec2(x,y)*uPx*1.3).rgb*w; } f=vec4(c/16.*uK,1.); }`;

// ---------------------------------------------------------------- Vom Rechenwert zum Filmbild
export const FS_TONE = HEAD + NOISE + `
in vec2 vUv; out vec4 f;
uniform sampler2D uAcc; uniform sampler2D uBloom; uniform float uN; uniform float uExp;
uniform vec3 uLift; uniform vec3 uGain; uniform float uSat; uniform float uBloomK; uniform float uVig; uniform float uFade; uniform float uLinOut;
vec3 film(vec3 x){ // Filmkurve mit weicher Schulter, kein abgeschnittenes Weiss.
  const float A=2.51,B=.03,C=2.43,D=.59,E=.14; return clamp((x*(A*x+B))/(x*(C*x+D)+E),0.,1.); }
void main(){
  vec3 c=texture(uAcc,vUv).rgb/uN;
  vec3 b=texture(uBloom,vUv).rgb;
  // Halation: das Rot blutet weiter als das Blau, wie auf echtem Film.
  c+=b*uBloomK*vec3(1.12,.96,.86);
  c*=uExp;
  c=max(c-.0008,0.);
  vec2 q=vUv-.5; q.x*=1.2; float v=1.-uVig*smoothstep(.25,.95,length(q));
  c*=v;
  vec3 t=film(c*.82);
  float l=dot(t,vec3(.2126,.7152,.0722));
  t=mix(vec3(l),t,uSat);
  t=clamp(t,0.,1.);
  t=t*uGain+uLift*(1.-t);
  if(uLinOut<.5) t=pow(max(t,vec3(0.)),vec3(1./2.2));
  f=vec4(t*uFade,1.);
}`;

// ---------------------------------------------------------------- Letzter Schritt: Korn, und wenn es sein muss: alles wird Text
export const FS_FINAL = HEAD + NOISE + `
in vec2 vUv; out vec4 f;
uniform sampler2D uImg; uniform sampler2D uGlyphs; uniform sampler2D uCode;
uniform float uFrame; uniform vec2 uRes; uniform float uGrain;
uniform float uTextMask; // 0 Bild, 1 Text
uniform vec4 uTextGeo;   // Mitte der Maske x,y; Radius; Weichheit (Radius<0: Kante von oben)
uniform float uCellH;    // Hoehe einer Zeile in Pixeln
uniform vec2 uCodeSize;  // Spalten, Zeilen der Codetextur
uniform float uScroll;
uniform vec2 uCA;
void main(){
  vec2 px=vUv*uRes;
  // Ein Hauch Farbsaum am Rand, wie bei echten Objektiven.
  vec2 d=(vUv-.5); float rr=dot(d,d);
  vec2 ca=d*rr*uCA.x;
  vec3 c=vec3(texture(uImg,vUv+ca).r,texture(uImg,vUv).g,texture(uImg,vUv-ca).b);
  if(uTextMask>0.){
    float m;
    if(uTextGeo.z<0.){ m=smoothstep(uTextGeo.y-uTextGeo.w,uTextGeo.y+uTextGeo.w,px.y); c+=vec3(.55,.6,.7)*exp(-abs(px.y-uTextGeo.y)/5.); }
    else { float dd=length(px-uTextGeo.xy); m=1.-smoothstep(uTextGeo.z-uTextGeo.w,uTextGeo.z+uTextGeo.w,dd); }
    m*=uTextMask;
    if(m>0.){
      vec2 cell=vec2(uCellH*.6,uCellH);
      vec2 g=vec2(px.x,uRes.y-px.y)/cell; vec2 cid=floor(g); vec2 cuv=fract(g);
      vec2 tuv=(cid*cell+cell*.5); vec3 cc=textureLod(uImg,vec2(tuv.x,uRes.y-tuv.y)/uRes,max(log2(uCellH*.45),0.)).rgb;
      vec2 ci=vec2(mod(cid.x,uCodeSize.x),mod(cid.y+uScroll,uCodeSize.y));
      float chr=texelFetch(uCode,ivec2(ci),0).r*255.;
      vec2 at=vec2(mod(chr,16.),floor(chr/16.));
      float cov=textureGrad(uGlyphs,(at+vec2(cuv.x,cuv.y))/16.,vec2(1./16./cell.x,0.),vec2(0.,1./16./cell.y)).r;
      float lum=dot(cc,vec3(.3,.6,.1));
      vec3 ink=pow(max(cc,vec3(0.)),vec3(.5))*1.7+vec3(.2,.25,.33);
      vec3 bg=cc*.2;
      vec3 tx=mix(bg,ink,clamp(cov*1.7,0.,1.));
      c=mix(c,tx,m);
    }
  }
  // Korn: mehr in den Mitten, wie auf Negativfilm.
  float l=dot(c,vec3(.3,.6,.1));
  float n=h21(px+vec2(uFrame*17.3,uFrame*9.1))+h21(px*1.7+vec2(uFrame*3.1,uFrame*31.7))-1.;
  c+=n*uGrain*(.35+1.1*sqrt(max(l*(1.-l),0.)));
  // Kleine Zitterwerte gegen Streifen in dunklen Verlaeufen.
  c+=(h21(px+uFrame)-.5)/255.;
  f=vec4(c,1.);
}`;
