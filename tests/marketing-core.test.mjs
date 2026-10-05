import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import vm from 'node:vm';

const coreCode=fs.readFileSync(new URL('../assets/js/marketing-core.js',import.meta.url),'utf8');
const sandbox={Intl,Date,console,module:{exports:{}},globalThis:null};sandbox.globalThis=sandbox;vm.runInNewContext(coreCode,sandbox);
const C=sandbox.module.exports;
assert.equal(C.resultMetrics({spend:1000,sales:2,revenue:4000,qualified_inquiries:10,contribution_before_ads:2500}).roas,4);
assert.equal(C.resultMetrics({spend:1000,sales:0,revenue:0}).roas,null);
assert.equal(C.resultMetrics({spend:1000,sales:2}).cpa,500);
assert.equal(C.contentReadiness({title:'x',content_type_id:'commercial',format_id:'reel_video',objective:'ventas',brief:'brief',status_id:'idea'}).ready,true);
assert.equal(C.csvRows('stable_id,title\nA01,"Hola, mundo"')[0].title,'Hola, mundo');

const compressed=fs.readFileSync(new URL('../data/marketing-plan-v10.json.gz',import.meta.url));
const source=JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
assert.equal(source.schema_version,'black-marketing-import-v1');
assert.equal(source.content_items.length,96);
assert.equal(source.story_templates.length,12);
assert.ok(source.reference_notes.length>=12);
assert.equal(C.uniqueStableIds(source.content_items),true);
assert.equal(source.content_items[0].stable_id,'S01');
assert.equal(source.content_items.at(-1).stable_id,'R06');
assert.ok(source.content_items.every(x=>x.brief&&x.source_fields));
assert.ok(source.content_items.filter(x=>x.meta_ads&&Object.keys(x.meta_ads).length).length>50);
console.log('marketing-core.test.mjs: OK');
