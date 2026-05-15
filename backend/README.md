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

## 后续阶段（见 plan）

阶段 3：bots + llm 网关
阶段 4：上传 + 内容审核 + 上架准备
