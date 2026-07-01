# FunDEX 基研

![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Vue](https://img.shields.io/badge/Vue-3.x-green?style=for-the-badge)
![Express](https://img.shields.io/badge/-BetterSQLite%203-brightgreen?style=for-the-badge)
![NODE.JS](https://img.shields.io/badge/-NODE.JS-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Development-orange?style=for-the-badge)
![Made with](https://img.shields.io/badge/Made%20with-%E2%9D%A4%20Courage%20and%20Vue.js-cyan?style=for-the-badge)

FunDEX基研是一款致力于解决国内理财软件广告杂乱问题与收费服务乱象的APP。该项目基于Vue和Tauri技术栈，使用Vite构建，全平台可编译。

## FunDEX解决了什么

FunDEX能便捷查看国内基金、国内股票、国际股票等金融信息，数据均来自于东方财富下属的天天基金网。

![APP主界面](ReadAssest/Main.png)

简洁、便利是FunDEX的视觉设计中心。我们致力于构建一个纯粹的数据软件，而不是营销软件，因此，FunDEX将不支持购入金融产品和相关行为。

## 快速开始

本项目的前端使用Vue+Tauri的解决方案，通过编写Vue前端，不仅在开发过程中能够实时查看热更，还能便捷编写全平台适配。

与此同时，后端使用了Node.js与Python工具混合编写，前端通过调用`server`之中的API，能快捷操作BetterSQLite3库，并将AKShark爬取的数据缓存到DB之中。

使用AKShark包，通过实时获取数据与后端分析，达到展示效果。

首先，请克隆本仓库的主分支。

```Bash
git clone https://github.com/OmaeKumiko529/FunDEX.git
git clone git@github.com:OmaeKumiko529/FunDEX.git
```

或使用CLI：

```Bash
|gh repo clone OmaeKumiko529/FunDEX
```

请注意，克隆完成后，务必检查本项目的关键目录结构。

```Bash
FunDEX/
├── src/          # Vue 前端
├── server/       # Express 后端
├── src-tauri/    # Tauri 桌面端
├── public/       # 静态资源
└── package.json  # 前端依赖清单
```

要开发操作，请先确保您的计算机上已安装以下内容：
- Node.js 22.18.0 或 24.12.0及以上版本
- Python 3.x
- Rust
- Cargo

首先进入项目根目录并安装必要的npm包体：

```Bash
cd FunDEX
npm install
```

等待安装完毕。然后进入`server`目录，同样补全必要的包体：

```Bash
cd server
npm install
pip install akshare --upgrade -i https://pypi.tuna.tsinghua.edu.cn/simple
```

随后运行`seed`脚本初始化sqlite表结构。

```Bash
cd server
npm run seed
```

到此处，所有准备工作已经完备。启动服务的方法如下：

```Bash
# 启动前端（Vite Dev Server，端口5173）
npm run dev

# 或启动 Tauri 桌面端（自动启动前端）
npm run tauri:dev
```

**注意：必须先启动后端服务，所有API才能正常响应。**

后端启动方式（在 `server` 目录下）：
```Bash
cd server

# 启动后端（开发模式，自动监听文件变更）
npm run dev
# 或 npx tsx watch src/index.ts

# 启动后端（生产模式）
npm start
# 或 npx tsx src/index.ts
```

> ⚠️ 根目录的 `npm run start` 运行的是交互式启动菜单（`scripts/dev.js`），需要手动选择测试模式。它也会自动启动后端，但主要用途是配合 Tauri/ADB 测试。

### 后端已就绪的验证

后端启动后，访问 http://localhost:3000/api/health ，预期返回：
```json
{ "status": "ok", "timestamp": "..." }
```

### WiFi ADB 真机测试

本项目使用 **Vite Proxy** 统一转发 `/api` 请求到后端，保证本机浏览器 / ADB 手机 / 虚拟机三种场景都不需要手动配置 IP。

- Tauri WiFi ADB 模式：自动设置 `TAURI_DEV_HOST` 为 PC 局域网 IP
- 虚拟机：Vite 绑定 `0.0.0.0:5173`，手机通过 `http://<PC局域网IP>:5173` 访问
- Vite proxy 自动将 `/api/*` 请求转发到 `localhost:3000`

> ❌ `.env` 中 `VITE_API_BASE` 已弃用，无需修改。
> ✅ 前端代码统一使用相对路径 `fetch('/api/...')`，适配所有场景。
