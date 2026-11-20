/* Read-only report generator. Never writes inventory and never sends an email. */
const Stock=require('../low-stock.js');
const endpoint='https://gist.githubusercontent.com/YousefMahajna/32393f1f1f4f7d355049a7102a3e5970/raw/adhesives_data.json';
async function main(){
 const response=await fetch(endpoint+'?_='+Date.now(),{headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Shared inventory read failed ('+response.status+'). No stock conclusion or email was produced.');
 const data=await response.json();if(!Array.isArray(data.data))throw Error('Unexpected inventory format. No report produced.');
 process.stdout.write(JSON.stringify({...Stock.report(data.data),checkedAt:new Date().toISOString(),inventoryCount:data.data.length},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
