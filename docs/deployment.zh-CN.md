# 部署上线指南

本项目适合先部署为单台 Linux 服务器上的个人或小组学习服务。现有 `compose.yaml` 已包含 Next.js、Caddy HTTPS、访问口令和持久化数据卷，无需另外搭建数据库。

以下命令在 **Linux 服务器**执行。本轮只提供部署方法，没有操作你的服务器或发布应用。

## 1. 准备服务器和域名

- 安装 Git、Docker Engine 和 Docker Compose 插件，例如使用 Ubuntu 24.04 LTS。按照 [Docker 官方安装说明](https://docs.docker.com/engine/install/ubuntu/)安装；已有 Docker 的服务器先核对版本，无需重新安装。
- 将域名的 A 记录指向服务器公网 IPv4 地址。只有配置了可用 IPv6 时才添加 AAAA 记录。
- 在云服务器安全组和主机防火墙中放行 TCP 80、443；SSH 22 端口留给管理员。应用的 3000 端口只供容器内部访问。
- 先保持一个应用实例。当前账号、笔记、图片和同步数据保存在本地文件中，不能让多个应用实例同时写同一个数据卷。

先确认工具可用：

```bash
git --version
docker version
docker compose version
```

## 2. 获取代码和填写配置

```bash
git clone https://github.com/lizr-phys/physics-learning-agent.git
cd physics-learning-agent
cp .env.production.example .env.production
chmod 600 .env.production
```

为站点外层访问口令生成哈希。终端会读取密码，不把明文写入命令：

```bash
docker run --rm -it caddy:2-alpine caddy hash-password
```

用编辑器打开 `.env.production`，修改以下值：

```dotenv
PLA_SITE_ADDRESS=physics.your-domain.com
PLA_PILOT_USERNAME=tester
PLA_PILOT_PASSWORD_HASH='粘贴刚生成的完整哈希'

DEEPSEEK_API_KEY=填写你的服务端密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
PLA_DATA_DIR=/data
```

域名不带 `https://`。保留哈希外层的单引号，避免其中的 `$` 被配置插值处理。配置文件留在服务器，不上传 GitHub。

`deepseek-flash` 是当前项目默认的识图模型标识。也可以把服务端密钥留空，让使用者在 **API Settings → My API key** 填写自己的密钥；仅查看页面不需要调用模型。生成限额等其余配置先保留示例值，再根据实际使用情况调整。

## 3. 启动服务

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app proxy
```

首次构建需要下载依赖、基础镜像和构建时使用的字体；访问者的浏览器从本站加载字体。若构建因内存不足被终止，先处理服务器构建资源，再重试，不要清除数据卷。

验证内部健康状态：

```bash
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1); })"
```

然后访问 `https://你的域名`。先输入上面配置的站点访问口令，再在 Personal Knowledge Base 创建个人账号。外层口令用于限制站点访问，个人账号用于隔离各自的数据。

域名解析、80/443 端口和配置正确时，Caddy 自动申请并续期 HTTPS 证书。应用返回 `text/event-stream`，Caddy 会立即转发；不设置负值 `flush_interval`，以保留客户端取消向上游传递的行为。真实服务器上仍需验证停止生成和流式输出。[Caddy HTTPS 说明](https://caddyserver.com/docs/automatic-https)、[代理流式说明](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#streaming)。

## 4. 用测试账号验收

1. 在 API Settings 测试连接，再发送一个问题，确认回复逐步显示，停止生成后上游请求也能结束。
2. 拍照上传一道自有题目，核对转录内容后保存，刷新页面检查文字和原图。
3. 上传一份测试笔记，在 Chat 的 Options 中选择资料，检查实际引用片段。
4. 生成练习，检查隐藏答案、继续生成和 `.tex` 下载。
5. 切换两个测试账号，确认资料相互隔离；确认保存状态为 Saved。
6. 在手机上检查侧边栏、输入框、表格和长公式。

本地模拟测试不能代替以上真实服务检查，也不证明模型的物理答案正确。

## 数据、更新和备份

服务器数据保存在 Docker 卷 `pla-pilot-data` 中，包括账号、会话、笔记、图片和索引。普通重建容器会继续使用这个卷。**不要执行 `docker compose down -v` 或清理该卷**；这些操作会删除数据。[Docker 数据卷说明](https://docs.docker.com/engine/storage/volumes/)。

更新前，先按[完整运维手册](pilot-deployment.md#4-back-up-persistent-data)备份该卷并将备份复制到另一台设备；需要一致性备份时安排短暂停止写入。保留当前提交号，然后更新：

```bash
git rev-parse HEAD
git pull --ff-only
docker compose up -d --build
docker compose ps
```

更新失败时可回到记录的旧提交并重新构建，保持数据卷不变。恢复备份先在独立的新卷中验证，不覆盖正在使用的数据。

## 常见问题

| 现象 | 检查位置 |
| --- | --- |
| HTTPS 无法打开 | 域名 A/AAAA 记录、80/443 放行、`docker compose logs proxy` |
| 502 或 app 不健康 | `docker compose logs app`，再执行内部健康检查 |
| 页面正常，但没有模型回复 | API Settings 的连接方式、密钥和模型名称；服务器到模型服务的网络 |
| 回复等到最后才一起显示 | 保留 Caddy 的流式配置；新增 CDN/代理时检查是否缓冲回复 |
| 重建后看不到旧数据 | 检查 `pla-pilot-data` 是否仍挂载到 `/data`；不要创建覆盖性“修复”数据 |

更完整的限额、备份恢复和试测流程见[英文部署手册](pilot-deployment.md)。
