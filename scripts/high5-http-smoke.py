"""Local High5 forms exercised against an isolated, temporary bookkeeping account."""
import os, re, uuid, subprocess, datetime
from urllib.request import Request, urlopen
from html.parser import HTMLParser
BASE=os.environ.get('SMOKE_BASE_URL','http://127.0.0.1:3000')
if not re.fullmatch(r'http://(127\.0\.0\.1|localhost):\d+',BASE):raise ValueError('Local app required')
class Page(HTMLParser):
 def __init__(self):super().__init__();self.forms=[];self.current=None;self.text=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='form':self.current={'hidden':[],'fields':set()};self.forms.append(self.current)
  if self.current is not None and tag in ['input','select','textarea'] and a.get('name'):
   self.current['fields'].add(a['name'])
   if a.get('type')=='hidden':self.current['hidden'].append((a['name'],a.get('value','')))
 def handle_endtag(self,tag):
  if tag=='form':self.current=None
 def handle_data(self,s):self.text.append(s)
def get(path):
 r=urlopen(BASE+path);p=Page();p.feed(r.read().decode());assert r.status==200;return p
def sql(q):return subprocess.check_output(['docker','compose','exec','-T','db','psql','-U','finder','-d','free_money_finder','-At','-v','ON_ERROR_STOP=1','-c',q],text=True).strip()
account=str(uuid.uuid4())
def post(field,values):
 # Use only the named High5 form, with the test account overriding its hidden ID.
 f=next(f for f in get('/high5').forms if field in f['fields']);values=dict(values,accountId=account,submissionKey=str(uuid.uuid4()));boundary='High5'+uuid.uuid4().hex
 chunks=[f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k,v in [(k,v) for k,v in f['hidden'] if k not in values]+list(values.items())]+[f'--{boundary}--\r\n'.encode()]
 p=Page();p.feed(urlopen(Request(BASE+'/high5',data=b''.join(chunks),headers={'Origin':BASE,'Content-Type':'multipart/form-data; boundary='+boundary})).read().decode());return ' '.join(p.text)
for path,expected in [('/high5','QUICK ACCOUNT UPDATE'),('/high5/experiment','EXPERIMENT'),('/','Reward currency and amount may vary')]:assert expected in ' '.join(get(path).text);print('PASS',path)
pid=sql("SELECT id FROM platforms WHERE slug='high-5-casino'")
sql(f'''INSERT INTO bankroll_accounts (id,"platformId",engine,demo,label,key) VALUES ('{account}','{pid}','CASINO',false,'Synthetic temporary High5 HTTP test','http-high5:{account}')''')
try:
 update=dict(checkedReward='yes',rewardKind='SC_ONLY',rewardClaimed='YES',rewardScope='OTHER',rewardSC='100',rewardGC='',gc='1000',sc='100',playableSC='100',redeemableSC='0',playthroughRequired='1',playthroughPlayed='0',playthroughRemaining='1',redemptionMinimum='',nextRewardAt='',notes='Synthetic local smoke test; not actual activity',minutes='1',freeOnly='yes',legacyOfferId='',otherReward='')
 assert 'High 5 observation saved' in post('rewardKind',update)
 assert 'High 5 observation saved' in post('rewardKind',update)
 assert sql(f'''SELECT count(*) FROM bankroll_ledger WHERE "accountId"='{account}' AND "eventType"='FREE_REWARD_RECEIVED' ''')=='1'
 bad=dict(update,freeOnly='no');assert 'High 5 observation saved' not in post('rewardKind',bad)
 play=dict(game='Synthetic test game',start='100',wager='0.10',result='LOSS',end='99.90',contribution='0.10',minutes='1',freeOnly='yes')
 assert 'Impossible' in post('game',dict(play,end='99.80'))
 assert 'Already-performed manual play recorded' in post('game',play)
 assert sql(f'''SELECT payload->>'playthroughRemaining' FROM high5_updates WHERE "accountId"='{account}' ORDER BY sequence DESC LIMIT 1''')=='0.90'
 redeemable=dict(update,checkedReward='',rewardKind='UNKNOWN',rewardClaimed='UNKNOWN',rewardSC='',sc='99.90',playableSC='39.90',redeemableSC='60',playthroughRequired='',playthroughPlayed='',playthroughRemaining='0')
 assert 'High 5 observation saved' in post('rewardKind',redeemable)
 assert sql(f'''SELECT count(*) FROM operational_actions WHERE "accountId"='{account}' AND "actionType"='REQUEST_REDEMPTION' AND status='PENDING' AND "executionMode"='MANUAL_REQUIRED' ''')=='1'
 assert 'STOP PLAYING' in post('game',dict(play,start='39.90',end='39.80'))
 date=datetime.datetime.now(datetime.timezone.utc).astimezone(__import__('zoneinfo').ZoneInfo('America/Chicago')).date().isoformat()
 redemption=dict(redemptionId='',requestedSC='60',receivedUSD='',requestedAt=date,completedAt='',method='PRIZEOUT',status='REQUESTED',minutes='1',freeOnly='yes')
 assert 'Manual redemption recorded' in post('requestedSC',redemption)
 rid=sql(f'''SELECT id FROM high5_redemptions WHERE "accountId"='{account}' ''')
 assert 'Manual redemption recorded' in post('requestedSC',dict(redemption,redemptionId=rid,receivedUSD='55',status='COMPLETED',completedAt=date))
 assert sql(f'''SELECT "receivedUSD" FROM high5_redemptions WHERE id='{rid}' ''')=='55.00'
 assert sql(f'''SELECT count(*) FROM bankroll_ledger WHERE "accountId"='{account}' AND currency='GC' AND "actualCashAmount" IS NOT NULL''')=='0'
 assert sql(f'''SELECT sum("userCashContribution") FROM bankroll_ledger WHERE "accountId"='{account}' ''')=='0.00'
 print('PASS High5 real manual observations, replay, unknown/GC separation, free-only rejection, play arithmetic/progress, STOP PLAYING and manual redemption')
finally:
 sql(f'''DELETE FROM bankroll_accounts WHERE id='{account}' ''')
 print('Temporary High5 HTTP bookkeeping account removed.')
