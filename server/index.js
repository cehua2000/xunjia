const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve frontend static files
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

const PLATFORMS = ['京东', '淘宝', '途虎', '1688'];

function randomDelay(min = 200, max = 1200) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function simulatePlatformFetch(oe, platform) {
  return new Promise((resolve, reject) => {
    const delay = randomDelay(200, 1200);
    setTimeout(() => {
      // simulate occasional failure
      if (Math.random() < 0.08) return reject(new Error('平台请求失败'));

      const priceBase = 50 + (oe.length % 50);
      const price = (priceBase + Math.random() * 200).toFixed(2);
      resolve({
        oe_code: oe,
        product_name: `${platform} 商品 ${oe}`,
        price: Number(price),
        supplier_name: `${platform} 店铺`,
        location: '广东省广州市',
        rating: (3 + Math.random() * 2).toFixed(1),
        product_image: 'https://via.placeholder.com/150',
        product_url: `https://example.com/${platform}/item/${oe}`,
        platform
      });
    }, delay);
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

app.post('/api/search', async (req, res) => {
  const body = req.body || {};
  // support either { oe_code: '...' } or { oe_codes: ['...'] }
  let oeList = [];
  if (body.oe_codes && Array.isArray(body.oe_codes)) oeList = body.oe_codes.slice(0, 500);
  else if (body.oe_code) oeList = [String(body.oe_code)];
  else return res.status(400).json({ code: 400, message: 'oe_code 或 oe_codes 必填' });

  const overallTimeout = 10000; // ms

  try {
    const tasks = oeList.map(async (oe) => {
      // for each OE, fetch from all platforms in parallel with per-platform retry
      const platformPromises = PLATFORMS.map(async (p) => {
        let attempt = 0;
        while (attempt < 3) {
          attempt += 1;
          try {
            const r = await simulatePlatformFetch(oe, p);
            return r;
          } catch (err) {
            if (attempt >= 3) return { error: true, platform: p, message: err.message };
            // exponential backoff
            await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
          }
        }
      });

      // wait for platform promises but respect overall timeout
      const results = await withTimeout(Promise.allSettled(platformPromises), overallTimeout);

      // normalize results
      const items = results
        .filter((s) => s.status === 'fulfilled' && s.value && !s.value.error)
        .map((s) => s.value)
        .sort((a, b) => a.price - b.price);

      return { oe, items, raw: results };
    });

    const all = await withTimeout(Promise.all(tasks), overallTimeout + 2000);

    // if single oe, return data array; if batch, return mapping and summary
    if (oeList.length === 1) {
      const r = all[0];
      if (!r.items || r.items.length === 0) return res.status(404).json({ code: 404, message: '未找到数据', data: [] });
      return res.json({ code: 200, message: 'success', data: r.items });
    }

    const data = {};
    const summary = [];
    all.forEach((r) => {
      data[r.oe] = r.items;
      summary.push({ oe: r.oe, lowest: r.items[0] || null, count: r.items.length });
    });

    return res.json({ code: 200, message: 'success', data, summary });
  } catch (err) {
    if (err.message && err.message.includes('timeout')) {
      return res.status(504).json({ code: 504, message: '查询超时，已返回部分结果' });
    }
    return res.status(500).json({ code: 500, message: err.message || '服务器错误' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
