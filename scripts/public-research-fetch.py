"""Explicit public research, not unattended automation. Fixed official registry URLs only.
No authentication, cookies, retries, proxies, browser imitation or access-control bypass.
"""
import concurrent.futures,datetime,hashlib,json,re,urllib.request
from urllib.parse import urlparse
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location("public_text",Path(__file__).with_name("high5-public-fetch.py"));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
PublicText=module.PublicText
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,url):
  old,new=urlparse(req.full_url),urlparse(url)
  if new.scheme!='https' or new.hostname.removeprefix('www.')!=old.hostname.removeprefix('www.'):raise ValueError('Different-origin redirect; manual research required')
  return super().redirect_request(req,fp,code,msg,headers,url)
def fetch(item):
 slug,url=item;row=dict(slug=slug,sourceUrl=url,retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 try:
  response=urllib.request.build_opener(Redirect()).open(url,timeout=12);raw=response.read(1500001)
  if len(raw)>1500000:raise ValueError('Document exceeds bounded size')
  if 'pdf' in response.headers.get('Content-Type',''):raise ValueError('PDF requires manual primary review')
  parser=PublicText();parser.feed(raw.decode(errors='replace'));text=''.join(parser.parts)
  lines=[' '.join(x.split()) for x in text.splitlines() if x.strip()]
  relevant=[x for x in lines if re.search(r'free|daily|sweep|redeem|purchase|deposit|Kansas|prohibit|automat|minimum|eligib|age|21|18',x,re.I)]
  excerpt='\n'.join(relevant)[:12000]
  if len(excerpt)<80:raise ValueError('No substantive visible primary text; needs manual verification')
  row.update(outcome='READABLE',fingerprint=hashlib.sha256(excerpt.encode()).hexdigest(),excerpt=excerpt,notes='Explicit public read. Reachability is not eligibility evidence; typed facts were not renewed.')
 except Exception as e:row.update(outcome='ACCESS_FAILED',fingerprint=None,excerpt='',notes=str(e)[:300])
 return row
if __name__=='__main__':
 candidates=json.loads(Path('research/candidates.json').read_text());review=json.loads(Path('research/reviewed-findings.json').read_text())
 items=[]
 for c in candidates:
  r=next((r for r in review['platforms'] if r['slug']==c['slug']),{})
  urls=[s['sourceUrl'] for s in r.get('sources',[]) if s.get('field')!='access' and s.get('extractedText')]
  # Prefer actual current official rules/free terms, then the registered homepage.
  urls=list(dict.fromkeys(urls+[c['homepageUrl']]))[:2]
  items.extend((c['slug'],u) for u in urls if urlparse(u).scheme=='https')
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:rows=list(executor.map(fetch,items))
 Path('research/product-public-captures.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False)+'\n')
 print(json.dumps({'candidates':len(candidates),'sources':len(rows),'readable':sum(r['outcome']=='READABLE' for r in rows),'failed':sum(r['outcome']=='ACCESS_FAILED' for r in rows)}))
