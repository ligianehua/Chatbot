# Chatbot

跨平台聊天 APP（Android + iOS），核心差异化：用户可创建带人设的 Chatbot 并通过订阅分享给好友。

## 仓库结构

```
.
├── backend/   # NestJS + Prisma + PostgreSQL + Redis + Socket.io
└── app/       # Flutter 客户端（Android + iOS 共用代码）
```

## 快速开始

后端（本机有 Node 22+ 和 Docker）：
```bash
cd backend
npm install
cp .env.example .env
npm run db:up
npm run prisma:generate && npm run prisma:migrate
npm run start:dev
# 访问 http://localhost:3000/api/v1/health
```

客户端（本机有 Flutter SDK）：
```bash
cd app
flutter create . --org com.example --project-name chatbot_app --platforms=android,ios
flutter pub get
flutter run
```

详细说明见 `backend/README.md` 和 `app/README.md`。

## 路线图

阶段 0（已完成）：项目初始化骨架
阶段 1：注册/登录/忘记密码 + 加好友
阶段 2：1 对 1 文字聊天（Socket.io）
阶段 3：Bot 创建 + 与 Bot 流式对话
阶段 4：图片消息 + 海外上架（App Store + Google Play）

P1：群聊、Bot 市场、月订阅付费、语音消息、国内上架
P2：视频通话、RAG 知识库、创作者分账

完整计划见 `/root/.claude/plans/android-ios-app-1-ui-2-greedy-dolphin.md`。
