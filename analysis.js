/* Análise inteiramente local: pixels do canvas, sem rede. */
window.AnguloAnalysis=(()=>{
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // aHash: média das 64 células distribuídas por toda a imagem, não só linhas iniciais.
  function aHash(data,w,h){
    const cells=[];
    for(let gy=0;gy<8;gy++) for(let gx=0;gx<8;gx++){
      const x0=Math.floor(gx*w/8),x1=Math.max(x0+1,Math.floor((gx+1)*w/8));
      const y0=Math.floor(gy*h/8),y1=Math.max(y0+1,Math.floor((gy+1)*h/8));
      let sum=0,n=0;
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){const p=(y*w+x)*4;sum+=.2126*data[p]+.7152*data[p+1]+.0722*data[p+2];n++}
      cells.push(sum/n);
    }
    const avg=cells.reduce((a,b)=>a+b,0)/64; let hash=0n;
    for(const value of cells) hash=(hash<<1n)|BigInt(value>=avg);
    return hash;
  }
  function hamming(a,b){let x=a^b,n=0;while(x){n++;x&=x-1n}return n}
  function scoreFrame(ctx,w,h){
    const sw=Math.min(360,w),sh=Math.max(1,Math.round(h*sw/w));
    const image=ctx.getImageData(0,0,sw,sh),d=image.data,n=sw*sh,gray=new Float32Array(n);
    let sum=0,sum2=0,lap=0,mid=0;
    for(let i=0,p=0;i<n;i++,p+=4){const y=.2126*d[p]+.7152*d[p+1]+.0722*d[p+2];gray[i]=y;sum+=y;sum2+=y*y;if(y>25&&y<235)mid++}
    const mean=sum/n,contrast=Math.sqrt(Math.max(0,sum2/n-mean*mean));
    for(let y=1;y<sh-1;y++)for(let x=1;x<sw-1;x++){const i=y*sw+x;lap+=Math.abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-sw]-gray[i+sw])}
    const sharp=lap/Math.max(1,(sw-2)*(sh-2));
    return {sharp,contrast,exposure:1-Math.abs(mean-128)/128,balanced:mid/n,hash:aHash(d,sw,sh)};
  }
  function normalize(items,key){const vals=items.map(x=>x.metrics[key]),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;items.forEach(x=>x[key]=(x.metrics[key]-min)/range)}
  function rank(items,wanted,duration){
    if(!items.length||wanted<1)return [];
    normalize(items,'sharp');normalize(items,'contrast');normalize(items,'exposure');
    items.forEach(x=>x.score=.46*x.sharp+.24*x.contrast+.2*x.exposure+.1*x.metrics.balanced+.25*(x.focusConfidence||0));
    const ordered=[...items].sort((a,b)=>b.score-a.score),selected=[];
    // Primeiro preserva o espaçamento ideal. Só relaxa explicitamente se faltarem quadros.
    const idealGap=Math.max(.3,Math.max(0,duration)/(Math.max(1,wanted)*3.4));
    const passes=[{gap:idealGap,distance:9},{gap:idealGap*.6,distance:8},{gap:idealGap*.3,distance:6}];
    for(const pass of passes){
      for(const item of ordered){
        if(selected.length>=wanted)break;
        const spaced=selected.every(s=>Math.abs(item.time-s.time)>=pass.gap);
        const different=selected.every(s=>hamming(item.metrics.hash,s.metrics.hash)>pass.distance);
        if(spaced&&different)selected.push(item);
      }
      if(selected.length>=wanted)break;
    }
    // Não preenche à força: em vídeos curtos/repetitivos pode retornar menos resultados.
    return selected.sort((a,b)=>a.time-b.time);
  }
  return {scoreFrame,rank,clamp};
})();
