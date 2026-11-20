/* Evaluate authorization predicates, separate from adapter/UI behavior.
   Firebase Console validates deployed rule syntax; no emulator is bundled here. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const rules=require('../firebase-database-rules.json').rules;
function snapshot(value){return {val:()=>value??null,exists:()=>value!==undefined&&value!==null,child(path){return snapshot(path.split('/').reduce((v,k)=>v?.[k],value));}};}
function permit(email,verified,level,{initial=false,comment=false,uid='user',creator=uid}={}){
 const grants={defaultLevel:'viewer',users:{}};if(email&&level)grants.users[email.toLowerCase().replaceAll('.',',')]={level};
 const root=snapshot({adhesiveAccessV1:grants,adhesivesSharedV1:{initialized:true}});
 const context=vm.createContext({auth:email?{uid,token:{email,email_verified:verified}}:null,root,data:snapshot(initial||comment?null:{initialized:true}),newData:snapshot(comment?{createdBy:creator}:{schema:2})});
 vm.runInContext('String.prototype.matches=function(r){return r.test(this)}',context);
 return vm.runInContext(comment?rules.adhesivesSharedV1.comments.$comment['.write']:rules.adhesivesSharedV1['.write'],context);
}
test('server write predicate rejects unauthenticated, unverified and external users',()=>{
 assert.equal(permit(null,false,null),false);assert.equal(permit('ymahajna@nvidia.com',false,'admin'),false);assert.equal(permit('editor@example.com',true,'editor'),false);
});
test('server write predicate honors current editor grants and immediate revocation',()=>{
 assert.equal(permit('editor@nvidia.com',true,'editor'),true);assert.equal(permit('editor@nvidia.com',true,'viewer'),false);assert.equal(permit('editor@nvidia.com',true,'none'),false);assert.equal(permit('unlisted@nvidia.com',true,null),false);
});
test('only verified owner can initialize; viewer only adds own new comments',()=>{
 assert.equal(permit('editor@nvidia.com',true,'editor',{initial:true}),false);assert.equal(permit('ymahajna@nvidia.com',true,null,{initial:true}),true);
 assert.equal(permit('viewer@nvidia.com',true,'viewer',{comment:true}),true);assert.equal(permit('viewer@nvidia.com',true,'none',{comment:true}),false);assert.equal(permit('viewer@nvidia.com',true,'viewer',{comment:true,creator:'another-user'}),false);
});
test('no ancestor public write can bypass the Adhesives rules; legacy app paths retain access',()=>{
 assert.equal(rules['.write'],false);assert.equal(rules.appState['.write'],true);assert.equal(rules.processRecipeLibrary['.write'],true);assert.notEqual(rules.adhesiveAccessV1['.write'],true);
});
