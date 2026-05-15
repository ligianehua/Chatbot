# Chatbot Backend

NestJS + Prisma + PostgreSQL + Redis + Socket.io 的聊天 APP 后端。

## 目录约定

```
src/
  prisma/             # PrismaService (数据库连接)
  health.controller   # /api/v1/health 健康检查
  app.module.ts       # 模块装配根
  main.ts             # 入口
prisma/
  schema.prisma       # 所有数据库表定义
docker-compose.yml    # 本地 PostgreSQL + Redis
.env.example          # 环境变量模板
```

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量
cp .env.example .env

# 3. 启动 PostgreSQL + Redis
npm run db:up

# 4. 生成 Prisma Client + 应用初始迁移
npm run prisma:generate
npm run prisma:migrate

# 5. 启动开发服务
npm run start:dev
```

服务监听 `http://localhost:3000/api/v1`，健康检查 `GET /api/v1/health`。

## 阶段 0 验收

- [x] `npm run build` 通过
- [x] `node dist/main.js` 启动成功
- [x] `/api/v1/health` 返回 `{status:"ok", db:"up|down", uptime, timestamp}`
- [x] Prisma schema 通过 `prisma validate`
- [x] `docker compose up -d` 可起 PostgreSQL + Redis（需要 docker daemon）

## 阶段 1 验收

20 项端到端测试全部通过（`test/e2e-flow.sh`）：

- [x] 邮箱注册（含密码强度校验）+ 重复注册 409
- [x] 邮箱登录 + 错误密码 401
- [x] JWT access + refresh，refresh 后老 token 失效（rotation）
- [x] `/users/me` 受 JwtAuthGuard 保护
- [x] 好友请求双向流转（pending → accepted），互相出现在好友列表
- [x] 忘记密码生成重置 token（dev 模式日志/接口返回；生产应改邮件发送）
- [x] 重置密码后所有旧 session 失效
- [x] 删除好友

跑测试：
```bash
npm run db:up                  # 或本机起 postgres
npm run prisma:migrate
npm run start:dev              # 终端 A
./test/e2e-flow.sh             # 终端 B
```

## 阶段 2 验收

12 项 WebSocket + REST 端到端检查通过（`test/e2e-chat.mjs`）：

- [x] 注册两个用户 + 互加好友 + 创建 direct 会话
- [x] 双端用 access token 连 Socket.io；非法 token 被拒
- [x] 单条消息 send → ack（带 client/server msg id）→ 对端 message:new
- [x] 50 条突发消息：全部送达、ID 唯一、按 snowflake 单调（客户端按 ID 排序）
- [x] 离线 5 条消息 → 重连后 `message:sync` 拉回准确数量
- [x] REST `/conversations` 含未读计数、`/conversations/:id/read` 清零
- [x] REST `/conversations/:id/messages` 分页（before cursor）

跑测试：
```bash
npm run start:dev          # 终端 A
node test/e2e-chat.mjs     # 终端 B
```

### Socket.io 协议

连接：`io(WS_URL, { auth: { token: <access> } })`

事件：
- `connect:ready` — 服务端鉴权成功
- `connect:error` — token 缺失/失效
- `message:send` (C→S) `{conversationId, text, clientMsgId, replyToId?}`
- `message:ack` (S→C) `{clientMsgId, message}` — 给发送者
- `message:new` (S→C) `{message}` — 给会话其他成员
- `message:sync` (C→S, ack) `{sinceMsgId?}` → `{messages: [...]}` — 离线/重连恢复
- `message:error` (S→C) `{clientMsgId, reason}`

注意：客户端必须按 `message.id` 排序而非到达顺序——并发处理下到达顺序不保证。

## 阶段 3 验收

10 项 LLM + Bot 端到端检查通过（`test/e2e-bot.mjs`）：

- [x] Bot CRUD（创建/查/改/删，owner 鉴权）
- [x] 打开 bot 会话幂等；首次自动种入开场白
- [x] WebSocket 流式回复：`bot:start` → 多个 `bot:chunk` → `bot:done`
- [x] chunks 拼接 == 最终落库消息文本
- [x] 内容审核：用户侧违禁词被拦截，输出侧也复审
- [x] 非创建者无法访问私有 Bot（403）
- [x] 删除 Bot 后 GET 404

环境变量：
- `LLM_API_KEY` 未配置时自动用 MockProvider（用于测试和无网开发）
- 配 DeepSeek：`LLM_API_KEY=sk-xxx`、`LLM_BASE_URL=https://api.deepseek.com`（默认）
- OpenAI 兼容服务可直接换 base URL

### Socket.io 协议（扩展）

- `bot:start` (S→C) `{conversationId, clientMsgId, botId}` — 开始流式
- `bot:chunk` (S→C) `{conversationId, clientMsgId, delta}` — 逐 token 推送
- `bot:done`  (S→C) `{conversationId, clientMsgId, message}` — 完成并落库

Bot 会话中用户发送依然走 `message:send`；服务端检测 `conversation.type === 'bot'` 后接入 LLM 网关。

## 阶段 4 验收

9 项发布准备 e2e 通过（`test/e2e-release.mjs`）：

- [x] `GET /legal/privacy`、`GET /legal/terms` 公开可读
- [x] 设备注册：`POST /users/me/devices` 入库（push token 占位）
- [x] 图片上传：`POST /uploads/image` multipart，10MB 上限，仅接受 image/* mimetype
- [x] 静态服务 `/uploads/*` 公开下载
- [x] Socket.io 发送 `type:'image'` 消息，对端正确收到 url/mime/size
- [x] 非 image mimetype 上传被 400 拒绝
- [x] `DELETE /users/me` 注销账户（Apple 5.1.1 强制），级联清除
- [x] 注销后旧 token 失效（401）、再次登录失败（401）

跑测试：
```bash
node test/e2e-release.mjs
```

### 上架阶段路线图

P0（已交付）：图片消息、账号删除入口、公开隐私/用户协议
P1（进行中）：
- [x] 群聊（GroupsModule，11 项 e2e 通过）
- [x] Bot 市场 + 订阅 + 钱包分账（16 项 e2e 通过，详见下面阶段 6）
- [ ] Apple IAP / Google Play Billing 替换 dev recharge
- [ ] Apple Sign-In / Google Sign-In
- [ ] 真实邮件服务接入替换 dev token 直返
- [ ] FCM / APNs 推送实装
- [ ] 图片内容审核（阿里云内容安全 / AWS Rekognition）
- [ ] S3 预签名上传替代本地存储

## 阶段 6 验收（P1 Bot 市场 + 订阅 + 钱包）

16 项 e2e 通过（`test/e2e-marketplace.mjs`）：

- [x] `GET /bots/marketplace`：只返回 isPublic + listed，支持 q 搜索
- [x] 未订阅时 `POST /bots/:id/conversation` 返回 403
- [x] 免费 Bot 订阅：直接 active，不扣钱包
- [x] 付费 Bot + 余额不足：400 insufficient balance
- [x] 充值 → 订阅 → 买家钱包扣款 + 创作者收益（70%，30% 平台抽成）
- [x] 重复订阅幂等（`already_subscribed`，不重复扣款）
- [x] `GET /bots/subscribed` 列我订阅的 Bot
- [x] 创建者不能订阅自己的 Bot（400）
- [x] 订阅成功后 LLM 流式回复正常工作
- [x] 取消订阅 → 对话访问立即 403
- [x] 私有 Bot 不接受外部订阅（403）

跑测试：
```bash
node test/e2e-marketplace.mjs
```

WalletModule 接口：
- `GET /wallet` — 余额
- `GET /wallet/transactions` — 交易明细
- `POST /wallet/recharge { amountCents }` — **DEV/MVP only**，生产环境替换为 IAP receipt 校验

订阅与分账：
- `POST /bots/:id/subscribe`：免费即激活；付费时一次性 debit + 同事务 credit 创作者（70%）
- 月订阅写入 `expiresAt = now + 30d`；`openConversation` 自动检查过期并标记
- `DELETE /bots/:id/subscribe`：把订阅置为 expired，下次 chat 直接 403

## 阶段 5 验收（P1 群聊）

11 项端到端检查通过（`test/e2e-groups.mjs`）：

- [x] 创建群聊（自动注入 owner + 邀请的好友，同步生成 type=group 的 conversation）
- [x] 不能邀请非好友（400）
- [x] 群对话出现在所有成员的 `/conversations` 列表里，title 等于群名
- [x] 群消息一对多广播（同一 server msg id 到所有成员）
- [x] 成员退群后 conversation_members 同步删除，不再收到广播
- [x] 群主不能退群（必须解散）
- [x] 管理员可重新邀请退群的好友
- [x] 解散群聊：group + conversation 同时删除，所有成员 conversation 列表清空
