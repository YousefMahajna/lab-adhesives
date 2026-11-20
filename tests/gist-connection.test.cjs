const { test } = require('node:test');
const assert = require('node:assert/strict');
const Connection = require('../gist-connection.js');
const id='0123456789abcdef0123456789abcdef';
function fixture(){
 const f={calls:[],status:200,ownerId:7,writes:0};
 f.client=Connection.create(id,async(url,options)=>{
  f.calls.push({url,options});
  if(f.status!==200)return{ok:false,status:f.status};
  if(options.method==='PATCH'){f.writes++;return{ok:true,json:async()=>({files:{}})};}
  return{ok:true,json:async()=>url.includes('gist.githubusercontent.com')?{data:[],comments:[],shipments:[]}:url.endsWith('/user')?{id:7,login:'Owner'}:{owner:{id:f.ownerId,login:'Owner'},files:{}}};
 }); return f;
}
test('anonymous inventory reads have no credential header',async()=>{
 const f=fixture();await f.client.read();assert.equal(f.calls[0].options.headers.Authorization,undefined);assert.equal(f.calls[0].options.cache,'no-store');
});
test('disconnected saves make no write request',async()=>{
 const f=fixture();await assert.rejects(f.client.patch({}),/Connect saving/);assert.equal(f.calls.length,0);
});
test('owner connection supports repeated saves without persisting a credential',async()=>{
 const f=fixture();await f.client.connect('test-only-credential');assert.equal(f.client.isConnected(),true);assert.equal(f.client.getLogin(),'Owner');
 await f.client.patch({'inventory.json':{content:'{}'}});await f.client.patch({'inventory.json':{content:'{}'}});assert.equal(f.writes,2);
 assert.ok(f.calls.every(c=>c.options.headers.Authorization==='Bearer test-only-credential'));assert.ok(f.calls.every(c=>!c.url.includes('test-only-credential')&&!(c.options.body||'').includes('test-only-credential')));
 f.client.disconnect();assert.equal(f.client.isConnected(),false);await assert.rejects(f.client.patch({}),/Connect saving/);
});
test('other GitHub accounts cannot establish the inventory owner connection',async()=>{
 const f=fixture();f.ownerId=99;await assert.rejects(f.client.connect('test-only-credential'),/does not own/);assert.equal(f.client.isConnected(),false);assert.equal(f.writes,0);
});
test('rejected credentials disconnect and return a safe error',async()=>{
 for(const status of [401,403,404]){const f=fixture();await f.client.connect('test-only-credential');f.status=status;await assert.rejects(f.client.patch({}));assert.equal(f.client.isConnected(),false);assert.equal(f.writes,0);}
});
test('network failure does not claim a confirmed save or retry writes',async()=>{
 let failed=false,writes=0;const client=Connection.create(id,async(url,o)=>{if(o.method==='PATCH'){writes++;throw Error('network');}return{ok:true,json:async()=>url.endsWith('/user')?{id:7,login:'Owner'}:{owner:{id:7},files:{}}};});
 await client.connect('test-only-credential');await assert.rejects(client.patch({}),/could not be confirmed/);assert.equal(writes,1);
});
test('anonymous rate-limited reads load the complete saved inventory from the same public Gist',async()=>{
 const saved={data:[{id:1,name:'A',owner:'Keep owner',minQty:'5',dsType:'file',dsFileName:'Keep.pdf'}],comments:[{id:2}],shipments:[{id:3}]},calls=[];
 const client=Connection.create(id,async(url,o)=>{calls.push({url,o});return url.includes('api.github.com')?{ok:false,status:403,headers:{get:()=> '0'}}:{ok:true,json:async()=>saved};});
 const result=await client.read();assert.deepEqual(JSON.parse(result.files['adhesives_data.json'].content),saved);assert.ok(result.files['ds_1.json'].raw_url.endsWith('/ds_1.json'));assert.equal(client.isConnected(),false);assert.equal(calls.length,1);assert.equal(calls[0].o.headers.Authorization,undefined);await assert.rejects(client.patch({}),/Connect saving/);
});
test('failed authenticated reads never use a public copy as the pre-save source',async()=>{
 let fail=false,rawReads=0;const client=Connection.create(id,async(url,o)=>{if(url.includes('gist.githubusercontent.com'))rawReads++;if(fail)return{ok:false,status:403,headers:{get:()=> '0'}};return{ok:true,json:async()=>url.endsWith('/user')?{id:7,login:'Owner'}:{owner:{id:7}}};});
 await client.connect('test-only-credential');fail=true;await assert.rejects(client.read());assert.equal(rawReads,0);
});
