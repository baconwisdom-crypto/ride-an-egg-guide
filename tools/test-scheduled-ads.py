"""Real Chromium, intercepted test origin and mock ad scripts. No paid ad requests."""
import copy,json,mimetypes,time,re
from pathlib import Path
from datetime import datetime,timezone
from email.utils import format_datetime
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research/scheduled-ads-20261102';OUT.mkdir(parents=True,exist_ok=True)
NOW=1793620800000
UNITS={name:dict(key=str(i)*32,scriptUrl=f'https://mock-ads.example/{name}.js') for i,name in enumerate(['banner728','banner320','rectangle','rail'],1)}
UNITS['native']=dict(containerId='container-mock-native',scriptUrl='https://mock-ads.example/native.js')
BASE=dict(mode='scheduled',hosts=['ads-test.example'],enableAt=datetime.fromtimestamp((NOW-1000)/1000,timezone.utc).isoformat(),units=UNITS)
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel="chrome")
 def run(slug,width=1440,mode='due',kind='article',wait=250):
  c=copy.deepcopy(BASE)
  if mode=='before':c['enableAt']=datetime.fromtimestamp((NOW+86400000)/1000,timezone.utc).isoformat()
  if mode=='cross':c['enableAt']=datetime.fromtimestamp((NOW+2000)/1000,timezone.utc).isoformat()
  if mode=='off':c['mode']='off'
  if mode=='missing':c['units']={}
  if mode=='wrong-host':c['hosts']=['other.example']
  if mode=='age':c['enableAt']=datetime.fromtimestamp((NOW+59000)/1000,timezone.utc).isoformat()
  if mode=='bad-date':c['enableAt']='2026-11-04T10:00:00'
  page=browser.new_page(viewport={'width':width,'height':900});requests=[];errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route(req):
   url=req.request.url
   if url.startswith('https://mock-ads.example/'):
    requests.append(url);req.fulfill(status=200,content_type='application/javascript',body='document.body.dataset.mockAd="loaded";');return
   if not url.startswith('https://ads-test.example/'):
    req.abort();return
   if req.request.method=='HEAD':
    headers={} if mode=='no-clock' else {'Date':format_datetime(datetime.fromtimestamp(NOW/1000,timezone.utc),usegmt=True)}
    if mode=='age':headers['Age']='60'
    req.fulfill(status=200,headers=headers);return
   f=ROOT/'out'/url.split('https://ads-test.example/',1)[1].split('?')[0]
   if f.is_dir():f=f/'index.html'
   if not f.is_file():req.fulfill(status=404);return
   raw=f.read_bytes()
   if f.suffix=='.html':
    raw=re.sub(r'(<script id="site-monetization" type="application/json">).*?(</script>)',lambda m:m[1]+json.dumps(c)+m[2],raw.decode(),flags=re.S).encode()
   req.fulfill(status=200,body=raw,content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
  page.route('**/*',route)
  # A deliberately incorrect visitor clock must not affect scheduled activation.
  page.add_init_script('Date.now=()=>1;')
  page.goto('https://ads-test.example/'+('index.html' if kind=='home' else 'guides/beginner-guide/'))
  page.wait_for_timeout(wait)
  if errors:raise AssertionError(errors)
  visible=page.locator('[data-live-ad]:not([hidden])').count()
  blocked=mode in ['before','off','missing','wrong-host','bad-date','no-clock']
  if blocked:assert not requests and visible==0,(slug,mode,requests,visible)
  elif mode=='cross':
   assert not requests,(mode,requests)
   page.wait_for_timeout(2400)
   assert requests,(slug,mode,'no activation')
  elif kind=='home' and width==320:assert not requests # 320px ad cannot fit 284px content
  else:assert requests,(slug,width,mode,'no requests')
  if width<1280:assert not any('/rail.' in u for u in requests)
  if width<768:assert not any('/banner728.' in u for u in requests)
  overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
  assert not overflow,(slug,width,mode,'overflow')
  if mode=='due' and width in [1440,390]:page.screenshot(path=str(OUT/f'{slug}-{kind}-{width}.png'),full_page=True)
  if mode=='due' and width==1440 and slug!='steal-a-balut':
   count=len(requests);page.wait_for_timeout(1200);assert len(requests)==count,'duplicate loads'
   page.set_viewport_size({'width':390,'height':900});page.wait_for_timeout(1200)
   assert page.locator('[data-live-ad="articleLeft"]:not([hidden])').count()==0
  results.append(dict(template=slug,width=width,mode=mode,page=kind,requests=requests,status='passed'))
  page.close()
 for slug in ['ride-an-egg']:
  for mode in ['before','off','missing','wrong-host','bad-date','no-clock','cross','age']:run(slug,mode=mode)
  for width in [1440,1280,1024,768,390,320]:run(slug,width=width)
  if slug!='steal-a-balut':
   for width in [1440,390,320]:run(slug,width=width,kind='home')
 # Full route/width release matrix uses only isolated build files and intercepted mock ads.
 from xml.etree import ElementTree as ET
 routes=[e.text.replace('https://www.rideanegg.wiki/','') for e in ET.parse(ROOT/'out/sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
 matrix=[]
 for route_path in routes:
  for width in [1440,1280,1024,768,390,320]:
   page=browser.new_page(viewport={'width':width,'height':900}); errors=[]; ad_requests=[]
   page.on('pageerror',lambda e: errors.append(str(e)))
   def fixture(req):
    url=req.request.url
    if url.startswith('https://mock-ads.example/'):
     ad_requests.append(url);req.fulfill(status=200,content_type='application/javascript',body='document.body.dataset.mockAd="loaded";');return
    if not url.startswith('https://ads-test.example/'):
     req.abort();return
    if req.request.method=='HEAD':
     req.fulfill(status=200,headers={'Date':format_datetime(datetime.fromtimestamp(NOW/1000,timezone.utc),usegmt=True)});return
    f=ROOT/'out'/url.split('https://ads-test.example/',1)[1].split('?')[0]
    if f.is_dir(): f=f/'index.html'
    if not f.is_file():req.fulfill(status=404);return
    raw=f.read_bytes()
    if f.suffix=='.html':
     raw=re.sub(r'(<script id="site-monetization" type="application/json">).*?(</script>)',lambda m:m[1]+json.dumps(BASE)+m[2],raw.decode(),flags=re.S).encode()
    req.fulfill(status=200,body=raw,content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
   page.route('**/*',fixture)
   page.goto('https://ads-test.example/'+route_path)
   for detail in page.locator('main details').all():
    if detail.get_attribute('open') is None: detail.locator('summary').click()
   for img in page.locator('img').all(): img.scroll_into_view_if_needed()
   page.wait_for_timeout(1100)
   checks=page.evaluate("""()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,height:document.documentElement.scrollHeight,badImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.src),empty:[...document.querySelectorAll('main p')].filter(x=>!x.textContent.trim()).length,tiny:[...document.querySelectorAll('main p')].filter(x=>x.textContent.trim().length===1).length,rail:[...document.querySelectorAll('[data-live-ad=articleLeft]:not([hidden])')].map(x=>({width:x.querySelector('iframe')?.width,height:x.querySelector('iframe')?.height,shellWidth:x.getBoundingClientRect().width}))})""")
   assert not errors and not checks['overflow'] and not checks['badImages'] and not checks['empty'] and not checks['tiny'],(route_path,width,checks,errors)
   if width<1280: assert not checks['rail'] and not any('/rail.' in u for u in ad_requests)
   for rail in checks['rail']:assert rail=={'width':'160','height':'600','shellWidth':192},rail
   name=(route_path.strip('/').replace('/','-') or 'home')+'-'+str(width)+'.png'
   page.screenshot(path=str(OUT/name),full_page=True)
   matrix.append(dict(route=route_path,checks=checks,requests=ad_requests,status='passed',evidence='isolated Chrome with intercepted mock ads'))
   page.close()
 (OUT/'layout-matrix.json').write_text(json.dumps(matrix,indent=2),encoding='utf-8')
 print(f'PASS: {len(matrix)} isolated route/width layout checks.')
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(f'PASS: {len(results)} Chromium scenarios. Mock ad requests only. Results: {OUT}')


