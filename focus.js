/*
 * Ângulo Focus — detector local de pose para quadros de vídeo.
 * Pixels permanecem no aparelho. O CDN só é usado para obter o runtime/modelo
 * quando a cópia local não puder ser aberta; os artefatos remotos são cacheados.
 */
(()=>{'use strict';
  const ROOT=typeof document!=='undefined'?document.currentScript?.src?.replace(/[^/]+(?:\?.*)?$/,'')||'':'';
  const TF_URL=`${ROOT}vendor/tf.min.js`;
  const MODEL_URL=`${ROOT}models/movenet/model.json`;
  // Commit imutável do exemplo oficial tensorflow/tfjs-examples.
  const REMOTE_BASE='https://cdn.jsdelivr.net/gh/tensorflow/tfjs-examples@51430d697acd332f9d89fefe6df2fd90537d9e96/react-native/pose-detection/offline_model/';
  const REMOTE_TF_URL='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
  const REMOTE_MODEL_URL=`${REMOTE_BASE}model.json`;
  const CACHE_NAME='angulo-focus-movenet-v1';
  const SIZE=192;
  const POINTS={
    nose:0,leftEye:1,rightEye:2,leftEar:3,rightEar:4,
    leftShoulder:5,rightShoulder:6,leftHip:11,rightHip:12,
    leftKnee:13,rightKnee:14,leftAnkle:15,rightAnkle:16
  };
  let runtimePromise=null,modelPromise=null;

  function abort(){return new DOMException('Preparação cancelada.','AbortError')}
  function check(signal){if(signal?.aborted)throw abort()}
  function loadScript(url,signal,label){
    if(window.tf)return Promise.resolve(window.tf);
    return new Promise((resolve,reject)=>{
      check(signal);
      const existing=[...document.scripts].find(s=>s.src===new URL(url,document.baseURI).href);
      const done=()=>{clean();window.tf?resolve(window.tf):reject(new Error(`O runtime TensorFlow ${label} carregou sem disponibilizar a API.`))};
      const fail=()=>{clean();reject(new Error(`Não foi possível carregar o runtime TensorFlow ${label}.`))};
      const stopped=()=>{clean();reject(abort())};
      const clean=()=>{existing?.removeEventListener('load',done);existing?.removeEventListener('error',fail);signal?.removeEventListener('abort',stopped)};
      if(existing){
        if(window.tf)done();
        else {existing.addEventListener('load',done,{once:true});existing.addEventListener('error',fail,{once:true})}
      }else {const s=document.createElement('script');s.src=url;s.async=true;s.crossOrigin='anonymous';s.addEventListener('load',done,{once:true});s.addEventListener('error',fail,{once:true});document.head.appendChild(s)}
      signal?.addEventListener('abort',stopped,{once:true});
    });
  }
  async function getRuntime(signal,onStatus){
    if(!runtimePromise)runtimePromise=(async()=>{
      try{return await loadScript(TF_URL,signal,'local')}
      catch(localError){
        check(signal); onStatus?.('Baixando runtime do detector…');
        try{return await loadScript(REMOTE_TF_URL,signal,'remoto')}
        catch(remoteError){throw new Error(`Runtime local indisponível (${localError.message||localError}) e o fallback remoto falhou (${remoteError.message||remoteError}).`)}}
    })();
    try{const tf=await runtimePromise;await tf.ready();return tf}catch(e){runtimePromise=null;throw e}
  }
  async function cachedResponse(url){
    const cache=typeof caches==='undefined'?null:await caches.open(CACHE_NAME);
    let response=cache&&await cache.match(url);
    if(!response){
      response=await fetch(url,{mode:'cors',credentials:'omit'});
      if(!response.ok)throw new Error(`download HTTP ${response.status}`);
      if(cache)await cache.put(url,response.clone());
    }
    return response;
  }
  function concat(buffers){const size=buffers.reduce((n,b)=>n+b.byteLength,0),out=new Uint8Array(size);let at=0;for(const b of buffers){out.set(new Uint8Array(b),at);at+=b.byteLength}return out.buffer}
  async function loadCachedRemoteModel(tf){
    const json=await (await cachedResponse(REMOTE_MODEL_URL)).json();
    const manifest=json.weightsManifest;
    if(!Array.isArray(manifest)||!manifest.length)throw new Error('manifesto de pesos ausente');
    const groups=await Promise.all(manifest.map(async group=>{
      const buffers=await Promise.all(group.paths.map(path=>cachedResponse(new URL(path,REMOTE_MODEL_URL).href).then(r=>r.arrayBuffer())));
      return {specs:group.weights, data:concat(buffers)};
    }));
    return tf.loadGraphModel({load:async()=>({modelTopology:json.modelTopology,format:json.format,generatedBy:json.generatedBy,convertedBy:json.convertedBy,weightSpecs:groups.flatMap(g=>g.specs),weightData:concat(groups.map(g=>g.data))})});
  }
  async function ensure(signal,onStatus){
    check(signal);onStatus?.('Carregando detector local…');
    const tf=await getRuntime(signal,onStatus);check(signal);
    if(!modelPromise)modelPromise=(async()=>{
      try{return await tf.loadGraphModel(MODEL_URL)}
      catch(localError){
        check(signal);onStatus?.('Baixando detector MoveNet…');
        try{return await loadCachedRemoteModel(tf)}
        catch(remoteError){throw new Error(`Não foi possível abrir o MoveNet local (${localError.message||localError}) nem baixar o fallback oficial (${remoteError.message||remoteError}).`)}}
    })();
    try{const model=await modelPromise;check(signal);return {tf,model}}catch(e){modelPromise=null;throw e}
  }
  function point(values,index){const base=index*3;return {y:values[base],x:values[base+1],score:values[base+2]}}
  function inside(p,margin){return p.x>=margin&&p.x<=1-margin&&p.y>=margin&&p.y<=1-margin}
  function average(xs){return xs.reduce((a,b)=>a+b,0)/xs.length}
  function face(points){const nose=points.nose;const other=[points.leftEye,points.rightEye,points.leftEar,points.rightEar].filter(p=>p.score>=.35);const good=nose.score>=.45&&other.length>=2;return {eligible:good,confidence:Math.max(0,Math.min(1,average([nose.score,...other.map(p=>p.score)])))}}
  function full(points){const required=['nose','leftShoulder','rightShoulder','leftHip','rightHip','leftKnee','rightKnee','leftAnkle','rightAnkle'].map(k=>points[k]);const confident=required.every(p=>p.score>=.35);const inFrame=required.every(p=>inside(p,.035));const center=average(required.map(p=>Math.min(p.x,1-p.x,p.y,1-p.y)))/.2;const confidence=average(required.map(p=>p.score))*Math.max(.35,Math.min(1,center));return {eligible:confident&&inFrame,confidence:Math.max(0,Math.min(1,confidence))}}
  async function prepare(signal,onStatus){await ensure(signal,onStatus);onStatus?.('Detector pronto')}
  async function score(canvas,mode){
    if(mode!=='face'&&mode!=='full')throw new Error('Modo Focus inválido. Use "face" ou "full"; o modo geral é tratado pelo aplicativo.');
    if(!(canvas instanceof HTMLCanvasElement)||canvas.width<2||canvas.height<2)throw new Error('Focus precisa de um canvas válido com pixels para analisar.');
    const {tf,model}=await ensure(null,null);let input,out;
    try{input=tf.tidy(()=>tf.image.resizeBilinear(tf.browser.fromPixels(canvas,3),[SIZE,SIZE],true).expandDims(0).cast('int32'));out=await model.executeAsync(input);const tensor=Array.isArray(out)?out[0]:out;const values=await tensor.data();const points=Object.fromEntries(Object.entries(POINTS).map(([name,index])=>[name,point(values,index)]));return mode==='face'?face(points):full(points)}
    catch(e){throw new Error(`Falha ao analisar pose com MoveNet: ${e.message||e}`)}
    finally{input?.dispose();if(Array.isArray(out))out.forEach(t=>t?.dispose());else out?.dispose()}
  }
  window.AnguloFocus=Object.freeze({prepare,score});
})();
