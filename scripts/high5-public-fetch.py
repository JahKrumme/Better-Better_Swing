"""Explicit, bounded public High 5 research. No login, cookies, retries or browser automation."""
import datetime, hashlib, json, re, urllib.request
from html.parser import HTMLParser
SOURCES={
 'rules':'https://high5casino.com/sweepstakes-rules/',
 'free':'https://high5casino.com/helpcenter/how-to-get-free-sweeps-coins/',
 'redemption':'https://high5casino.com/helpcenter/how-to-redeem-real-prizes/',
 'playthrough':'https://high5casino.com/helpcenter/playthrough/',
 'games':'https://high5casino.com/games/',
 'terms':'https://high5casino.com/terms-of-use/',
}
class PublicRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,url):
  from urllib.parse import urlparse
  p=urlparse(url)
  if p.scheme!='https' or p.hostname!='high5casino.com':raise ValueError('Unexpected public-source redirect')
  return super().redirect_request(req,fp,code,msg,headers,url)
class PublicText(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,t,a):
  if t in ['script','style','noscript']:self.skip+=1
  if t in ['p','li','h1','h2','h3','tr','br']:self.parts.append('\n')
 def handle_endtag(self,t):
  if t in ['script','style','noscript']:self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip:self.parts.append(d)
def excerpt(text,prefix):
 lines=[' '.join(x.split()) for x in text.splitlines() if x.strip()]
 return next((x[:1000] for x in lines if x.startswith(prefix)), '')
def extract(key,text):
 if key=='rules':return {k:excerpt(text,p) for k,p in {'geography':'2.1 The Sponsor','freeAccount':'6.1 To participate','daily':'6.2.1 Receive','automation':'7.5 The use','playthrough':'7.7 Sweeps','minimum':'8.2 You must'}.items()}
 if key=='free':return {'signup':excerpt(text,'Sign-up bonus:'),'daily':excerpt(text,'Daily Harvest:')}
 if key=='redemption':
  flat=' '.join(text.split())
  def section(start,end):
   a=flat.find(start);b=flat.find(end,a+len(start)) if a>=0 else -1
   return flat[a:b if b>a else a+800][:1000] if a>=0 else ''
  return {'prizeout':section('Prizeout – Digital Cards','Unavailable For Redemptions'),'trustly':section('Trustly – Bank Transfer','Prizeout – Digital Cards'),'menuCondition':excerpt(text,'Those options will appear'),'defaultMethod':excerpt(text,'If not, Prizeout'),'skrill':section('Skrill – E-Wallet','Trustly – Bank Transfer')}
 if key=='playthrough':return {'example':excerpt(text,'With a 3x goal'),'illustration':excerpt(text,'Picture this:'),'requirements':excerpt(text,'Once you’ve hit')}
 if key=='games':return {'catalogue':excerpt(text,'1,500+ Options:')}
 lines=[' '.join(x.split()) for x in text.splitlines() if x.strip()]
 return {'policy': ' '.join(x for x in lines if re.search(r'\b(bots?|automated|robots?)\b',x,re.I))[:1000] or ''}
def fingerprint(excerpts):return hashlib.sha256(json.dumps(excerpts,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def fetch(archive_dir=None):
 opener=urllib.request.build_opener(PublicRedirect())
 out=[]
 for key,url in SOURCES.items():
  row=dict(sourceKey=key,sourceUrl=url,retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
  try:
   response=opener.open(url,timeout=12);raw=response.read(1500001)
   if len(raw)>1500000:raise ValueError('Public document exceeds size limit')
   parser=PublicText();parser.feed(raw.decode(errors='replace'));text=''.join(parser.parts);excerpts=extract(key,text)
   if archive_dir is not None:(archive_dir / (key+'.txt')).write_text(text)
   excerpts['documentDigest']=hashlib.sha256(' '.join(text.split()).encode()).hexdigest()
   if key in ['rules','free','redemption'] and any(not x for x in excerpts.values()):raise ValueError('Required public passages not found; manual review needed')
   row.update(outcome='READABLE',excerpts=excerpts,fingerprint=fingerprint(excerpts),notes='Explicit public-source read; no authenticated pages or automatic account actions.')
  except Exception as e:row.update(outcome='ACCESS_FAILED',excerpts={},fingerprint=None,notes=str(e)[:300])
  out.append(row)
 return out
if __name__=='__main__':print(json.dumps(fetch(),ensure_ascii=False))
