"""Consumer actions on a disposable local database only. No platform calls.
Synthetic observations remain for the startup/restart smoke, then that project is removed.
"""
import datetime,json,os,re,subprocess,uuid
from urllib.request import Request,urlopen
from html.parser import HTMLParser
from zoneinfo import ZoneInfo
BASE=os.environ.get('SMOKE_BASE_URL','http://127.0.0.1:3002')
if os.environ.get('FMF_ALLOW_ISOLATED_SMOKE')!='true' or not os.environ.get('COMPOSE_PROJECT_NAME','').startswith('fmf_product_verification'):raise ValueError('Requires explicit disposable product-verification database')
if not re.fullmatch(r'http://127\.0\.0\.1:\d+',BASE):raise ValueError('Loopback app only')
class Page(HTMLParser):
 def __init__(self):super().__init__();self.text=[];self.forms=[];self.form=None;self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a':self.links.append(a.get('href',''))
  if tag=='form':self.form={'hidden':[],'fields':set()};self.forms.append(self.form)
  if self.form is not None and tag in ['input','select','textarea'] and a.get('name'):
   self.form['fields'].add(a['name'])
   if a.get('type')=='hidden':self.form['hidden'].append((a['name'],a.get('value','')))
 def handle_endtag(self,tag):
  if tag=='form':self.form=None
 def handle_data(self,data):self.text.append(data)
def get(path):
 p=Page();r=urlopen(BASE+path);assert r.status==200;p.feed(r.read().decode());return p
def sql(q):return subprocess.check_output(['docker','compose','exec','-T','db','psql','-U','finder','-d','free_money_finder','-At','-v','ON_ERROR_STOP=1','-c',q],text=True).strip()
def submit(path,field,values,form=None):
 if form is None:form=next(f for f in get(path).forms if field in f['fields'])
 boundary='Finder'+uuid.uuid4().hex;chunks=[]
 for k,v in [(k,v) for k,v in form['hidden'] if k not in values]+list(values.items()):chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
 chunks.append(f'--{boundary}--\r\n'.encode());p=Page();p.feed(urlopen(Request(BASE+path,data=b''.join(chunks),headers={'Origin':BASE,'Content-Type':f'multipart/form-data; boundary={boundary}'})).read().decode());return ' '.join(p.text)
home=get('/')
if 'Check your eligibility' in ' '.join(home.text):
 assert 'Eligibility settings saved' in submit('/','age',dict(age='21',state='KS',country='US'))
 home=get('/')
text=' '.join(' '.join(home.text).split())
for expected in ['GET MY FREE MONEY','High 5 Casino','RealPrize','Your money deposited','$0','No verified sportsbook','FREE MONEY FINDER IS READY','Local background checks ON']:assert expected in text,expected
assert 'Fictional' not in text and 'Free daily promotional coin' not in text
assert sql('SELECT count(*) FROM bankroll_ledger l JOIN bankroll_accounts a ON a.id=l."accountId" WHERE NOT a.demo')=='0'
assert 'INSUFFICIENT VERIFIED GAME DATA' not in text # Detailed engine status belongs behind account details.
assert 'No verified free credits' in ' '.join(get('/sportsbook').text)
for path in ['/casinos','/sportsbook','/history','/advanced','/accounts/high-5-casino','/accounts/realprize']:get(path);print('PASS',path)
assert 'Isolated fictional simulation' in ' '.join(get('/advanced').text)
assert submit('/','__check__',{},get('/').forms[0]) # First home form is the orchestrator for the configured profile.
assert sql("SELECT count(*) FROM product_runs WHERE trigger='MANUAL' AND outcome='COMPLETE'")!='0'
path='/accounts/realprize';aid=sql("SELECT a.id FROM bankroll_accounts a JOIN platforms p ON p.id=a.\"platformId\" WHERE p.slug='realprize' AND a.key='real:'||p.id")
values=dict(balance='5',redeemable='',playable='',claimed='UNKNOWN',received='',checked='yes',rewardKind='UNKNOWN',rewardScope='RECURRING',gc='',receivedGC='',playthroughRemaining='',redemptionMinimum='',nextRewardAt='',minutes='1',notes='Synthetic disposable verification only',freeOnly='yes')
assert 'Account updated' in submit(path,'claimed',values)
assert sql(f'''SELECT count(*) FROM bankroll_ledger WHERE "accountId"='{aid}' AND "eventType"='FREE_REWARD_RECEIVED' ''')=='0'
values.update(balance='6',claimed='YES',received='1',rewardKind='UNKNOWN')
form=next(f for f in get(path).forms if 'claimed' in f['fields'])
assert 'Account updated' in submit(path,'claimed',values,form)
assert 'Account updated' in submit(path,'claimed',values,form)
assert sql(f'''SELECT count(*) FROM bankroll_ledger WHERE "accountId"='{aid}' AND "eventType"='FREE_REWARD_RECEIVED' ''')=='1'
assert sql(f"SELECT count(*) FROM bankroll_ledger WHERE \"accountId\"='{aid}' AND key LIKE 'claim-receipt:%'")=='1'
assert submit('/','__check__',{},get('/').forms[0])
assert sql(f"SELECT count(*) FROM bankroll_ledger WHERE \"accountId\"='{aid}' AND \"eventType\"='FREE_REWARD_RECEIVED'")=='1'
assert 'Account updated' not in submit(path,'claimed',dict(values,freeOnly='no'))
values.update(balance='6',redeemable='2',playable='4',claimed='UNKNOWN',received='',rewardKind='UNKNOWN',playthroughRemaining='0')
assert 'Account updated' in submit(path,'claimed',values)
assert 'STOP PLAYING' in ' '.join(get(path).text)
assert 'REDEEM NOW' in ' '.join(get('/').text)
play=dict(game='Synthetic',start='4',wager='1',end='3',result='LOSS',contribution='1',minutes='1',freeOnly='yes')
assert 'STOP PLAYING' in submit(path,'game',play)
now=datetime.datetime.now(ZoneInfo('America/Chicago')).replace(second=0,microsecond=0).isoformat()[:16]
red=dict(redemptionId='',requestedSC='2',receivedUSD='',requestedAt=now,completedAt='',status='REQUESTED',method='UNKNOWN',minutes='1',freeOnly='yes')
assert 'Redemption recorded' in submit(path,'requestedSC',red)
rid=sql(f'''SELECT id FROM account_redemptions WHERE "accountId"='{aid}' ''')
assert 'Redemption recorded' in submit(path,'requestedSC',dict(red,redemptionId=rid,status='COMPLETED',completedAt=now,receivedUSD='1.80'))
assert sql(f'''SELECT "receivedUSD" FROM account_redemptions WHERE id='{rid}' ''')=='1.80'
assert 'free reward received' in ' '.join(get('/history').text)
assert 'redemption completed' in ' '.join(get('/history').text)
assert 'Actually redeemed' in ' '.join(get('/').text)
assert sql('SELECT sum("userCashContribution") FROM bankroll_ledger')=='0.00'
assert sql("SELECT count(*) FROM bankroll_ledger WHERE currency='GC' AND \"actualCashAmount\" IS NOT NULL")=='0'
assert sql("SELECT count(*) FROM bankroll_accounts WHERE demo=false AND engine='SPORTSBOOK'")=='0'
print('PASS consumer dashboard, separation, check, manual fallback, corrections, confirmed receipt, replay, free-only rejection, stop/redeem, actual cash, history and zero contribution')
