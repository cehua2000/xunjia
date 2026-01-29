export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
  const body = await new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
    });
  });

  const PLATFORMS = ['京东', '淘宝', '途虎', '1688'];

  function randomDelay(min = 200, max = 1200) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function simulatePlatformFetch(oe, platform) {
    return new Promise((resolve, reject) => {
      const delay = randomDelay(200, 1200);
      setTimeout(() => {
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

  let oeList = [];
  if (body.oe_codes && Array.isArray(body.oe_codes)) oeList = body.oe_codes.slice(0, 500);
  else if (body.oe_code) oeList = [String(body.oe_code)];
  else return res.status(400).json({ code: 400, message: 'oe_code 或 oe_codes 必填' });

  const overallTimeout = 10000;

  try {
    const tasks = oeList.map(async (oe) => {
      const platformPromises = PLATFORMS.map(async (p) => {
        let attempt = 0;
        while (attempt < 3) {
          attempt += 1;
          try {
            const r = await simulatePlatformFetch(oe, p);
            return r;
          } catch (err) {
            if (attempt >= 3) return { error: true, platform: p, message: err.message };
            await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
          }
        }
      });

      const results = await withTimeout(Promise.allSettled(platformPromises), overallTimeout);
      const items = results
        .filter((s) => s.status === 'fulfilled' && s.value && !s.value.error)
        .map((s) => s.value)
        .sort((a, b) => a.price - b.price);
      return { oe, items, raw: results };
    });

    const all = await withTimeout(Promise.all(tasks), overallTimeout + 2000);

    if (oeList.length === 1) {
      const r = all[0];
      if (!r.items || r.items.length === 0) return res.status(404).json({ code: 404, message: '未找到数据', data: [] });
      return res.status(200).json({ code: 200, message: 'success', data: r.items });
    }

    const data = {};
    const summary = [];
    all.forEach((r) => {
      data[r.oe] = r.items;
      summary.push({ oe: r.oe, lowest: r.items[0] || null, count: r.items.length });
    });

    return res.status(200).json({ code: 200, message: 'success', data, summary });
  } catch (err) {
    if (err.message && err.message.includes('timeout')) {
      return res.status(504).json({ code: 504, message: '查询超时，已返回部分结果' });
    }
    return res.status(500).json({ code: 500, message: err.message || '服务器错误' });
  }
}
