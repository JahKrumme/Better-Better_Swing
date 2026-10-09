"""Local-only functional checks. Temporary synthetic records are always removed."""
import os, re, uuid, subprocess, json, datetime
from urllib.request import Request, urlopen
from html.parser import HTMLParser
BASE=os.environ.get('SMOKE_BASE_URL','http://127.0.0.1:3000')
if not re.fullmatch(r'http://(127\.0\.0\.1|localhost):\d+',BASE):raise ValueError('Smoke tests only target a local app')
class Page(HTMLParser):
 def __init__(self):super().__init__();self.forms=[];self.current=None;self.text=[];self.articles=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='article':self.articles+=1
  if tag=='form':self.current={'hidden':[],'fields':set()};self.forms.append(self.current)
  if self.current is not None and tag in ['input','select','textarea'] and a.get('name'):
   self.current['fields'].add(a['name'])
   if a.get('type')=='hidden':self.current['hidden'].append((a['name'],a.get('value','')))
 def handle_endtag(self,tag):
  if tag=='form':self.current=None
 def handle_data(self,data):self.text.append(data)
def get(path):
 r=urlopen(BASE+path);p=Page();p.feed(r.read().decode());assert r.status==200;return p
def find(path,fields,values):
 return next(f for f in get(path).forms if set(fields)<=f['fields'] and all(k not in values or values[k]==v for k,v in f['hidden']))
def post(path,fields,values):
 f=find(path,fields,values);boundary='Finder'+uuid.uuid4().hex;chunks=[]
 for key,value in [(k,v) for k,v in f['hidden'] if k not in values]+list(values.items()):chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
 chunks.append(f'--{boundary}--\r\n'.encode())
 r=urlopen(Request(BASE+path,data=b''.join(chunks),headers={'Origin':BASE,'Content-Type':'multipart/form-data; boundary='+boundary}));p=Page();p.feed(r.read().decode());return ' '.join(p.text)
def sql(q):return subprocess.check_output(['docker','compose','exec','-T','db','psql','-U','finder','-d','free_money_finder','-At','-v','ON_ERROR_STOP=1','-c',q],text=True).strip()
# A populated research dataset replaces the old empty real-offer baseline.
real_count=int(sql('SELECT count(*) FROM offers o JOIN platforms p ON p.id=o."platformId" WHERE NOT o.fixture AND NOT p.fixture'))
amoe_count=int(sql("""SELECT count(*) FROM offers o JOIN platforms p ON p.id=o."platformId" WHERE NOT o.fixture AND NOT p.fixture AND (o."offerType"='amoe' OR o."amoeAvailable"=true)"""))
for path,expected,count in [('/', 'FREE MONEY AVAILABLE TODAY',0),('/overview', 'What can you collect without spending?',real_count+amoe_count+4),('/casinos','Free-value engine',4),('/sportsbook','SPORTS BETTING',0),('/bankroll','PROMOTIONAL BANKROLL LEDGER',0),('/demo','SIMULATION ONLY',0),('/offers','Real offer research',real_count),('/offers?dataset=fixtures','Fictional development fixtures',5),('/offers?dataset=fixtures&filter=daily','Free daily promotional coin',1),('/platforms','Platform research registry',21),('/platforms?dataset=fixtures','Fictional platform fixtures',2),('/claims','No manual claims recorded.',0),('/earnings','Actual redeemed value',0),('/research','Append source evidence',0)]:
 p=get(path);assert expected in ' '.join(p.text) and p.articles==count,(path,p.articles);print('PASS',path)
real=get('/offers');assert 'Free registration component' in ' '.join(real.text)
for title in json.loads(sql('SELECT json_agg(title) FROM offers WHERE fixture')):
 assert title not in ' '.join(real.text),('Fixture leaked into real offers',title)
for title in json.loads(sql('SELECT json_agg(o.title) FROM offers o JOIN platforms p ON p.id=o."platformId" WHERE NOT o.fixture AND NOT p.fixture')):
 assert title in ' '.join(real.text),('Real research offer missing',title)
assert 'subtotal is incomplete' in ' '.join(get('/overview').text)
assert '55.00' in ' '.join(real.text)
registry=get('/platforms');assert 'OFFICIAL SOURCE ACCESS BLOCKED' in ' '.join(registry.text)
assert 'PROHIBITED' in ' '.join(registry.text)
assert get('/offers?section=AVAILABLE%20NOW').articles==4
assert get('/offers?section=EXCLUDED').articles==8
assert get('/offers?section=NEEDS%20VERIFICATION').articles==8
slug='http-synthetic-'+uuid.uuid4().hex
demo_id=None
try:
 response=post('/research',['slug','name'],dict(name='Synthetic HTTP platform — not a real platform',slug=slug,homepageUrl='https://http-synthetic.example',category='sweepstakes_casino',termsUrl='',promotionsUrl=''));assert 'Platform saved.' in response
 pid=sql(f"SELECT id FROM platforms WHERE slug='{slug}'");assert pid
 values=dict(platformId=pid,title='Synthetic daily HTTP reward — not a real promotion',description='Temporary local form test, deleted immediately.',offerType='daily',promotionalAmount='10',promotionalCurrency='synthetic credits',estimatedCashValue='',minimumRedemption='20',playthroughRequirement='1x',sourceUrl='https://http-synthetic.example/rules',minimumAge='21',signupRequired='no',identityVerificationRequired='yes',depositRequired='no',purchaseRequired='no',paidWagerRequired='no',subscriptionRequired='no',monetaryContributionRequired='no',entryFeeRequired='no',countries='US',states='KS',excludedStates='',startDate='',expirationDate='',sourceType='official',capturedAt=datetime.datetime.now(datetime.timezone.utc).date().isoformat(),amoeAvailable='unknown',postageRequired='unknown',amoeMethod='',amoeOtherUserCost='',recurrenceTimezone='America/Chicago')
 fields=['depositRequired','purchaseRequired','paidWagerRequired','subscriptionRequired','monetaryContributionRequired','minimumAge','geographicEligibility','signupRequired','identityVerificationRequired','rewardTerms','entryFeeRequired','playthroughRequirement','minimumRedemption','recurrence','acquisition','expirationDate']
 for field in fields:values['evidence_'+field]='Synthetic source support — not real public evidence.'
 response=post('/research',['title','platformId'],values);assert 'Offer and evidence saved.' in response
 oid=sql(f'''SELECT id FROM offers WHERE "platformId"='{pid}' ''');assert oid
 post('/',[],{})
 # This process requires a synthetic adult server profile for eligible test records.
 response=post('/offers',['offerId','received'],dict(offerId=oid,received='10'));assert 'Manual claim recorded.' in response
 assert sql(f'''SELECT count(*) FROM claims WHERE "offerId"='{oid}' AND "claimState"='CLAIMED' ''')=='1'
 assert sql(f'''SELECT count(*) FROM claims WHERE "offerId"='{oid}' AND "claimState"='UNCLAIMED' ''')=='1'
 response=post('/offers',['offerId','received'],dict(offerId=oid,received='10'));assert 'already been claimed' in response
 post('/',[],{})
 aid=sql(f"SELECT id FROM bankroll_accounts WHERE \"platformId\"='{pid}' AND NOT demo");assert aid
 assert sql(f"SELECT count(*) FROM bankroll_ledger WHERE \"accountId\"='{aid}' AND \"eventType\"='FREE_REWARD_RECEIVED'")=='1'
 def ledger(kind,amount,category,**extra):
  values=dict(accountId=aid,eventType=kind,currency='synthetic credits',amount=amount,category=category,relatedEventId='',actualCashAmount='',notes='Synthetic HTTP manual result; not an actual platform event.');values.update(extra)
  return post('/bankroll',['accountId','eventType'],values)
 assert 'Manual ledger event recorded' in ledger('PROMOTIONAL_ACTIVATED','10','PLAYABLE')
 assert 'Manual ledger event recorded' in ledger('BECAME_REDEEMABLE','5','PLAYABLE')
 post('/',[],{});assert 'STOP PLAYING' in ' '.join(get('/bankroll').text)
 assert 'Manual ledger event recorded' in ledger('REDEMPTION_REQUESTED','5','REDEEMABLE')
 rid=sql(f"SELECT id FROM bankroll_ledger WHERE \"accountId\"='{aid}' AND \"eventType\"='REDEMPTION_REQUESTED'")
 assert 'Manual ledger event recorded' in ledger('REDEMPTION_COMPLETED','5','REDEEMED',relatedEventId=rid,actualCashAmount='2.50')
 assert 'open request' in ledger('REDEMPTION_COMPLETED','5','REDEEMED',relatedEventId=rid,actualCashAmount='2.50')
 # Local deterministic demo; every HTTP-created run/account is removed below.
 assert 'New SIMULATED run created' in post('/demo',[],{})
 demo_id=sql('SELECT id FROM demo_runs ORDER BY "createdAt" DESC LIMIT 1');assert demo_id
 for step in range(11):
  response=post('/demo',['runId','step'],dict(runId=demo_id,step=str(step)));assert 'Simulation advanced' in response,(step,response[-500:])
 assert 'Simulation complete' in ' '.join(get('/demo').text)
 assert 'DEMO SC' not in ' '.join(get('/bankroll').text)
 assert sql(f"SELECT step FROM demo_runs WHERE id='{demo_id}'")=='11'
 print('PASS Today refresh, receipt import, manual ledger, redemption reservation/completion and full isolated demo')
 response=post('/research',['offerId','field'],dict(offerId=oid,sourceUrl='https://http-synthetic.example/rules',sourceType='official',field='depositRequired',extractedText='Synthetic contradictory passage',normalizedValue='true',capturedAt=values['capturedAt'],conflicting='yes',applyToTerms='no'));assert 'Evidence appended.' in response
 p=get('/offers');assert 'NEEDS_VERIFICATION' in ' '.join(p.text) and 'Conflicting official evidence' in ' '.join(p.text)
 eid=sql(f'''SELECT id FROM offer_evidence WHERE "offerId"='{oid}' AND conflicting=true ''')
 response=post('/research',['evidenceId','reason'],dict(evidenceId=eid,reason='Synthetic test evidence resolved against current primary source.'));assert 'Evidence superseded' in response
 response=post('/research',['platformId','field','value'],dict(platformId=pid,field='minimumAge',value='21',sourceUrl=values['sourceUrl'],extractedText='Synthetic 21+ platform passage',capturedAt=values['capturedAt']));assert 'Platform fact' in response
 response=post('/research',['platformId','field','value'],dict(platformId=pid,field='kansasAvailability',value='true',sourceUrl=values['sourceUrl'],extractedText='Synthetic Kansas availability passage',capturedAt=values['capturedAt']));assert 'Platform fact' in response
 assert sql(f'''SELECT count(*) FROM platform_sources WHERE "platformId"='{pid}' ''')=='2'
 response=post('/research',['offerId','field'],dict(offerId=oid,sourceUrl=values['sourceUrl'],sourceType='official',field='playthroughRequirement',extractedText='Synthetic reviewed 1x playthrough passage',normalizedValue='1x',capturedAt=values['capturedAt'],conflicting='no',applyToTerms='yes'));assert 'Evidence appended.' in response
 assert sql(f"SELECT \"playthroughRequirement\" FROM offers WHERE id='{oid}'")=='1x'
 online=dict(values);online.update(title='Synthetic online AMOE — not real',offerType='amoe',amoeAvailable='yes',amoeMethod='online form',postageRequired='no',amoeOtherUserCost='0')
 for field in ['amoeMethod','postageRequired','amoeOtherUserCost']:online['evidence_'+field]='Synthetic payment-free online AMOE support'
 response=post('/research',['title','platformId'],online);assert 'Offer and evidence saved.' in response
 p=get('/offers');assert 'ZERO_COST_AMOE' in ' '.join(p.text)
 postal=dict(online);postal.update(title='Synthetic postal AMOE — not real',amoeMethod='mail',postageRequired='yes')
 response=post('/research',['title','platformId'],postal);assert 'Offer and evidence saved.' in response
 p=get('/offers');assert 'LOW_COST_AMOE' in ' '.join(p.text) and 'EXCLUDED_REQUIRES_MONEY' in ' '.join(p.text)
 print('PASS manual research, claim, duplicate prevention, next instance, conflict, superseding, typed term review, same-day platform facts, online/postal AMOE')
finally:
 if demo_id:
  sql(f"""BEGIN; CREATE TEMP TABLE cleanup_demo_accounts AS SELECT \"casinoAccountId\" AS id FROM demo_runs WHERE id='{demo_id}' UNION SELECT \"sportsbookAccountId\" AS id FROM demo_runs WHERE id='{demo_id}'; DELETE FROM demo_runs WHERE id='{demo_id}'; DELETE FROM bankroll_accounts WHERE id IN (SELECT id FROM cleanup_demo_accounts); COMMIT;""")
 sql(f'''BEGIN; DELETE FROM bankroll_accounts WHERE \"platformId\" IN (SELECT id FROM platforms WHERE slug='{slug}'); DELETE FROM offer_evidence WHERE "offerId" IN (SELECT id FROM offers WHERE "platformId" IN (SELECT id FROM platforms WHERE slug='{slug}')); DELETE FROM claims WHERE "offerId" IN (SELECT id FROM offers WHERE "platformId" IN (SELECT id FROM platforms WHERE slug='{slug}')); DELETE FROM offers WHERE "platformId" IN (SELECT id FROM platforms WHERE slug='{slug}'); DELETE FROM platform_sources WHERE "platformId" IN (SELECT id FROM platforms WHERE slug='{slug}'); DELETE FROM platforms WHERE slug='{slug}'; COMMIT;''')
 print('Temporary HTTP records removed.')
