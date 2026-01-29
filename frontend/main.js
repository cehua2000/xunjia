async function postJSON(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return resp.json();
}

const oeInput = document.getElementById('oeInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const progressDiv = document.getElementById('progress');
const fileInput = document.getElementById('fileInput');
const exportBtn = document.getElementById('exportBtn');

let latestData = null;

function renderSingleList(list) {
  if (!list || list.length === 0) return '<div class="text-red-500">未找到结果</div>';
  let html = '<div class="grid gap-2">';
  list.forEach(item => {
    html += `<div class="p-3 border rounded bg-white flex justify-between items-center">
      <div>
        <div class="font-semibold">${item.product_name}</div>
        <div class="text-sm text-gray-600">${item.supplier_name} · ${item.platform}</div>
      </div>
      <div class="text-right">
        <div class="text-xl text-red-600">¥${item.price.toFixed(2)}</div>
        <a class="text-sm text-blue-600" href="${item.product_url}" target="_blank">去购买</a>
      </div>
    </div>`;
  });
  html += '</div>';
  return html;
}

function renderBatchSummary(summary) {
  if (!summary || summary.length === 0) return '<div class="text-red-500">无批量结果</div>';
  let html = '<table class="w-full table-auto border-collapse">\n    <thead><tr class="bg-gray-100"><th class="p-2">OE码</th><th class="p-2">最低价</th><th class="p-2">来源平台</th><th class="p-2">命中数</th></tr></thead><tbody>';
  summary.forEach(s => {
    html += `<tr class="border-t"><td class="p-2">${s.oe}</td><td class="p-2">${s.lowest ? '¥' + s.lowest.price.toFixed(2) : '-'}</td><td class="p-2">${s.lowest ? s.lowest.platform : '-'}</td><td class="p-2">${s.count}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

searchBtn.addEventListener('click', async () => {
  const oe = oeInput.value && oeInput.value.trim();
  if (!oe) {
    alert('请输入有效的 OE 码');
    return;
  }
  progressDiv.textContent = '正在搜索...';
  resultsDiv.innerHTML = '';
  try {
    const resp = await postJSON('/api/search', { oe_code: oe });
    if (resp.code !== 200) {
      progressDiv.textContent = resp.message || '查询失败';
      return;
    }
    latestData = resp.data;
    progressDiv.textContent = '查询完成';
    resultsDiv.innerHTML = renderSingleList(resp.data);
  } catch (err) {
    progressDiv.textContent = '请求失败：' + err.message;
  }
});

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  progressDiv.textContent = '读取文件...';
  const text = await f.text();
  // parse simple CSV or newline list
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 500);
  if (lines.length === 0) { progressDiv.textContent = '文件中未找到 OE 码'; return; }
  progressDiv.textContent = `批量查询 ${lines.length} 条...`;
  try {
    const resp = await postJSON('/api/search', { oe_codes: lines });
    if (resp.code !== 200) { progressDiv.textContent = resp.message || '批量查询失败'; return; }
    latestData = resp.data;
    progressDiv.textContent = '批量查询完成';
    resultsDiv.innerHTML = renderBatchSummary(resp.summary);
  } catch (err) {
    progressDiv.textContent = '请求失败：' + err.message;
  }
});

exportBtn.addEventListener('click', () => {
  if (!latestData) { alert('暂无数据可导出'); return; }
  // flatten latestData: if object (batch) -> array
  let rows = [];
  if (Array.isArray(latestData)) {
    rows = latestData.map(r => ({ OE码: r.oe_code, 产品名称: r.product_name, 价格: r.price, 供应商: r.supplier_name, 平台: r.platform, 链接: r.product_url }));
  } else {
    Object.keys(latestData).forEach(oe => {
      const items = latestData[oe] || [];
      items.forEach(i => rows.push({ OE码: oe, 产品名称: i.product_name, 价格: i.price, 供应商: i.supplier_name, 平台: i.platform, 链接: i.product_url }));
    });
  }
  if (rows.length === 0) { alert('暂无数据可导出'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '比价结果');
  const now = new Date();
  const fn = `汽配比价_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, fn);
});
