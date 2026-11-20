/* Isolated Firebase inventory; public reads follow existing access, verified writes use server rules. */
(function(root){
 'use strict';
 var MAIN='adhesives_data.json';
 function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';}
 function encode(value){return 'f_'+Array.from(String(value)).map(function(c){return c.charCodeAt(0).toString(16).padStart(4,'0');}).join('');}
 function commentKey(value){return /^[A-Za-z0-9_-]+$/.test(String(value))?'c_'+value:'c_'+encode(value);}
 function validateMain(value){if(!value||!Array.isArray(value.data)||!Array.isArray(value.comments)||!Array.isArray(value.shipments))throw Error('Complete inventory, comments and shipments are required.');return value;}
 function create(options){
  var base=new URL(options.databaseUrl);if(base.protocol!=='https:'||!/^[-a-z0-9]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(base.hostname))throw Error('Invalid database origin.');
  var endpoint=base.origin+'/adhesivesSharedV1',fetcher=options.fetch||root.fetch.bind(root),last=null,etag=null;
  async function request(method,path,value,match){
   var token=await options.getIdToken(method!=='GET');if(method!=='GET'&&!token)throw Error('Sign in with your verified NVIDIA email before saving.');
   var headers={'X-Firebase-ETag':'true'};if(value!==undefined)headers['Content-Type']='application/json';if(match)headers['if-match']=match;
   var response;try{response=await fetcher(endpoint+path+'.json'+(token?'?auth='+encodeURIComponent(token):''),{method:method,headers:headers,body:value===undefined?undefined:JSON.stringify(value),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch(error){throw Error(method==='GET'?'The shared inventory could not be reached.':'The save could not be confirmed. Keep the open edit and retry.');}
   if(!response.ok){var error=Error(response.status===412?'Another browser saved first. Reload the latest shared values before retrying.':response.status===401||response.status===403?'Firebase sign-in or database permissions are not ready.':'Shared database returned HTTP '+response.status+'.');error.status=response.status;if(response.status===412)etag=null;throw error;}
   return {value:await response.json(),etag:response.headers.get('ETag')};
  }
  function unpack(snapshot){
   if(!snapshot||snapshot.schema!==2||!snapshot.initialized) {var error=Error('Shared autosave has not been initialized.');error.code='NOT_INITIALIZED';throw error;}
   var comments=Object.values(snapshot.comments||{}).sort(function(a,b){return a.order-b.order;}).map(function(row){var comment=JSON.parse(row.json);comment.id=row.id;return comment;});
   var main={...JSON.parse(snapshot.extraJSON||'{}'),data:JSON.parse(snapshot.inventoryJSON),comments:comments,shipments:JSON.parse(snapshot.shipmentsJSON)};validateMain(main);
   var files={};Object.keys(snapshot.files||{}).forEach(function(key){var row=snapshot.files[key];if(!row||encode(row.name)!==key)throw Error('Invalid shared attachment metadata.');files[row.name]={...row};delete files[row.name].name;});
   files[MAIN]={content:JSON.stringify(main)};return {files:files,revision:snapshot.revision};
  }
  function packComments(comments,before){var out={};comments.forEach(function(comment,i){if(comment.id===undefined||comment.id===null)throw Error('A comment has no ID.');var key=commentKey(comment.id);if(out[key])throw Error('Duplicate comment ID.');out[key]=before&&before[key]&&before[key].json===JSON.stringify(comment)?before[key]:{id:comment.id,json:JSON.stringify(comment),createdBy:options.getUser()?.uid||'legacy-import',order:before&&before[key]?before[key].order:i};});return out;}
  async function read(){var response=await request('GET','');if(!response.etag)throw Error('Shared version marker is missing; saving is blocked.');last=response.value;etag=response.etag;return unpack(last);}
  async function initialize(files){
   var current=options.getUser();if(!current||!current.emailVerified||String(current.email).toLowerCase()!=='ymahajna@nvidia.com')throw Error('Only the verified administrator can initialize shared autosave.');
   var before=await request('GET','');if(before.value!==null)throw Error('Shared storage already exists. Initialization cancelled.');if(!before.etag)throw Error('Missing version marker. Initialization cancelled.');
   if(!files[MAIN]||typeof files[MAIN].content!=='string')throw Error('A complete inventory file is required.');var main=validateMain(JSON.parse(files[MAIN].content));
   var extra={...main};delete extra.data;delete extra.comments;delete extra.shipments;var encoded={};Object.keys(files).filter(function(name){return name!==MAIN;}).forEach(function(name){encoded[encode(name)]={...files[name],name:name};});
   var next={schema:2,initialized:true,revision:1,updatedAt:new Date().toISOString(),inventoryJSON:JSON.stringify(main.data),shipmentsJSON:JSON.stringify(main.shipments),extraJSON:JSON.stringify(extra),comments:packComments(main.comments),files:encoded};
   var saved=await request('PUT','',next,before.etag);last=saved.value;etag=saved.etag;return unpack(last);
  }
  async function patch(files){
   if(!last||!etag)throw Error('Read the latest shared inventory before saving.');if(files[MAIN]===null)throw Error('The inventory file cannot be deleted.');var before=unpack(last),main=validateMain(JSON.parse((files[MAIN]||before.files[MAIN]).content));
   var current=options.getUser();if(!current||!current.emailVerified)throw Error('Verify your NVIDIA email before saving.');
   if(options.getRole()==='viewer'){
    var old=JSON.parse(before.files[MAIN].content);
    if(canonical(main.data)!==canonical(old.data)||canonical(main.shipments)!==canonical(old.shipments)||Object.keys(files).some(function(name){return name!==MAIN;}))throw Error('Viewer access permits adding comments only.');
    var known=new Map(old.comments.map(function(c){return [String(c.id),c];})),incoming=new Map(main.comments.map(function(c){return [String(c.id),c];}));
    known.forEach(function(comment,id){if(!incoming.has(id)||canonical(comment)!==canonical(incoming.get(id)))throw Error('Viewers cannot edit or remove existing comments.');});
    for(var comment of main.comments){if(known.has(String(comment.id)))continue;if(!/^[A-Za-z0-9_-]+$/.test(String(comment.id)))throw Error('Invalid comment ID.');var row={id:comment.id,json:JSON.stringify(comment),createdBy:current.uid,order:{'.sv':'timestamp'}};await request('PUT','/comments/'+commentKey(comment.id),row,'null_etag');}
    return read();
   }
   if(!['editor','manager','admin'].includes(options.getRole()))throw Error('You do not have permission to edit this application.');
   var next=JSON.parse(JSON.stringify(last));next.inventoryJSON=JSON.stringify(main.data);next.shipmentsJSON=JSON.stringify(main.shipments);next.comments=packComments(main.comments,next.comments);next.revision++;next.updatedAt=new Date().toISOString();
   Object.keys(files).filter(function(name){return name!==MAIN;}).forEach(function(name){var key=encode(name);if(files[name]===null)delete next.files[key];else next.files[key]={...files[name],name:name};});
   var saved=await request('PUT','',next,etag);last=saved.value;etag=saved.etag;return unpack(last);
  }
  return {read:read,patch:patch,initialize:initialize};
 }
 var api={create:create,encode:encode,commentKey:commentKey};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AdhesiveFirebaseShared=api;
})(typeof globalThis!=='undefined'?globalThis:this);
