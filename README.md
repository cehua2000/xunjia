# 汽配全网比价查询工具（演示）

快速启动说明（Windows）：

1. 安装依赖：

```powershell
cd "d:\询价工具V"
npm install
```

2. 启动服务：

```powershell
npm start
```

3. 打开浏览器：

访问 http://localhost:3000 查看演示页面

说明：
- 后端使用 Express 提供静态页面与 `/api/search` 模拟接口（用于演示并发/超时/重试行为）。
- 前端使用 Tailwind（CDN）和 SheetJS（CDN）实现交互与 Excel 导出。

Vercel 部署说明：

1. 将项目推送到 GitHub（或 GitLab/Bitbucket）。

2. 在 Vercel 控制台中新建项目，选择你的仓库，默认即可部署。项目结构支持：
- 静态前端位于 `/frontend`（Vercel 将直接提供静态文件）
- 无服务器 API 位于 `/api/search.js`，Vercel 会自动部署为 Serverless Function

3. 部署完成后，访问 `https://<your-project>.vercel.app` 即可查看页面并调用 `/api/search`。

注意：Vercel 有免费额度，但长期运行或高并发时可能需要付费计划；若需要自定义域名或更高并发，请在 Vercel 控制台查看计费与限制说明。
