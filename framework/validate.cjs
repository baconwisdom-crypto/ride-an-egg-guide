const assert=require('node:assert/strict');
const text=(v,label)=>assert(typeof v==='string'&&v.trim().length>0,label+' must be nonempty text');
const list=(v,label)=>assert(Array.isArray(v),label+' must be an array');
const unique=(v,label)=>assert(new Set(v).size===v.length,label+' must be unique');
const id=(v,label)=>{text(v,label);assert(/^[a-z0-9][a-z0-9-]*$/.test(v),label+' must use lowercase letters, numbers and hyphens')};
function url(v,label,local=false){text(v,label);if(local&&/^public\/[\w./-]+$/.test(v)&&!v.includes('..'))return;assert(/^https?:\/\//.test(v),label+' must use HTTP(S)'+(local?' or public/':''));new URL(v)}
function validate({config:c,content:d}){
 assert(c.schemaVersion===1,'Unsupported schema version');
 for(const k of ['slug','name','mark','storageKey','language'])text(c[k],'config.'+k);
 assert(['landing','sidebar'].includes(c.layout),'Unknown layout');
 for(const k of ['referenceImages','previewAds'])assert(typeof c[k]==='boolean',k+' must be boolean');
 for(const key of ['homeBanner','homeSidebar','articleLeft','articleAfterAnswer','articleMiddle'])assert(typeof c.adPlacements?.[key]==='boolean','adPlacements.'+key+' must be boolean');
 for(const k of ['source','gameUrl','mediaLink'])url(c[k],k);url(c.media,'media',true);
 text(c.mediaAlt,'mediaAlt');text(c.seo.titleSuffix,'titleSuffix');text(c.seo.description,'seo.description');
 const tokens=['bg','fg','card','muted','soft','border','brand','brand-light'];
 for(const mode of ['light','dark'])for(const key of tokens){const v=c.theme[mode][key];text(v,'theme.'+mode+'.'+key);assert(/^(#[0-9a-f]{3,8}|(?:hsl|rgb)a?\([\d.% ,/+-]+\))$/i.test(v),'Invalid color token '+key)}
 assert(/^[a-zA-Z ,"'-]+$/.test(c.theme.fontFamily),'Invalid fontFamily');assert(/^\d+(?:\.\d+)?(?:px|rem)$/.test(c.theme.radius),'Invalid radius');
 const r=d.routes;for(const k of ['home','category','article'])assert(/^[a-z0-9-]+\.html$/.test(r[k]),'routes.'+k+' must be a simple HTML filename');unique(Object.values(r),'route filenames');
 list(d.pages,'pages');assert(d.pages.length,'At least one page is required');
 const s=d.structure;list(s.categories,'categories');assert(s.categories.length,'At least one category is required');s.categories.forEach(c=>text(c,'category'));unique(s.categories.map(c=>c.toLowerCase()),'categories');
 for(const key of ['codesCategory','guideCategory'])assert(s.categories.includes(s.links[key]),'Unknown category reference '+key);
 list(d.codes,'codes');for(const code of d.codes){text(code.code,'code');text(code.reward,'reward')}unique(d.codes.map(c=>c.code),'codes');
 const faq=items=>{list(items,'FAQ');for(const pair of items){assert(Array.isArray(pair)&&pair.length===2,'FAQ must use question/answer pairs');pair.forEach(t=>text(t,'FAQ text'))}};
 faq(s.faq);
 function block(b){assert(b&&typeof b==='object','block must be an object');switch(b.type){
  case 'paragraph':case 'heading':case 'callout':text(b.text,b.type+'.text');break;
  case 'list':list(b.items,'list.items');assert(b.items.length,'list cannot be empty');b.items.forEach(t=>text(t,'list item'));break;
  case 'table':list(b.headers,'table.headers');assert(b.headers.length,'table needs headers');b.headers.forEach(t=>text(t,'table header'));list(b.rows,'table.rows');for(const row of b.rows){assert(Array.isArray(row)&&row.length===b.headers.length,'table row width mismatch');row.forEach(t=>text(t,'table cell'))}break;
  case 'codes':break;
  case 'faq':faq(b.items);break;
  default:throw new Error('Unsupported block type: '+b.type);
 }}
 for(const p of d.pages){id(p.id,'page.id');for(const k of ['title','description'])text(p[k],'page.'+k);assert(s.categories.includes(p.category),'Unregistered category '+p.category);list(p.meta,'page.meta');p.meta.forEach(t=>text(t,'meta'));list(p.sections,'sections');assert(p.sections.length,'page must have sections');unique(p.sections.map(x=>x.id),'section IDs');for(const section of p.sections){id(section.id,'section.id');assert(!['main','app','site-search','mobile-nav'].includes(section.id),'Reserved section id');text(section.title,'section.title');list(section.blocks,'section.blocks');assert(section.blocks.length,'section must contain blocks');section.blocks.forEach(block)}}
 for(const p of d.pages){assert(p.advertising,'Missing advertising anchors');const sectionIds=p.sections.map(s=>s.id);for(const key of ['afterAnswerSectionId','middleSectionId'])assert(p.advertising[key]===null||sectionIds.includes(p.advertising[key]),'Unknown ad section '+key);assert(p.advertising.middleSectionId===null||p.advertising.middleSectionId!==p.advertising.afterAnswerSectionId,'Ad anchors must be distinct')}
 unique(d.pages.map(p=>p.id),'page IDs');const ids=new Set(d.pages.map(p=>p.id));
 const home=s.home;for(const k of ['tagline','description','resourcesIntro','codesIntro','codesNotice','ctaTitle','ctaDescription'])text(home[k],'home.'+k);
 for(const k of ['featuredIds','journeyIds']){list(home[k],k);assert(home[k].length,k+' cannot be empty');unique(home[k],k);home[k].forEach(x=>assert(ids.has(x),'Unknown page reference '+x))}
 for(const k of ['stats','facts']){list(home[k],k);home[k].forEach(pair=>{assert(Array.isArray(pair)&&pair.length===2,k+' must use pairs');pair.forEach(t=>text(t,k))})}
 list(home.sections,'home.sections');unique(home.sections.map(x=>x.id),'home section IDs');for(const x of home.sections){id(x.id,'home section ID');assert(!['main','app','codes','site-search','mobile-nav'].includes(x.id),'Reserved home section ID');text(x.title,'home section title');text(x.description,'home section description');list(x.items,'home section items');for(const item of x.items){text(item.title,'item title');text(item.description,'item description');assert(ids.has(item.pageId),'Unknown page reference '+item.pageId)}}
 for(const k of ['exampleLabel','codeSuffix','mediaLabel','footerDescription','footerNote','categoryDescription','categoryIntro'])text(s.ui[k],'ui.'+k);faq(s.ui.categoryBenefits);
 list(d.sources,'sources');unique(d.sources.map(x=>x.id),'source IDs');for(const x of d.sources){id(x.id,'source.id');url(x.url,'source.url');text(x.role,'source.role')}
 return true;
}
module.exports={validate};
