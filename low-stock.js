/* Shared read-only stock rules for the table and Sunday report. */
(function(root){
  'use strict';
  function quantity(value){
    if(value===null||value===undefined||typeof value==='boolean')return null;
    var text=String(value).trim();
    if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return null;
    var number=Number(text);return Number.isFinite(number)&&number>=0?number:null;
  }
  function isLow(row){var qty=quantity(row.qty),min=quantity(row.minQty);return qty!==null&&min!==null&&qty<min;}
  function level(row){var qty=quantity(row.qty),min=quantity(row.minQty);if(qty===null||min===null)return 'unset';if(qty<min)return 'low';if(min>0&&qty/min<1.3)return 'warning';return 'ok';}
  function rank(row,first){var state=level(row);return (first==='yellow'?{warning:0,low:1,ok:2,unset:3}:{low:0,warning:1,ok:2,unset:3})[state];}
  function display(value){return value===null||value===undefined||String(value).trim()===''?'—':String(value);}
  function report(rows){
    var low=rows.filter(isLow).slice().sort(function(a,b){var rank=function(r){return /^[123]$/.test(String(r.priority))?Number(r.priority):9;};return rank(a)-rank(b)||String(a.name).localeCompare(String(b.name));});
    return {count:low.length,to:[{name:'Michael',email:'michaelsk@nvidia.com'},{name:'Yousef Mahajna',email:'ymahajna@nvidia.com'}],subject:'URGENT: Adhesive stock below minimum — order required',text:low.length?[
      'Hi Michael and Yousef,','',
      'The following adhesives are below their minimum stock quantities. This is urgent: please review and arrange an order.',
      '',...low.map(function(r){return String(r.name||'Unnamed adhesive')+' | Priority: '+display(r.priority)+' | Vendor: '+display(r.vendor)+' | NVIDIA PN: '+display(r.nvpn)+' | Supplier PN: '+display(r.spn)+' | QTY: '+display(r.qty)+' | Min QTY: '+display(r.minQty)+' | Shortfall: '+(quantity(r.minQty)-quantity(r.qty));}),
      '','Inventory: https://yousefmahajna.github.io/lab-adhesives/',
      'This report uses the shared saved inventory. Blank minimums and unknown quantities are not treated as zero.'
    ].join('\n'):''};
  }
  var api={quantity:quantity,isLow:isLow,level:level,rank:rank,display:display,report:report};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AdhesiveLowStock=api;
})(typeof globalThis!=='undefined'?globalThis:this);
