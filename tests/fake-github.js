const crypto = require("crypto");
const blobSha = (buf) => crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest("hex");

class FakeGitHub {
  constructor() { this.files = new Map(); this.log = []; this.offline = false; this.mode = null; this.expiry = null; }
  set(path, text) { const b = Buffer.from(text); this.files.set(path, { buf: b, sha: blobSha(b) }); }
  json(path) { return JSON.parse(this.files.get(path).buf.toString("utf8")); }
  edit(path, fn) { const d = this.json(path); fn(d); this.set(path, JSON.stringify(d, null, 2)); }
  count(kind) { return this.log.filter((l) => l.kind === kind).length; }
}
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization, Accept, X-GitHub-Api-Version, Content-Type", "access-control-allow-methods": "GET, PUT, OPTIONS", "access-control-expose-headers": "github-authentication-token-expiration, x-ratelimit-remaining" };
async function attachFake(page, getFake) {
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const url = req.url();
    if (!url.startsWith("https://api.github.com/")) return req.continue();
    const fake = getFake();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: cors, body: "" });
    if (fake.offline) return req.abort("internetdisconnected");
    const send = (status, body, headers = {}, raw = false) => req.respond({ status, headers: { ...cors, "content-type": raw ? "application/octet-stream" : "application/json", ...(fake.expiry ? { "github-authentication-token-expiration": fake.expiry + " 15:00:00 UTC" } : {}), ...headers }, body: raw ? body : JSON.stringify(body) });
    if (fake.mode === "401") return send(401, { message: "Bad credentials" });
    if (fake.mode === "403") return send(403, { message: "Resource not accessible" }, { "x-ratelimit-remaining": "4000" });
    if (fake.mode === "rate") return send(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0" });
    const u = new URL(url);
    const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/?(.*))?$/);
    if (!m) return send(404, { message: "Not Found" });
    if (m[3] === undefined) return send(200, { full_name: `${m[1]}/${m[2]}`, private: true, permissions: { push: true } });
    const path = decodeURIComponent(m[3] || "");
    if (req.method() === "PUT") {
      const body = JSON.parse((await req.fetchPostData()) || req.postData() || "{}");
      const cur = fake.files.get(path);
      if (cur && body.sha !== cur.sha) { fake.log.push({ kind: "put409", path }); return send(409, { message: "sha mismatch" }); }
      if (!cur && body.sha) { fake.log.push({ kind: "put422", path }); return send(422, { message: "sha for missing file" }); }
      fake.set(path, Buffer.from(body.content, "base64").toString("utf8"));
      const f = fake.files.get(path);
      fake.log.push({ kind: "put", path, message: body.message, baseSha: body.sha || null, bytes: f.buf.length });
      return send(cur ? 200 : 201, { content: { sha: f.sha, size: f.buf.length, path } });
    }
    const file = fake.files.get(path);
    if (file) {
      if ((req.headers()["accept"] || "").includes("raw")) { fake.log.push({ kind: "raw", path }); return send(200, file.buf, {}, true); }
      fake.log.push({ kind: "meta", path });
      return send(200, { sha: file.sha, size: file.buf.length, content: file.buf.toString("base64") });
    }
    const prefix = path ? path + "/" : "";
    const entries = [...fake.files.entries()].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"));
    if (path === "" || entries.length) { fake.log.push({ kind: "list", path }); return send(200, entries.map(([p, f]) => ({ name: p.slice(prefix.length), path: p, type: "file", sha: f.sha, size: f.buf.length }))); }
    return send(404, { message: "Not Found" });
  });
}


module.exports = { FakeGitHub, attachFake, blobSha };
