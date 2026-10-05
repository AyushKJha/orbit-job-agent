// Deploy inside Supabase as orbit-storage. The project key never leaves Supabase.
// Replace this digest in the deployment copy with SHA-256 of a random 32-byte token.
const TOKEN_SHA256 = 'REPLACE_WITH_ORBIT_TOKEN_SHA256';
const MAX_BYTES = 12 * 1024 * 1024;
const objectPattern = /^(manifest|versions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const failure = (status) => Response.json({error: 'Storage request denied'}, {status});

export function createHandler({env, fetcher = fetch, tokenHash = TOKEN_SHA256}) {
  return async (req) => {
    try {
      const token = req.headers.get('x-orbit-token') || '';
      if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(tokenHash)) return failure(401);
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
      const expected = Uint8Array.from(tokenHash.match(/../g), x => parseInt(x,16));
      let mismatch = 0; for (let i=0;i<32;i++) mismatch |= hash[i] ^ expected[i];
      if (mismatch) return failure(401);
      const url = new URL(req.url), name = url.searchParams.get('object');
      if (!name || !objectPattern.test(name) || [...url.searchParams.keys()].some(k=>k!=='object') || url.searchParams.getAll('object').length!==1) return failure(400);
      if (!['GET','POST','DELETE'].includes(req.method)) return failure(405);
      if (req.method==='DELETE' && name==='manifest') return failure(403);
      const base = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base||'') || !key) return failure(503);
      const headers = {apikey:key, Authorization:'Bearer '+key};
      let body, suffix = '/'+name;
      if (req.method==='POST') {
        if (Number(req.headers.get('content-length'))>MAX_BYTES) return failure(413);
        const reader = req.body?.getReader(); if (!reader) return failure(400);
        const chunks=[]; let length=0;
        while (true) { const {done,value}=await reader.read(); if(done)break; length+=value.length;
          if(length>MAX_BYTES){await reader.cancel();return failure(413);} chunks.push(value); }
        body=new Uint8Array(length); let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
        if(length<32 || new TextDecoder().decode(body.subarray(0,4))!=='ORB1')return failure(400);
        headers['Content-Type']='application/octet-stream';headers['x-upsert']='true';
      }
      if(req.method==='DELETE'){suffix='';headers['Content-Type']='application/json';body=JSON.stringify({prefixes:[name]});}
      const result=await fetcher(base+'/storage/v1/object/orbit-private'+suffix,{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(25000)});
      if(!result.ok){const data=await result.json().catch(()=>({}));return failure(result.status===404||String(data.statusCode)==='404'||data.error==='not_found'?404:502);}
      return req.method==='GET'?new Response(result.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}}):Response.json({ok:true});
    }catch{return failure(502);}
  };
}

if (typeof Deno !== 'undefined') Deno.serve(createHandler({env:name=>Deno.env.get(name)}));
