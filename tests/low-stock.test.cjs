const {test}=require('node:test'),assert=require('node:assert/strict');
const Stock=require('../low-stock.js');
test('strict numeric comparison includes zero and excludes blanks or unknown values',()=>{
 for(const qty of [0,'0','2','2.5'])assert.equal(Stock.isLow({qty,minQty:'3'}),true);
 for(const qty of [3,'3','4'])assert.equal(Stock.isLow({qty,minQty:'3'}),false);
 for(const v of ['',null,undefined,'unknown','3 syringes','-1','Infinity','1e3',false]){assert.equal(Stock.isLow({qty:v,minQty:'5'}),false);assert.equal(Stock.isLow({qty:'0',minQty:v}),false);}
 assert.equal(Stock.display(0),'0');assert.equal(Stock.display(''),'—');
});
test('per-adhesive minima are independent of priority and missing minima never create alerts',()=>{
 assert.equal(Stock.isLow({qty:2,minQty:1,priority:'1'}),false);
 assert.equal(Stock.isLow({qty:2,minQty:10,priority:'3'}),true);
 assert.equal(Stock.isLow({qty:0,priority:'1'}),false);
});
test('urgent report has fixed recipients, only low items, and leaves all source data intact',()=>{
 const rows=[{name:'Lower priority',priority:'3',qty:2,minQty:5,owner:'Original owner',custom:{keep:true}},{name:'Top priority',priority:'1',qty:0,minQty:4},{name:'Enough',qty:4,minQty:4},{name:'No minimum',qty:0}];
 const before=JSON.stringify(rows),report=Stock.report(rows);
 assert.equal(report.count,2);assert.deepEqual(report.to.map(r=>r.email),['michaelsk@nvidia.com','ymahajna@nvidia.com']);assert.match(report.subject,/URGENT/);assert.match(report.text,/order/);assert.ok(report.text.indexOf('Top priority')<report.text.indexOf('Lower priority'));assert.ok(!report.text.includes('Enough'));assert.ok(!report.text.includes('No minimum'));assert.equal(JSON.stringify(rows),before);
});
test('no low items produces no email body',()=>{assert.equal(Stock.report([{qty:5,minQty:2}]).text,'');assert.equal(Stock.report([]).count,0);});
test('below minimum is red, minimum through below 130% is dark yellow, and 130% is normal',()=>{
 for(const qty of [0,5,9.99])assert.equal(Stock.level({qty,minQty:10}),'low');
 for(const qty of [10,11,12.99])assert.equal(Stock.level({qty,minQty:10}),'warning');
 for(const qty of [13,14,100])assert.equal(Stock.level({qty,minQty:10}),'ok');
 assert.equal(Stock.level({qty:0,minQty:0}),'ok');assert.equal(Stock.level({qty:0}),'unset');
 assert.equal(Stock.level({qty:0.13,minQty:0.1}),'ok');
 assert.equal(Stock.report([{qty:11,minQty:10}]).count,0);
});
test('red-first and yellow-first ranks keep healthy and unknown values after alerts',()=>{
 const rows=[{qty:'',minQty:10},{qty:13,minQty:10},{qty:11,minQty:10},{qty:9,minQty:10}];
 assert.deepEqual(rows.slice().sort((a,b)=>Stock.rank(a,'red')-Stock.rank(b,'red')).map(Stock.level),['low','warning','ok','unset']);
 assert.deepEqual(rows.slice().sort((a,b)=>Stock.rank(a,'yellow')-Stock.rank(b,'yellow')).map(Stock.level),['warning','low','ok','unset']);
});
