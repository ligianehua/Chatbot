enum BotGender { male, female, other }

BotGender? _parseGender(Object? v) {
  if (v == null) return null;
  return BotGender.values.firstWhere(
    (e) => e.name == v.toString(),
    orElse: () => BotGender.other,
  );
}

enum BotPriceType { free, monthly, oneoff, perMsg }

BotPriceType _parsePrice(Object? v) {
  switch (v) {
    case 'free':
      return BotPriceType.free;
    case 'monthly':
      return BotPriceType.monthly;
    case 'oneoff':
      return BotPriceType.oneoff;
    case 'per_msg':
      return BotPriceType.perMsg;
    default:
      return BotPriceType.free;
  }
}

String priceTypeWire(BotPriceType t) {
  switch (t) {
    case BotPriceType.free:
      return 'free';
    case BotPriceType.monthly:
      return 'monthly';
    case BotPriceType.oneoff:
      return 'oneoff';
    case BotPriceType.perMsg:
      return 'per_msg';
  }
}

class BotCreator {
  BotCreator({required this.id, required this.nickname, this.avatarUrl});
  factory BotCreator.fromJson(Map<String, dynamic> j) =>
      BotCreator(id: j['id'], nickname: j['nickname'], avatarUrl: j['avatarUrl']);
  final String id;
  final String nickname;
  final String? avatarUrl;
}

class Bot {
  Bot({
    required this.id,
    required this.creatorId,
    required this.name,
    required this.systemPrompt,
    required this.model,
    required this.temperature,
    required this.isPublic,
    required this.status,
    required this.priceType,
    required this.priceCents,
    required this.currency,
    this.avatarUrl,
    this.gender,
    this.age,
    this.occupation,
    this.bio,
    this.welcomeMsg,
    this.creator,
  });

  factory Bot.fromJson(Map<String, dynamic> json) {
    return Bot(
      id: json['id'] as String,
      creatorId: json['creatorId'] as String,
      name: json['name'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      gender: _parseGender(json['gender']),
      age: (json['age'] as num?)?.toInt(),
      occupation: json['occupation'] as String?,
      bio: json['bio'] as String?,
      systemPrompt: json['systemPrompt'] as String,
      model: json['model'] as String,
      temperature: (json['temperature'] as num).toDouble(),
      welcomeMsg: json['welcomeMsg'] as String?,
      isPublic: json['isPublic'] as bool,
      status: json['status'] as String,
      priceType: _parsePrice(json['priceType']),
      priceCents: (json['priceCents'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'USD',
      creator: json['creator'] is Map
          ? BotCreator.fromJson((json['creator'] as Map).cast<String, dynamic>())
          : null,
    );
  }

  final String id;
  final String creatorId;
  final String name;
  final String? avatarUrl;
  final BotGender? gender;
  final int? age;
  final String? occupation;
  final String? bio;
  final String systemPrompt;
  final String model;
  final double temperature;
  final String? welcomeMsg;
  final bool isPublic;
  final String status;
  final BotPriceType priceType;
  final int priceCents;
  final String currency;
  final BotCreator? creator;

  String get priceLabel {
    if (priceType == BotPriceType.free) return '免费';
    final amount = (priceCents / 100).toStringAsFixed(2);
    final sign = currency == 'CNY' ? '¥' : (currency == 'USD' ? '\$' : '');
    switch (priceType) {
      case BotPriceType.monthly:
        return '$sign$amount / 月';
      case BotPriceType.oneoff:
        return '$sign$amount (一次性)';
      case BotPriceType.perMsg:
        return '$sign$amount / 条';
      case BotPriceType.free:
        return '免费';
    }
  }
}

class CreateBotInput {
  CreateBotInput({
    required this.name,
    required this.systemPrompt,
    this.gender,
    this.age,
    this.occupation,
    this.bio,
    this.model,
    this.temperature,
    this.welcomeMsg,
    this.isPublic = false,
    this.priceType = BotPriceType.free,
    this.priceCents = 0,
  });

  final String name;
  final BotGender? gender;
  final int? age;
  final String? occupation;
  final String? bio;
  final String systemPrompt;
  final String? model;
  final double? temperature;
  final String? welcomeMsg;
  final bool isPublic;
  final BotPriceType priceType;
  final int priceCents;

  Map<String, dynamic> toJson() => {
        'name': name,
        if (gender != null) 'gender': gender!.name,
        if (age != null) 'age': age,
        if (occupation != null && occupation!.isNotEmpty) 'occupation': occupation,
        if (bio != null && bio!.isNotEmpty) 'bio': bio,
        'systemPrompt': systemPrompt,
        if (model != null) 'model': model,
        if (temperature != null) 'temperature': temperature,
        if (welcomeMsg != null && welcomeMsg!.isNotEmpty) 'welcomeMsg': welcomeMsg,
        'isPublic': isPublic,
        'priceType': priceTypeWire(priceType),
        if (priceType != BotPriceType.free) 'priceCents': priceCents,
      };
}
