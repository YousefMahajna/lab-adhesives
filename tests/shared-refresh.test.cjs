const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('function _mergeDraftFields('),html.indexOf('function _apply(',html.indexOf('function _mergeDraftFields(')));
const ctx=vm.createContext({_stripRow:row=>{const out={...row};delete out.dsFileData;return out;}});vm.runInContext(code,ctx);
const merge=(remote,change,baseline)=>JSON.parse(JSON.stringify(ctx._mergeDraftFields(remote,change,baseline)));
test('a newer published minimum reaches a tab without erasing an unrelated unsaved comment',()=>{
 const before={id:1,minQty:'10',comments:'',owner:'Retained owner',dsFileName:'Keep.pdf'};
 const result=merge([{...before,minQty:'20',remoteField:'Keep latest'}],{up:[{...before,comments:'My draft'}],del:[]},{1:JSON.stringify(before)});
 assert.deepEqual(result,[{...before,minQty:'20',comments:'My draft',remoteField:'Keep latest'}]);
});
test('explicit local changes, new rows and deletions preserve unrelated shared records',()=>{
 const result=merge([{id:1,minQty:'20'},{id:2,name:'Delete requested'},{id:3,name:'Other editor'}],{up:[{id:1,minQty:'15'},{id:4,name:'New'}],del:[2]},{1:JSON.stringify({id:1,minQty:'10'})});
 assert.deepEqual(result,[{id:1,minQty:'15'},{id:3,name:'Other editor'},{id:4,name:'New'}]);
});
