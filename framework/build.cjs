const fs=require('node:fs'),path=require('node:path');
const {validate}=require('./validate.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(dir){return {config:read(path.join(dir,'config/site.json')),content:Object.fromEntries(['pages','structure','codes','routes','sources'].map(n=>[n,read(path.join(dir,'content',n+'.json'))]))}}
function build(dir){
 dir=path.resolve(dir);const data=load(dir);validate(data);const c=data.config;
 fs.mkdirSync(path.join(dir,'generated'),{recursive:true});fs.mkdirSync(path.join(dir,'framework'),{recursive:true});
 for(const name of ['app.js','styles.css','validate.cjs','build.cjs']){const source=path.join(__dirname,name),target=path.join(dir,'framework',name);if(path.resolve(source)!==path.resolve(target))fs.copyFileSync(source,target)}
 fs.writeFileSync(path.join(dir,'generated/site-data.js'),'// Generated from config/ and content/. Do not edit.\nwindow.SITE_DATA = '+JSON.stringify(data,null,2).replace(/</g,'\\u003c')+';\n');
 const declarations=t=>Object.entries(t).map(([k,v])=>'--'+k+':'+v+';').join('');
 fs.writeFileSync(path.join(dir,'generated/theme.css'),'/* Generated from config/site.json */\n:root{'+declarations(c.theme.light)+'--radius:'+c.theme.radius+';font-family:'+c.theme.fontFamily+'}\nhtml.dark{'+declarations(c.theme.dark)+'}\n');
 for(const [kind,filename] of Object.entries(data.content.routes)){
 const html=`<!doctype html><html lang="${escape(c.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="${escape(c.seo.description)}"><title>${escape(c.name+c.seo.titleSuffix)}</title><link rel="icon" href="public/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="framework/styles.css"><link rel="stylesheet" href="generated/theme.css"><script src="generated/site-data.js" defer></script><script src="framework/app.js" defer></script></head><body data-page="${kind}"><div id="app"></div><noscript>This local template requires JavaScript.</noscript></body></html>`;
 fs.writeFileSync(path.join(dir,filename),html);
 }
 fs.writeFileSync(path.join(dir,'public/favicon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${escape(c.theme.light.brand)}"/><text x="32" y="45" text-anchor="middle" font-family="Arial" font-size="40" font-weight="bold" fill="white">${escape(c.mark)}</text></svg>`);
 fs.writeFileSync(path.join(dir,'robots.txt'),'User-agent: *\nDisallow: /\n');
 console.log('Built '+dir+' ('+data.content.pages.length+' pages; '+c.layout+' layout)');return data;
}
module.exports={load,build};
if(require.main===module){try{for(const dir of process.argv.slice(2).length?process.argv.slice(2):['.'])build(dir)}catch(e){console.error('Build failed: '+e.message);process.exitCode=1}}
