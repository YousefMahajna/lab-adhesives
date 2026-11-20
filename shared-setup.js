(function(){
 'use strict';
 const $=id=>document.getElementById(id),status=$('status');let files=null;
 const source=AdhesiveGistConnection.create('32393f1f1f4f7d355049a7102a3e5970',fetch.bind(window));
 const store=AdhesiveFirebaseShared.create({databaseUrl:LabFirebaseConfig.databaseURL,getIdToken:required=>required?LabFirebaseAuth.getIdToken():Promise.resolve(null),getUser:LabFirebaseAuth.user,getRole:()=>LabFirebaseAccess.level(LabFirebaseAuth.user()?.email)});
 function identity(){const user=LabFirebaseAuth.user();$('identity').textContent=user?user.email+(user.emailVerified?' · verified':' · verify your email'):'Not signed in';}
 function owner(){const u=LabFirebaseAuth.user();if(!u?.emailVerified||u.email.toLowerCase()!=='ymahajna@nvidia.com')throw Error('Sign in and verify ymahajna@nvidia.com first.');}
 async function permissions(){const r=await fetch('https://raw.githubusercontent.com/YousefMahajna/interconnect-process-lab/main/platforms.json?_='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Latest Users list could not be loaded.');const data=await r.json();const rows=LabAccess.validate(data.access,data.platforms.map(p=>p.id));await LabFirebaseAccess.sync(rows);}
 async function run(action){const buttons=[...document.querySelectorAll('main button')];buttons.forEach(b=>b.disabled=true);try{await action();}catch(error){status.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);$('initialize').disabled=!files||!$('rulesReady').checked;identity();}}
 $('rulesReady').onchange=()=>{$('initialize').disabled=!files||!$('rulesReady').checked;};
 $('signin').onclick=()=>run(async()=>{await LabFirebaseSignIn.open();identity();status.textContent=LabFirebaseAuth.user()?.emailVerified?'Email verified. You can continue.':'Check your NVIDIA inbox for the verification email.';});
 $('copyRules').onclick=()=>run(async()=>{await navigator.clipboard.writeText($('rules').value);status.textContent='Rules copied. Paste into Firebase → Realtime Database → Rules, then Publish.';});
 $('preview').onclick=()=>run(async()=>{const result=await source.read();files=result.files;const main=JSON.parse(files['adhesives_data.json'].content);if(!main.data?.length||!Array.isArray(main.comments)||!Array.isArray(main.shipments))throw Error('Complete source data is required. Initialization blocked.');$('previewResult').textContent=main.data.length+' adhesives · '+main.comments.length+' comments · '+main.shipments.length+' shipments · '+Object.keys(files).filter(k=>k!=='adhesives_data.json').length+' datasheet references';status.textContent='Source preview ready. No data changed.';});
 $('initialize').onclick=()=>run(async()=>{
  owner();if(!$('rulesReady').checked)throw Error('Publish the provided database rules first.');
  // Fresh source immediately before migration; never initialize from an old preview.
  const result=await source.read();files=result.files;await permissions();await store.initialize(files);
  const check=await store.read(),old=JSON.parse(files['adhesives_data.json'].content),saved=JSON.parse(check.files['adhesives_data.json'].content);
  const ids=rows=>rows.map(x=>String(x.id)).sort().join('|');
  if(ids(old.data)!==ids(saved.data)||old.comments.length!==saved.comments.length||old.shipments.length!==saved.shipments.length)throw Error('Initialization verification needs attention. Do not repeat initialization.');
  status.textContent='Shared autosave initialized and verified: '+saved.data.length+' adhesives. Return to Adhesive Inventory and sign in to recover previous changes. The old Gist was not changed.';
 });
 $('sync').onclick=()=>run(async()=>{owner();if(!$('rulesReady').checked)throw Error('Publish the database rules first.');await permissions();status.textContent='Shared inventory permissions now match the saved Users list.';});
 Promise.all([fetch('firebase-database-rules.json').then(r=>{if(!r.ok)throw Error('Rules file unavailable.');return r.text();}).then(t=>{$('rules').value=t;}),LabFirebaseAuth.ready()]).then(()=>{identity();status.textContent='Ready. Follow steps 1–3.';}).catch(e=>{status.textContent=e.message;});
})();
