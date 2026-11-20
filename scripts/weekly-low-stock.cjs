/* Read-only report generator. Never writes inventory and never sends an email. */
const Stock=require('../low-stock.js');
const endpoint='https://gist.githubusercontent.com/YousefMahajna/32393f1f1f4f7d355049a7102a3e5970/raw/adhesives_data.json';
async function main(){
 const firebase=await fetch('https://lab-tracker-nvidia-default-rtdb.firebaseio.com/adhesivesSharedV1.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!firebase.ok)throw Error('Shared Firebase inventory could not be checked. No stale report was produced.');
 const shared=await firebase.json();
 if(shared!==null){
  if(shared.schema!==2||!shared.initialized)throw Error('Unexpected shared inventory schema.');
  const rows=JSON.parse(shared.inventoryJSON);if(!Array.isArray(rows))throw Error('Invalid inventory.');
  process.stdout.write(JSON.stringify({...Stock.report(rows),source:'Firebase',checkedAt:new Date().toISOString(),inventoryCount:rows.length},null,2));return;
 }
 const response=await fetch(endpoint+'?_='+Date.now(),{headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Shared inventory read failed ('+response.status+'). No stock conclusion or email was produced.');
 const data=await response.json();if(!Array.isArray(data.data))throw Error('Unexpected inventory format. No report produced.');
 process.stdout.write(JSON.stringify({...Stock.report(data.data),checkedAt:new Date().toISOString(),inventoryCount:data.data.length},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
