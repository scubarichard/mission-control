import https from "https";
import urlMod from "url";

function httpGet(rawUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const opts = {hostname:parsed.hostname,path:parsed.path,method:'GET',headers:headers||{}};
    const req = https.request(opts, res => {
      let b=''; res.on('data',c=>b+=c);
      res.on('end',()=>{let j=null;try{j=JSON.parse(b)}catch{}resolve({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,json:j});});
    });
    req.on('error',reject);req.end();
  });
}

const OLD_LOC = "OkpQxkeSnF4wqI31WmUg";

// Try old token
const r1 = await httpGet("https://services.leadconnectorhq.com/locations/" + OLD_LOC, {
  "Authorization": "Bearer pit-e0fb69ba-1b78-46cd-9541-c196830e0826", "Version": "2021-07-28"
});
console.log("Old PIT token:", r1.ok ? "ACCESS - " + (r1.json?.name || "ok") : "DENIED (" + r1.status + ")");

// Try rotated agency
const r2 = await httpGet("https://services.leadconnectorhq.com/locations/" + OLD_LOC, {
  "Authorization": "Bearer pit-985d65f7-a742-4ec1-a299-55ae6ec3a77c", "Version": "2021-07-28"
});
console.log("New agency token:", r2.ok ? "ACCESS - " + (r2.json?.name || "ok") : "DENIED (" + r2.status + ")");
