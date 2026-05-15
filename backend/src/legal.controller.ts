import { Controller, Get } from '@nestjs/common';

/**
 * Public-facing legal documents. The app loads these for in-app display
 * and stores frozen copies in the App Store / Play Store metadata.
 *
 * Replace the placeholder bodies with reviewed copy before submission.
 * Apple Guideline 5.1.1 requires a working privacy URL; this provides it.
 */
@Controller()
export class LegalController {
  private readonly version = '2026-05-15';

  @Get('legal/privacy')
  privacy() {
    return {
      version: this.version,
      title: '隐私政策',
      body: [
        '本应用收集邮箱、昵称、设备 ID、推送 token 用于账户登录与消息推送。',
        '聊天内容存储于我方服务器以提供历史记录与多端同步；不会向第三方出售用户数据。',
        '你可以随时在「我 → 账号与安全 → 注销账号」彻底删除账户与全部消息。',
        '面向欧盟用户：依据 GDPR 你有权请求数据导出、更正与删除。',
        '安全事件联系：security@example.com。',
      ].join('\n\n'),
    };
  }

  @Get('legal/terms')
  terms() {
    return {
      version: this.version,
      title: '用户协议',
      body: [
        '使用本应用即表示同意：不发布违法、骚扰、色情、暴力或侵权内容。',
        '你创建的 Bot 应符合所在地法律与本应用社区准则；违规账号可被限制或封禁。',
        '本应用对用户因第三方 LLM 输出造成的损失不承担责任。',
        '我们保留依监管要求修改协议的权利；重大变更将在 App 内通知。',
      ].join('\n\n'),
    };
  }
}
