# Chatbot App (Flutter)

Android + iOS 跨平台客户端，基于 Flutter + Riverpod + go_router。

## 目录约定（feature-first）

```
lib/
  core/              # 基础设施（router、theme、network、socket、storage）
  shared/            # 跨 feature 复用 widgets/models
  features/
    auth/            # 注册/登录/忘记密码（阶段 1）
    contacts/        # 通讯录与好友（阶段 1）
    chat/            # 1对1+群+Bot 复用同一聊天 UI（阶段 2）
    groups/          # 群聊（P1）
    bots/            # 创建/详情/市场（阶段 3）
    wallet/          # 钱包与订阅（P1）
    settings/        # 设置
  l10n/              # 国际化 ARB
  main.dart
```

## 本地启动

> 当前仓库**只有 lib/** 代码，platform 目录（android/、ios/、test/）需要本机生成。
>
> 必须有本地 Flutter SDK，参考 https://docs.flutter.dev/get-started/install。

```bash
# 1. 在 app/ 目录补齐 platform 目录（首次执行）
flutter create . --org com.example --project-name chatbot_app --platforms=android,ios

# 2. 装依赖
flutter pub get

# 3. 生成 freezed/json_serializable/drift 等代码
dart run build_runner build --delete-conflicting-outputs

# 4. 启动模拟器或连真机后运行
flutter run
```

## 阶段 0 验收

- [x] `pubspec.yaml` 依赖清单完整
- [x] `lib/main.dart` Tab 框架（消息/通讯录/Bot/我）能打开 4 个空页面
- [x] `lib/core/router/app_router.dart` 路由总入口可见
- [ ] 用户在本机执行 `flutter create .` + `flutter pub get` + `flutter run` 看到 Tab UI

## 后续阶段（见 plan）

阶段 1：登录/注册/忘记密码 + 好友列表/请求
阶段 2：1 对 1 文字聊天 + 离线消息 + 推送
阶段 3：Bot 创建表单 + 与 Bot 聊天（流式）
阶段 4：图片消息 + 上架准备
