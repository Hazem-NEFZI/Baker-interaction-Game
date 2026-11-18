'use strict';
/**
 * Minimal zero-dependency QR Code generator (byte mode, ECC level M).
 * Based on the algorithm described in ISO/IEC 18004 (structure follows Nayuki's reference design).
 * qrSvg(text) -> SVG string.
 */
const ECC_M = { ordinal: 0, formatBits: 0 }; // level M
// Tables indexed [version] for ECC level M
const ECC_CODEWORDS_PER_BLOCK_M = [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
const NUM_EC_BLOCKS_M = [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];

function numRawDataModules(ver){
  let r=(16*ver+128)*ver+64;
  if(ver>=2){const n=Math.floor(ver/7)+2;r-=(25*n-10)*n-55;if(ver>=7)r-=36;}
  return r;
}
function numDataCodewords(ver){return Math.floor(numRawDataModules(ver)/8)-ECC_CODEWORDS_PER_BLOCK_M[ver]*NUM_EC_BLOCKS_M[ver];}

function rsMul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x;}return z&0xFF;}
function rsDivisor(degree){const r=new Array(degree).fill(0);r[degree-1]=1;let root=1;for(let i=0;i<degree;i++){for(let j=0;j<r.length;j++){r[j]=rsMul(r[j],root);if(j+1<r.length)r[j]^=r[j+1];}root=rsMul(root,0x02);}return r;}
function rsRemainder(data,div){const r=div.map(()=>0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>{r[i]^=rsMul(c,f);});}return r;}

function encode(text){
  const bytes=[...Buffer.from(String(text),'utf8')];
  let ver=1,dataBits;
  for(;;ver++){
    if(ver>40)throw new Error('Texte trop long pour un QR code');
    const ccBits=ver<10?8:16;
    dataBits=4+ccBits+bytes.length*8;
    if(dataBits<=numDataCodewords(ver)*8)break;
  }
  const ccBits=ver<10?8:16;
  const bb=[];const push=(val,len)=>{for(let i=len-1;i>=0;i--)bb.push((val>>>i)&1);};
  push(4,4);push(bytes.length,ccBits);for(const b of bytes)push(b,8);
  const cap=numDataCodewords(ver)*8;
  push(0,Math.min(4,cap-bb.length));push(0,(8-bb.length%8)%8);
  for(let pad=0xEC;bb.length<cap;pad^=0xEC^0x11)push(pad,8);
  const data=[];for(let i=0;i<bb.length;i+=8){let v=0;for(let j=0;j<8;j++)v=(v<<1)|bb[i+j];data.push(v);}

  // Split into blocks, add ECC, interleave
  const numBlocks=NUM_EC_BLOCKS_M[ver],eccLen=ECC_CODEWORDS_PER_BLOCK_M[ver];
  const rawCodewords=Math.floor(numRawDataModules(ver)/8);
  const numShort=numBlocks-rawCodewords%numBlocks,shortLen=Math.floor(rawCodewords/numBlocks);
  const div=rsDivisor(eccLen);const blocks=[];
  for(let i=0,k=0;i<numBlocks;i++){
    const dat=data.slice(k,k+shortLen-eccLen+(i<numShort?0:1));k+=dat.length;
    const ecc=rsRemainder(dat,div);if(i<numShort)dat.push(0);blocks.push(dat.concat(ecc));
  }
  const all=[];
  for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==shortLen-eccLen||j>=numShort)all.push(b[i]);});

  const size=ver*4+17;
  const mod=[...Array(size)].map(()=>new Array(size).fill(false));
  const fn=[...Array(size)].map(()=>new Array(size).fill(false));
  const set=(x,y,d)=>{mod[y][x]=d;fn[y][x]=true;};
  // timing
  for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
  // finders
  const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size)set(x,y,d!==2&&d!==4);}};
  finder(3,3);finder(size-4,3);finder(3,size-4);
  // alignment
  const align=[];if(ver>1){const n=Math.floor(ver/7)+2;const step=ver===32?26:Math.ceil((ver*4+4)/(n*2-2))*2;align.push(6);for(let p=size-7;align.length<n;p-=step)align.splice(1,0,p);}
  align.forEach((a,i)=>align.forEach((b,j)=>{if((i===0&&j===0)||(i===0&&j===align.length-1)||(i===align.length-1&&j===0))return;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}));
  // reserve format + version areas
  const drawFormat=(mask)=>{
    const dataF=(ECC_M.formatBits<<3)|mask;let rem=dataF;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
    const bits=((dataF<<10)|rem)^0x5412;const g=i=>((bits>>>i)&1)!==0;
    for(let i=0;i<=5;i++)set(8,i,g(i));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));
    for(let i=9;i<15;i++)set(14-i,8,g(i));
    for(let i=0;i<8;i++)set(size-1-i,8,g(i));
    for(let i=8;i<15;i++)set(8,size-15+i,g(i));
    set(8,size-8,true);
  };
  drawFormat(0);
  if(ver>=7){let rem=ver;for(let i=0;i<12;i++)rem=(rem<<1)^((rem>>>11)*0x1F25);const bits=(ver<<12)|rem;
    for(let i=0;i<18;i++){const b=((bits>>>i)&1)!==0,a=size-11+i%3,c=Math.floor(i/3);set(a,c,b);set(c,a,b);}}
  // data placement
  let i=0;
  for(let right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){
      const x=right-j,upward=((right+1)&2)===0,y=upward?size-1-vert:vert;
      if(!fn[y][x]&&i<all.length*8){mod[y][x]=((all[i>>>3]>>>(7-(i&7)))&1)!==0;i++;}
    }
  }
  const applyMask=m=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++){if(fn[y][x])continue;let inv;
    switch(m){case 0:inv=(x+y)%2===0;break;case 1:inv=y%2===0;break;case 2:inv=x%3===0;break;case 3:inv=(x+y)%3===0;break;
      case 4:inv=(Math.floor(x/3)+Math.floor(y/2))%2===0;break;case 5:inv=x*y%2+x*y%3===0;break;case 6:inv=(x*y%2+x*y%3)%2===0;break;default:inv=((x+y)%2+x*y%3)%2===0;}
    if(inv)mod[y][x]=!mod[y][x];}};
  const penalty=()=>{let p=0;
    const runs=line=>{let s=0,run=1;for(let k=1;k<=line.length;k++){if(k<line.length&&line[k]===line[k-1])run++;else{if(run>=5)s+=3+run-5;run=1;}}
      const str=line.map(v=>v?'1':'0').join('');for(const pat of ['10111010000','00001011101']){let idx=str.indexOf(pat);while(idx>=0){s+=40;idx=str.indexOf(pat,idx+1);}}return s;};
    for(let y=0;y<size;y++)p+=runs(mod[y]);for(let x=0;x<size;x++)p+=runs(mod.map(r=>r[x]));
    for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=mod[y][x];if(c===mod[y][x+1]&&c===mod[y+1][x]&&c===mod[y+1][x+1])p+=3;}
    let dark=0;mod.forEach(r=>r.forEach(v=>{if(v)dark++;}));const total=size*size;p+=(Math.ceil(Math.abs(dark*20-total*10)/total)-1)*10;return p;};
  let best=0,min=Infinity;
  for(let m=0;m<8;m++){applyMask(m);drawFormat(m);const s=penalty();if(s<min){min=s;best=m;}applyMask(m);}
  applyMask(best);drawFormat(best);
  return mod;
}

function qrSvg(text,border=4){
  const m=encode(text),size=m.length,dim=size+border*2;let path='';
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(m[y][x])path+=`M${x+border},${y+border}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
module.exports={qrSvg,encode};
