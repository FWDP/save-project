const test = require('node:test');
const assert = require('node:assert/strict');
const {accountReport, LedgerController} = require('../dist/ledger/ledger.controller');
const {TransactionsService} = require('../dist/transactions/transactions.service');
const {authContext} = require('../dist/auth/auth-context');
const row = (id, fields = {}) => ({id: String(id), userId:'alice', type:'expense', amount:1.25, date:'2026-10-03', category:'Food', description:'Lunch', status:'pending', revision:1,...fields});
test('account report counts all pages, filters records, and excludes rejected spending', () => {
 const records = Array.from({length:31}, (_,i) => row(i));
 records.push(row('income',{type:'income',amount:100}),row('rejected',{amount:500,status:'rejected'}),row('old',{amount:10,date:'2026-09-30'}));
 const result = accountReport(records,{month:'2026-10',page:2});
 assert.equal(result.total,33); assert.equal(result.items.length,8);
 assert.deepEqual(result.summary,{incomeMinor:10000,expenseMinor:3875,balanceMinor:6125});
 assert.deepEqual(result.categories,[{name:'Food',amountMinor:3875,count:31}]);
 assert.equal(accountReport(records,{search:'LUNCH',type:'income'}).total,1);
 assert.equal(accountReport(records,{category:'Missing'}).total,0);
 assert.equal(accountReport(records,{}).total,34);
});
test('account ledger works without any workspace and only reads verified account records', async () => {
 const calls=[];
 const database={query:async(sql,params)=>{calls.push({sql,params});return {rows:[]}}};
 const controller=new LedgerController(new TransactionsService(database),{});
 await authContext.run({userId:'alice'},async()=>{
  const result=await controller.list({});assert.equal(result.total,0);
  await assert.rejects(controller.get('507f1f77bcf86cd799439011'),{status:404});
 });
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0].params,['alice']);
 assert.deepEqual(calls[1].params,['507f1f77bcf86cd799439011','alice']);
 assert.ok(calls.every(({sql})=>!sql.includes('workspace')));
});
test('account responses preserve receipt metadata and mutation keys used for offline deduplication',async()=>{
 const db={query:async()=>({rows:[{...row('1'),user_id:'alice',client_mutation_id:'offline-key',receipt_uri:'file:///receipt.jpg',custom_fields:{tax:'5'}}]})};
 const [result]=await authContext.run({userId:'alice'},()=>new TransactionsService(db).findAll());
 assert.equal(result.clientMutationId,'offline-key');assert.equal(result.receiptUri,'file:///receipt.jpg');assert.deepEqual(result.customFields,{tax:'5'});
});

test('HTTP account ledger enforces authentication and isolates two accounts without memberships', async () => {
 const {Module,ValidationPipe}=require('@nestjs/common');
 const {NestFactory}=require('@nestjs/core');
 const {AuthGuard}=require('../dist/auth/auth.guard');
 const {ExchangeRatesService}=require('../dist/ledger/exchange-rates.service');
 const database={query:async(sql,params)=>({rows:[{...row(params[0]),user_id:params[0],amount:params[0]==='alice'?10:20}]})};
 class TestModule {}
 Module({controllers:[LedgerController],providers:[{provide:TransactionsService,useValue:new TransactionsService(database)},{provide:ExchangeRatesService,useValue:{}}]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});
 app.use((req,res,next)=>authContext.run({},next));
 app.useGlobalGuards(new AuthGuard());
 app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
 const originalFetch=global.fetch, oldUrl=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 process.env.SUPABASE_URL='https://auth.example.test';process.env.SUPABASE_PUBLISHABLE_KEY='test';
 global.fetch=async(url,options)=>String(url).startsWith('https://auth.example.test/')
   ? new Response(JSON.stringify({id:options.headers.Authorization.slice(7)}),{status:200}) : originalFetch(url,options);
 try {
  await app.listen(0,'127.0.0.1'); const base=await app.getUrl();
  assert.equal((await fetch(base+'/ledger/transactions')).status,401);
  for(const account of ['alice','bob']) {
   const response=await fetch(base+'/ledger/transactions',{headers:{Authorization:'Bearer '+account}});
   assert.equal(response.status,200);const data=await response.json();
   assert.equal(data.total,1);assert.equal(data.items[0].userId,account);
   assert.equal(data.summary.expenseMinor,account==='alice'?1000:2000);
  }
  assert.equal((await fetch(base+'/ledger/transactions?userId=bob',{headers:{Authorization:'Bearer alice'}})).status,400);
  assert.equal((await fetch(base+'/workspaces',{headers:{Authorization:'Bearer alice'}})).status,404);
 } finally {
  global.fetch=originalFetch;
  if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
  if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;
  await app.close();
 }
});
