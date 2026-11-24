// QCRCE commercial API — Cloudflare Pages Functions
const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const fail=(message,status=400)=>json({error:message},status);
async function admin(request,env){
 // Fail closed. A server-side secret is required; never put it in browser code.
 const expected=env.ADMIN_API_TOKEN;
 if(!expected || expected.length<32)return false;
 const supplied=request.headers.get("Authorization")||"";
 const enc=new TextEncoder();
 const a=await crypto.subtle.digest("SHA-256",enc.encode(supplied));
 const b=await crypto.subtle.digest("SHA-256",enc.encode("Bearer "+expected));
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;
 for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
async function body(request){
 if(!(request.headers.get("content-type")||"").includes("application/json"))throw new Error("Expected JSON");
 const reader=request.body?.getReader();if(!reader)throw new Error("Missing body");
 let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new Error("Body too large")}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 const v=JSON.parse(new TextDecoder().decode(bytes));if(!v||typeof v!=="object"||Array.isArray(v))throw new Error("Invalid body");return v;
}
const valid=(v,n)=>typeof v==="string"&&v.trim().length>0&&v.length<=n;
export async function onRequest({request,env}){
 const path=new URL(request.url).pathname.replace(/\/$/,""),method=request.method;
 if(!env.DB)return fail("Database unavailable",503);
 try{
 if(path==="/api/products"&&method==="GET"){
 const {results}=await env.DB.prepare("SELECT id,slug,title_en,title_zh,description_en,description_zh,price_cents,currency FROM products WHERE status='published' ORDER BY updated_at DESC LIMIT 100").all();return json(results);
 }
 if(path==="/api/articles"&&method==="GET"){
 const {results}=await env.DB.prepare("SELECT slug,title,body,locale,updated_at FROM articles WHERE status='published' ORDER BY updated_at DESC LIMIT 50").all();return json(results);
 }
 if(path==="/api/inquiries"&&method==="POST"){
 if(!env.TURNSTILE_SECRET)return fail("Inquiry submission not enabled",503);
 const v=await body(request);
 if(!valid(v.email,254)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)||!valid(v.brief,5000)||!valid(v.turnstileToken,2048))return fail("Invalid inquiry");
 const verify=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:v.turnstileToken})});
 const check=await verify.json();if(!check.success||!env.PUBLIC_HOSTNAME||check.hostname!==env.PUBLIC_HOSTNAME)return fail("Verification failed",403);
 if(v.product_id!=null){if(!valid(v.product_id,100))return fail("Invalid product");const p=await env.DB.prepare("SELECT id FROM products WHERE id=? AND status='published'").bind(v.product_id).first();if(!p)return fail("Unknown product")}
 const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO inquiries(id,product_id,email,brief) VALUES(?,?,?,?)").bind(id,v.product_id??null,v.email.trim(),v.brief.trim()).run();return json({id},201);
 }
 if(path.startsWith("/api/admin/")){
 if(!await admin(request,env))return fail("Unauthorized",401);
 if(path==="/api/admin/inquiries"&&method==="GET"){const {results}=await env.DB.prepare("SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 100").all();return json(results)}
 if(path==="/api/admin/products"&&method==="GET"){const {results}=await env.DB.prepare("SELECT * FROM products ORDER BY updated_at DESC LIMIT 100").all();return json(results)}
 if(path==="/api/admin/products"&&method==="POST"){
 const v=await body(request);if(!valid(v.slug,100)||! /^[a-z0-9-]+$/.test(v.slug)||!valid(v.title_en,200)||!valid(v.title_zh,200)||!["draft","published","archived"].includes(v.status)||!(v.price_cents===null||Number.isSafeInteger(v.price_cents)&&v.price_cents>=0)||typeof v.description_en!=="string"||typeof v.description_zh!=="string"||v.description_en.length>5000||v.description_zh.length>5000)return fail("Invalid product");
 await env.DB.prepare("INSERT INTO products(id,slug,title_en,title_zh,description_en,description_zh,price_cents,status) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title_en=excluded.title_en,title_zh=excluded.title_zh,description_en=excluded.description_en,description_zh=excluded.description_zh,price_cents=excluded.price_cents,status=excluded.status,updated_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(),v.slug,v.title_en,v.title_zh,v.description_en,v.description_zh,v.price_cents,v.status).run();return json({ok:true});
 }
 }
 return fail("Not found",404);
 }catch(e){if(e instanceof SyntaxError||["Expected JSON","Missing body","Body too large","Invalid body"].includes(e.message))return fail("Invalid request");return fail("Request failed",500)}
}
