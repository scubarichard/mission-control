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

const TOKEN = "pit-ff564790-ae77-4fcc-92c0-5ef4fb2ee66a";
const LOC = "OkpQxkeSnF4wqI31WmUg";

const r = await httpGet("https://services.leadconnectorhq.com/locations/" + LOC, {
  "Authorization": "Bearer " + TOKEN, "Version": "2021-07-28"
});

if (r.ok) {
  console.log("ACCESS - Location:", r.json?.name || r.json?.location?.name || "ok");
} else {
  console.log("DENIED (" + r.status + ")");
  console.log(JSON.stringify(r.json).slice(0, 200));
}
