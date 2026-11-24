import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../functions/api/[[path]].js',import.meta.url),'utf8');
const {onRequest}=await import('data:text/javascript,'+encodeURIComponent(source));
const db={prepare(sql){return {all:async()=>({results:[{id:'p1',title_en:'Test'}]})}}};
for(const [name,env,path,expected,method] of [
 ['missing DB',{},'/api/products',503],
 ['catalog',{DB:db},'/api/products',200],
 ['admin closed',{DB:db},'/api/admin/products',401],
 ['inquiry disabled',{DB:db},'/api/inquiries',503,'POST'],
 ['unknown',{DB:db},'/api/unknown',404]
])test(name,async()=>{const res=await onRequest({request:new Request('https://example.test'+path,{method:method||'GET'}),env});assert.equal(res.status,expected)});
