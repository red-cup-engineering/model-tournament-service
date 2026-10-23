import test from 'node:test';
import assert from 'node:assert/strict';
import {selectModelCandidate} from '../src/tournament.mjs';
const candidates = () => [
  {id:'candidate-a', authorActor:'actor:a', validation:{quality:0.8}, holdout:{quality:0.5, maximumDrawdown:0.3}},
  {id:'candidate-b', authorActor:'actor:b', validation:{quality:0.6}, holdout:{quality:0.9, maximumDrawdown:0.1}},
];
const policy = () => ({metric:'quality', direction:'maximize', maximumHoldoutDrawdown:0.5});
const select = (cs=candidates(),p=policy())=>selectModelCandidate({candidates:cs,policy:p});

test('validation selects; untouched holdout remains reported without promoting candidate',()=>{
 const r=select();
 assert.equal(r.selectedUsingValidationOnly,'candidate-a');
 assert.equal(r.untouchedHoldout['candidate-b'].metric,0.9);
 assert.equal(r.selectionPolicySatisfied,true);
 assert.equal(r.promotionEstablished,false);
 assert.equal(r.alphaEstablished,false);
 assert.equal(r.effect,'selection-only');
});
test('minimize selects lowest validation rather than choosing by holdout',()=>{
 const r=select(candidates(),{...policy(), direction:'minimize'});
 assert.equal(r.selectedUsingValidationOnly,'candidate-b');
});
test('normal numeric score strings remain admissible for source compatibility',()=>{
 const cs=candidates();cs[0].validation.quality='0.8';cs[0].holdout.quality='0.5';cs[0].holdout.maximumDrawdown='0.3';
 const r=select(cs,{...policy(),maximumHoldoutDrawdown:'0.5'});
 assert.equal(r.selectedUsingValidationOnly,'candidate-a');
});
test('drawdown exceeding threshold refuses selection policy, without rewriting ranking',()=>{
 const r=select(candidates(),{...policy(),maximumHoldoutDrawdown:0.15});
 assert.equal(r.selectedUsingValidationOnly,'candidate-a');
 assert.equal(r.selectionPolicySatisfied,false);
});
test('refuse absent or null drawdown; never substitute zero for missing evidence',()=>{
 for(const bad of [undefined,null]) {
   const cs=candidates();if(bad===undefined)delete cs[0].holdout.maximumDrawdown;else cs[0].holdout.maximumDrawdown=bad;
   assert.throws(()=>select(cs),/holdout-drawdown-invalid/);
 }
});
test('refuse missing or null policy drawdown boundary',()=>{
 for(const bad of [undefined,null]){
   const p=policy();if(bad===undefined)delete p.maximumHoldoutDrawdown;else p.maximumHoldoutDrawdown=bad;
   assert.throws(()=>select(candidates(),p),/maximum-holdout-drawdown-invalid/);
 }
});
test('refuse coercible but invalid validation and holdout values',()=>{
 for(const bad of [null,false,true,'','  ',[],[0],{}, {valueOf(){return 0.5}},0n]) {
  for(const placement of ['validation','holdout']){
   const cs=candidates();cs[0][placement].quality=bad;
   assert.throws(()=>select(cs),new RegExp(placement+'-metric-invalid'));
  }
 }
});
test('refuse coercible invalid drawdown and policy threshold',()=>{
 for(const bad of [false, true,'', '  ', [], [0], {}, -0, -1]){
  const cs=candidates();cs[0].holdout.maximumDrawdown=bad;
  assert.throws(()=>select(cs),/holdout-drawdown-invalid/);
  const p=policy();p.maximumHoldoutDrawdown=bad;
  assert.throws(()=>select(candidates(),p),/maximum-holdout-drawdown-invalid/);
 }
});
test('reject duplicate author and duplicate candidate identity',()=>{
 const dupAuthor=candidates();dupAuthor[1].authorActor=dupAuthor[0].authorActor;
 assert.throws(()=>select(dupAuthor),/provider-distinct-candidates-required/);
 const dupId=candidates();dupId[1].id=dupId[0].id;
 assert.throws(()=>select(dupId),/provider-distinct-candidates-required/);
});
test('nonfinite score and explicitly negative zero are refused',()=>{
 for(const bad of [NaN,Infinity,-Infinity,-0,'-0','NaN','Infinity']){
  const cs=candidates();cs[0].validation.quality=bad;
  assert.throws(()=>select(cs),/validation-metric-invalid/);
 }
});
