const {test}=require('node:test'),assert=require('node:assert/strict');
const Store=require('../firebase-shared.js');
const MAIN='adhesives_data.json';
const original={data:[{id:1,name:'Adhesive',qty:'0',minQty:'10',owner:'Legacy owner',custom:{a:1},dsType:'file',dsFileName:'sheet.pdf'}],comments:[{id:8,text:'Existing',time:'2026-01-01'}],shipments:[{id:2,amount:5}],unknown:'keep me'};
function server(){
 let value=null,rev=0,deny=false,requests=[];
 const fetch=async(url,o)=>{
  const path=new URL(url).pathname.replace('/adhesivesSharedV1','').replace(/\.json$/,'');requests.push({path,method:o.method,headers:o.headers});
  if(o.method==='GET')return response(value,200);
  if(deny)return response({error:'Permission denied'},401);
  const expected=value===null?'null_etag':'"'+rev+'"';
  if(o.headers['if-match']!==expected&&!(path.startsWith('/comments/')&&o.headers['if-match']==='null_etag'&&!value?.comments?.[path.split('/').pop()]))return response({},412);
  let next=JSON.parse(o.body);
  if(path){const key=path.split('/').pop();value.comments??={};value.comments[key]=next;if(next.order?.['.sv'])next.order=Date.now();}else value=next;
  rev++;return response(next,200);
 };
 function response(v,status){return {ok:status===200,status,headers:{get:n=>n==='ETag'?(value===null?'null_etag':'"'+rev+'"'):null},json:async()=>structuredClone(v)};}
 return {fetch,requests,get value(){return value;},set deny(v){deny=v;}};
}
function client(s,role='admin'){return Store.create({databaseUrl:'https://lab-tracker-nvidia-default-rtdb.firebaseio.com',fetch:s.fetch,getIdToken:async()=> 'fake-token',getUser:()=>({email:role==='admin'?'ymahajna@nvidia.com':'viewer@nvidia.com',emailVerified:true,uid:role}),getRole:()=>role});}
function files(main=original){return {[MAIN]:{content:JSON.stringify(main)},'ds_1.json':{raw_url:'https://gist.githubusercontent.com/YousefMahajna/archive/raw/ds_1.json'}};}
test('initialize preserves complete records, zero quantity, hidden owner, extra fields and attachments',async()=>{
 const s=server(),c=client(s);await c.initialize(files());const saved=await c.read();assert.deepEqual(JSON.parse(saved.files[MAIN].content),original);assert.equal(saved.files['ds_1.json'].raw_url,files()['ds_1.json'].raw_url);assert.equal(s.requests.filter(x=>x.method==='PUT').length,1);
 await assert.rejects(c.initialize(files()),/already exists/);
});
test('two clients cannot overwrite a newer confirmed version',async()=>{
 const s=server(),a=client(s),b=client(s);await a.initialize(files());await a.read();await b.read();
 const min=structuredClone(original);min.data[0].minQty='20';await a.patch({[MAIN]:{content:JSON.stringify(min)}});
 const stale=structuredClone(original);stale.data[0].qty='8';await assert.rejects(b.patch({[MAIN]:{content:JSON.stringify(stale)}}),e=>e.status===412);
 assert.equal(JSON.parse(s.value.inventoryJSON)[0].minQty,'20');
});
test('viewer can append a comment but cannot change inventory, delete comments or upload files',async()=>{
 const s=server();await client(s).initialize(files());const v=client(s,'viewer');await v.read();
 const next=structuredClone(original);next.comments.push({id:9,text:'Please order'});await v.patch({[MAIN]:{content:JSON.stringify(next)}});
 assert.equal(Object.values(s.value.comments).length,2);assert.equal(s.value.comments.c_9.createdBy,'viewer');
 const edited=structuredClone(next);edited.data[0].qty='999';await assert.rejects(v.patch({[MAIN]:{content:JSON.stringify(edited)}}),/comments only/);
 edited.data=original.data;edited.comments=[];await assert.rejects(v.patch({[MAIN]:{content:JSON.stringify(edited)}}),/cannot edit or remove/);
 await assert.rejects(v.patch({'ds_1.json':{content:'changed'}}),/comments only/);
});
test('denied write leaves canonical inventory unchanged and rejects the save',async()=>{
 const s=server(),c=client(s);await c.initialize(files());await c.read();s.deny=true;const next=structuredClone(original);next.data[0].qty='100';
 await assert.rejects(c.patch({[MAIN]:{content:JSON.stringify(next)}}),e=>e.status===401);assert.equal(JSON.parse(s.value.inventoryJSON)[0].qty,'0');
});
test('deleting the main file is rejected before any write',async()=>{
 const s=server(),c=client(s);await c.initialize(files());await c.read();const n=s.requests.length;await assert.rejects(c.patch({[MAIN]:null}),/cannot be deleted/);assert.equal(s.requests.length,n);
});
