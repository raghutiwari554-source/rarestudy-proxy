import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// ====================== PROXY ROUTE ======================
app.use('/proxy', createProxyMiddleware({
  router: (req) => {
    let target = req.query.url || req.query.target;
    if (!target) return 'https://example.com';
    return target.startsWith('http') ? target : `https://${target}`;
  },
  changeOrigin: true,
  selfHandleResponse: true,

  onProxyReq: (proxyReq, req) => {
    // Normal cookies
    if (req.headers.cookie) {
      proxyReq.setHeader('Cookie', req.headers.cookie);
    }

    // JSON Cookies Injection (Array Format)
    let injectCookies = [];

    if (req.query.cookies) {
      try {
        const data = JSON.parse(req.query.cookies);
        const cookiesArray = Array.isArray(data) ? data : [data];
        
        injectCookies = cookiesArray.map(cookie => {
          if (cookie && cookie.name && cookie.value !== undefined) {
            return `\( {cookie.name}= \){cookie.value}`;
          }
          return null;
        }).filter(Boolean);
      } catch (e) { console.log("Cookie parse error"); }
    }

    if (injectCookies.length > 0) {
      const cookieHeader = injectCookies.join('; ');
      let existing = proxyReq.getHeader('Cookie') || '';
      proxyReq.setHeader('Cookie', existing ? `${existing}; ${cookieHeader}` : cookieHeader);
    }
  },

  onProxyRes: (proxyRes) => {
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['strict-transport-security'];
    proxyRes.headers['x-frame-options'] = 'ALLOWALL';
  }
}));

// Home Page with UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rarestudy Proxy</title>
      <style>
        body { margin:0; font-family: Arial; background:#0f0f0f; color:#fff; }
        .bar { background:#1a1a1a; padding:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        input, textarea { padding:10px; border-radius:6px; border:none; font-size:15px; }
        button { padding:12px 20px; background:#0066ff; color:white; border:none; border-radius:6px; cursor:pointer; }
        iframe { width:100%; height:calc(100vh - 170px); border:none; }
      </style>
    </head>
    <body>
      <div class="bar">
        <input type="text" id="url" value="https://rarestudy.in/batches" style="flex:1">
        <button onclick="loadSite()">Load</button>
      </div>

      <div class="bar">
        <textarea id="jsonCookies" rows="8" style="flex:1; font-family: monospace; font-size:13px;">${JSON.stringify([
          {
            "name": "session",
            "value": ".eJwV0keyo1YAAMC7aMtMiSTCVHkBDxFEFpnNL8JDBJEzLt_ddp-h_779DHBqkw52y-3PMq3w1y3JMjjPP0vfwO7257aovmCaAEDI8MnAz7mLx8jJXfFsRo552ojCUZzsQhGLS91TfKRLYivjw_JcokA1NcsjvyGKwPXNhPQ-oXNXCKl3eAgADPrg1GtFfNvRPkkkvYXdYHa3TBAkIe41vYUg45UtCi-cKiX0MHNQHQTurop-T01bldlW902-WfNHaMaKz6WGYLuc4SXvZ-XD1KG2Icg_04O2LwSsocmgyIaQ8sotqhzYFqpa5WpRVFIkQi2i49WsBdGeXY8EYvYhdgNnsUsEVY6FCal1AdzbbyTL3roBjHL0AP3O2f2uuuKQti3iXWdBS4JvHHhhVxZluwBin0Uz3V2YJVNBvpMnOQco7sMeP-wpdSE0ShMlcX6vMLQjmhmQT5H_eMi-Q9t9UgeYjjP3Y9TB6UCU3pknCWbDmgobLJhHUOk6PafilFXiPmKzhDrQU_NQzDC5bmmtLLtIJrq1ye6Bc1DJ6QW8TIKjrMQ-Mo4HHws1FUE-eNmE_h5r55KCMcUQ2yzgGJKqBDJwoT5bosV0ZuRrx3yiVqa8akJJy-gzF0XBzpDZfjOdobu0NukKPHNaxESEqJ1My5QexYPS7ltV3z3B-tZgZFTccSq9_JCXgS3NaRthLR_Wc-FUiy0XoVvjE0GRetvuvOPQuTl5urvDiC80ivc2JtUChDOskPw6E918rv0MojE7Cwq8iydUAkTK0EWxyZeg6jhDyrplpVT7iHjJSupniIIsgd_NVdlsKlujYKuij9IE-GX54ri_br9u0_wz_9e_6v-_v-mb-7SepHSNokNmvbP2feShr-3hfzCiIGT5DDhqjsqelxxt_LaawBZV9hiGVxxETlG2qMlUP5CwknFRtWGkgIGdv4n9ysu1zpsftjnhobCker7mBD8oYzTSUp8lmm6ep0H9jgh2FnHUeM26glZUxDGjGGvDghHhpV1vEh_2VVBWJR4-EgDAyxmqaHk6Y7WCWmz_9s-_XXVH5Q.af7RZA.L998vzLMoc_aMScuGAS5X-t5JBQ"
          },
          {
            "name": "session_expiry",
            "value": "1778393825200"
          }
        ], null, 2)}</textarea>
        <button onclick="injectAndLoad()">Inject Cookies + Load</button>
      </div>

      <iframe id="frame" src="/proxy?url=https://rarestudy.in/batches"></iframe>

      <script>
        function loadSite() {
          const url = document.getElementById('url').value;
          document.getElementById('frame').src = '/proxy?url=' + encodeURIComponent(url);
        }

        function injectAndLoad() {
          const url = document.getElementById('url').value;
          let jsonStr = document.getElementById('jsonCookies').value.trim();
          let proxyUrl = '/proxy?url=' + encodeURIComponent(url);
          if (jsonStr) proxyUrl += '&cookies=' + encodeURIComponent(jsonStr);
          document.getElementById('frame').src = proxyUrl;
        }
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server Running: http://localhost:${PORT}`);
});
