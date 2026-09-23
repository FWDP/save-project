const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./load-typescript.cjs');
const base = 'https://save.example';
function callback(result, exchange = async () => result) {
  return load(path.join(__dirname, '../web/src/app/auth/callback/route.ts'), {
    'next/server': { NextResponse: { redirect: url => new Response(null, {status: 307, headers: {location: url}}) } },
    '@/lib/supabase': { siteUrl: () => base, supabase: async () => ({ auth: { exchangeCodeForSession: exchange } }) },
  }).GET;
}
test('OAuth callback exchanges code and never follows an untrusted next URL', async () => {
 const get = callback({data:{session:{},redirectType:null},error:null});
 const response = await get(new Request(`${base}/auth/callback?code=once&next=https://evil.example`));
 assert.equal(response.headers.get('location'),`${base}/`);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('provider cancellation does not exchange code or echo provider errors', async () => {
 const get = callback(null, async()=>{throw new Error('must not run')});
 const response = await get(new Request(`${base}/auth/callback?error=access_denied&error_description=private`));
 assert.equal(response.headers.get('location'),`${base}/sign-in?error=cancelled`);
});
test('recovery uses provider redirect type even when the URL query is absent', async () => {
 const response = await callback({data:{session:{},redirectType:'recovery'},error:null})(new Request(`${base}/auth/callback?code=recovery`));
 assert.equal(response.headers.get('location'),`${base}/reset-password`);
});
test('expired and missing session callbacks fail closed', async () => {
 for (const result of [{data:{session:null},error:null},{data:{session:null},error:{message:'expired'}}]) {
  const response=await callback(result)(new Request(`${base}/auth/callback?code=old`));
  assert.equal(response.headers.get('location'),`${base}/sign-in?error=link`);
 }
});
function actions(auth) {
 return load(path.join(__dirname,'../web/src/app/auth/actions.ts'),{
  'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{destination:url})}},
  '@/lib/supabase':{siteUrl:()=>base,requireSession:async()=>({user:{id:'verified'}}),supabase:async()=>({auth})}
 });
}
const form = values => { const data=new FormData(); for(const [k,v] of Object.entries(values))data.set(k,v);return data; };
test('Google starts OAuth with the fixed callback and account chooser', async()=>{
 const api=actions({signInWithOAuth:async options=>{assert.equal(options.provider,'google');assert.equal(options.options.redirectTo,`${base}/auth/callback`);assert.equal(options.options.queryParams.prompt,'select_account');return {data:{url:'https://provider.example/authorize'},error:null};}});
 await assert.rejects(api.authenticate({},form({mode:'google'})),{destination:'https://provider.example/authorize'});
});
test('password recovery validates confirmation and reports provider outages', async()=>{
 let calls=0;const api=actions({updateUser:async()=>{calls++;throw new Error('network')}});
 assert.match((await api.changePassword({},form({password:'long-password',confirmPassword:'different'}))).error,/match/);assert.equal(calls,0);
 assert.match((await api.changePassword({},form({password:'long-password',confirmPassword:'long-password'}))).error,/unavailable/);assert.equal(calls,1);
});
test('sign out only ends this session and reports failure',async()=>{
 const api=actions({signOut:async options=>{assert.equal(options.scope,'local');return {error:{message:'unavailable'}}}});
 await assert.rejects(api.signOut(),{destination:'/sign-in?error=signout'});
});
