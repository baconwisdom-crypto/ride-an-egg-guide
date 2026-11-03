/* Shared runtime. Site-specific values live in config/site.json monetization. */
(function (root) {
 'use strict';
 const sizes={banner728:[728,90],banner320:[320,50],rectangle:[300,250],rail:[160,600]};
 const timestamp=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(s)?Date.parse(s):NaN;
 function validate(c){
  if(!c)return;
  if(!['off','scheduled','on'].includes(c.mode))throw Error('Invalid monetization.mode');
  if(c.mode==='off')return;
  if(!Array.isArray(c.hosts)||!c.hosts.length||c.hosts.some(h=>typeof h!=='string'||!/^[a-z0-9.-]+$/.test(h)))throw Error('Exact production hosts required');
  if(c.mode==='scheduled'&&!Number.isFinite(timestamp(c.enableAt)))throw Error('enableAt requires an ISO timestamp with timezone');
  if(!c.units||!Object.keys(c.units).length)throw Error('At least one verified ad unit required');
  for(const [name,u] of Object.entries(c.units)){
   if(!sizes[name]&&name!=='native')throw Error('Unknown ad format: '+name);
   if(!u||!/^https:\/\/[^\s<>"']+$/.test(u.scriptUrl||''))throw Error('HTTPS scriptUrl required: '+name);
   if(name==='native'?!/^[a-zA-Z][\w-]*$/.test(u.containerId||''):!/^[a-f0-9]{32}$/i.test(u.key||''))throw Error('Invalid provider identifier: '+name);
  }
 }
 function eligible(c,host,now){try{validate(c)}catch{return false}return !!c&&c.mode!=='off'&&c.hosts.includes(host)&&(c.mode==='on'||now>=timestamp(c.enableAt))}
 function choose(c,slot,width,height,viewportWidth){
  let name=slot==='articleLeft'?(viewportWidth>=1280&&height>=700&&width>=160?'rail':null):slot==='articleAfterAnswer'&&c.units.native?'native':slot==='articleMiddle'||slot==='homeSidebar'?(width>=300?'rectangle':null):width>=728?'banner728':width>=320?'banner320':null;
  return name&&c.units[name]?name:null;
 }
 function start(c,env=root){
  const doc=env.document;
  if(!c||c.mode==='off')return ()=>{};
  try{validate(c)}catch(e){env.console.error(e.message);return ()=>{}};
  if(env.location.protocol!=='https:'||!c.hosts.includes(env.location.hostname))return ()=>{};
  let stopped=false,timer,retry,serverTime=NaN,anchor=0;
  const clock=()=>serverTime+(env.performance.now()-anchor);
  const slots=[...doc.querySelectorAll('[data-live-ad]')];
  function refresh(){
   if(stopped)return;
   const active=eligible(c,env.location.hostname,clock());
   for(const el of slots){
    // Hidden slots still obtain the available parent width, never force overflow.
    const parent=el.parentElement,style=env.getComputedStyle(parent);
    const width=parent.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0);
    const format=active?choose(c,el.dataset.liveAd,width,env.innerHeight,env.innerWidth):null;
    if(el.dataset.loadedFormat===format)continue;
    el.replaceChildren();el.hidden=true;delete el.dataset.loadedFormat;
    if(!format)continue;
    const u=c.units[format];
    if(format==='native'){
     const container=doc.createElement('div');container.id=u.containerId;
     // A native container ID must be unique on a page.
     if(doc.getElementById(u.containerId))continue;
     const script=doc.createElement('script');script.async=true;script.setAttribute('data-cfasync','false');script.src=u.scriptUrl;
     el.append(container,script);
    }else{
     const [w,h]=sizes[format],frame=doc.createElement('iframe');
     frame.title='Advertisement';frame.width=String(w);frame.height=String(h);frame.style.border='0';
     frame.setAttribute('scrolling','no');
     // Isolate each provider atOptions global and document.write from the article.
     const options=JSON.stringify({key:u.key,format:'iframe',width:w,height:h,params:{}}).replace(/</g,'\\u003c');
     frame.srcdoc='<!doctype html><html><head><base target="_blank"></head><body style="margin:0"><script>var atOptions='+options+';<\/script><script src="'+u.scriptUrl+'"><\/script></body></html>';
     el.append(frame);
    }
    el.hidden=false;el.dataset.loadedFormat=format;
   }
   doc.querySelectorAll('.article-shell,.article-layout').forEach(shell=>shell.classList.toggle('live-ads',!!shell.querySelector('[data-live-ad="articleLeft"]:not([hidden])')));
   timer=env.setTimeout(refresh,1000);
  }
  async function sync(){
   try{
    const response=await env.fetch(env.location.href,{method:'HEAD',cache:'no-store',credentials:'omit',signal:env.AbortSignal.timeout(10000)});
    const date=Date.parse(response.headers.get('date')),age=Number(response.headers.get('age')||0);
    if(!response.ok||!Number.isFinite(date)||!Number.isFinite(age)||age<0)throw Error('Server clock unavailable');
    serverTime=date+age*1000;anchor=env.performance.now();
   }catch(e){env.console.warn('Ads remain closed until server time is available');
    if(!stopped){env.clearTimeout(retry);retry=env.setTimeout(sync,60000)}
   }
   if(!stopped){env.clearTimeout(timer);refresh()}
  }
  const onVisible=()=>{if(doc.visibilityState==='visible')sync()};
  doc.addEventListener('visibilitychange',onVisible);sync();
  return ()=>{stopped=true;env.clearTimeout(timer);env.clearTimeout(retry);doc.removeEventListener('visibilitychange',onVisible)};
 }
 const api={validate,timestamp,eligible,choose,start};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.SiteAds=api;
})(typeof window==='undefined'?globalThis:window);
