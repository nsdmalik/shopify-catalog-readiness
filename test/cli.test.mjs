import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const cli = new URL('../src/cli.mjs', import.meta.url);
function fixture(t) {
 const dir = mkdtempSync(join(tmpdir(),'catalog-readiness-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file = join(dir,'catalog.json');writeFileSync(file,JSON.stringify({products:[{id:'synthetic:1',title:'Tote',variants:[{price:'invalid'}]}]}));return {dir,file};
}
function run(...args) {return spawnSync(process.execPath,[cli.pathname,...args],{encoding:'utf8'});}
test('JSON report and default exit code',t=>{const {file}=fixture(t);const r=run(file,'--format','json');assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).summary.products,1);});
test('quality gates return 1 and still emit report',t=>{const {file}=fixture(t);for(const args of [['--fail-on','error'],['--fail-on','warning'],['--min-score','100']]){const r=run(file,...args);assert.equal(r.status,1);assert.match(r.stdout,/Catalog readiness report/);}});
test('unknown, missing and invalid options return 2',t=>{const {file}=fixture(t);for(const args of [['--unknown'],['--format'],['--format','xml'],['--min-score','101'],['--min-description-words','0'],['--format','json','--format','json']])assert.equal(run(file,...args).status,2);});
test('source and existing report are never overwritten',t=>{const {dir,file}=fixture(t);const original=readFileSync(file,'utf8');assert.equal(run(file,'--output',file).status,2);const out=join(dir,'report.md');assert.equal(run(file,'--output',out).status,0);assert.equal(run(file,'--output',out).status,2);assert.equal(readFileSync(file,'utf8'),original);});
test('malformed JSON has a concise error and no partial report',t=>{const {file}=fixture(t);writeFileSync(file,'{broken');const r=run(file);assert.equal(r.status,2);assert.equal(r.stdout,'');assert.match(r.stderr,/Input is not valid JSON/);});
test('UTF-8 BOM is supported',t=>{const {file}=fixture(t);writeFileSync(file,'\ufeff'+readFileSync(file,'utf8'));assert.equal(run(file).status,0);});
test('help and missing file are handled',()=>{assert.equal(run('--help').status,0);assert.equal(run().status,2);assert.equal(run('/does/not/exist').status,2);});
