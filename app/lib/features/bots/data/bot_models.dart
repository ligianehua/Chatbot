enum BotGender { male, female, other }

BotGender? _parseGender(Object? v) {
  if (v == null) return null;
  return BotGender.values.firstWhere(
    (e) => e.name == v.toString(),
    orElse: () => BotGender.other,
  );
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
    this.avatarUrl,
    this.gender,
    this.age,
    this.occupation,
    this.bio,
    this.welcomeMsg,
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
      };
}
