---
author: Deepraj Baidya
pubDatetime: 2025-09-10T15:22:00Z
title: Build your own Posthog - PART 4
slug: build-your-own-posthog-part-4
featured: false
draft: false
tags:
- analytics
- flutter
- dart
- sdk
- mobile
- client-side
- user-tracking
- session-management

description: Creating a Flutter SDK with user identification, session tracking, and robust event queuing.
---

Welcome to Part 4 of the SmolHog series! Today we're building the **Flutter SDK** - the client-side library that makes analytics tracking effortless for Flutter developers.

In the previous parts, we built the [backend infrastructure](https://infms.dev/build-your-own-posthog-part-3), [API Gateway](https://infms.dev/build-your-own-posthog-part-2),  Now it's time to create the SDK that developers will actually use in their apps.


## Project Structure

Start by creating a new Flutter Package using the command:

``` bash
flutter create --template=package smolhog_flutter
```

Then create an Example App inside the package (this will be helpful for testing our package)

```bash 
flutter create example
```

Our Flutter SDK will live in `smolhog_flutter/` with this structure:

```
smolhog_flutter/
├── lib/
│   ├── smolhog/
│   │   └── smolhog.dart          # Main SDK implementation
│   └── smolhog_flutter.dart      # Public API export
├── example/
│   └── lib/
│       └── main.dart             # Example usage
└── pubspec.yaml                  # Dependencies
```


## Core SDK Implementation

Let's start building the main SDK class in `smolhog_flutter/lib/smolhog/smolhog.dart`:

### Imports and Setup

```dart
import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
```


### Main SmolHog Class

```dart
class SmolHog {
  static SmolHog? _instance;
  static SmolHog get instance => _instance!;

  final String _apiKey;
  final String _host;
  String? _userId;
  String? _sessionId;
  final List<Map<String, dynamic>> _eventQueue = [];

  SmolHog._internal(this._apiKey, this._host);
```

**Key Design Decisions:**

- **Singleton Pattern**: Ensures single instance across the app
- **Private Constructor**: Control instantiation through `initialize()` method
- **Event Queue**: Store events locally for batch sending and offline support


### Initialization Method

```dart
static Future<void> initialize({
  required String apiKey,
  required String host,
}) async {
  _instance = SmolHog._internal(apiKey, host);
  await _instance!._setup();
}

Future<void> _setup() async {
  final prefs = await SharedPreferences.getInstance();

  // Get or generate persistent user ID
  _userId = prefs.getString('smolhog_user_id');
  if (_userId == null) {
    _userId = _generateId();
    await prefs.setString('smolhog_user_id', _userId!);
  }
  
  // Generate new session ID for each app launch
  _sessionId = _generateId();
}
```

**User ID Management:**

- **Persistent**: User IDs survive app restarts and updates
- **Anonymous**: No personal information required
- **Unique**: Each installation gets a unique identifier


### ID Generation

```dart
String _generateId() {
  final random = Random();
  return '${DateTime.now().millisecondsSinceEpoch}-${random.nextInt(99999)}';
}
```

This generates unique IDs using timestamp + random number, ensuring global uniqueness while being human-readable.

### Event Tracking

The core functionality - tracking user events:

```dart
Future<void> track(
  String eventName, {
  Map<String, dynamic>? properties,
}) async {
  if (_userId == null) return;
  
  final event = {
    'event_id': _generateId(),
    'event_name': eventName,
    'user_id': _userId!,
    'properties': properties ?? {},
    'timestamp': DateTime.now().toUtc().toIso8601String(),
    'session_id': _sessionId,
  };

  _eventQueue.add(event);
  await _sendEvents();
}
```

**Event Structure:**

- **event_id**: Unique identifier for deduplication
- **event_name**: Human-readable event type
- **user_id**: Anonymous user identifier
- **properties**: Custom event metadata
- **timestamp**: ISO 8601 formatted UTC timestamp
- **session_id**: Links events within the same app session


### Network Communication

```dart
Future<void> _sendEvents() async {
  if (_eventQueue.isEmpty) return;
  
  // Create copy and clear queue immediately
  final events = List<Map<String, dynamic>>.from(_eventQueue);
  _eventQueue.clear();

  try {
    final response = await http.post(
      Uri.parse('$_host/events'),
      headers: {
        'Content-Type': 'application/json',
        'smolhog-api-key': _apiKey
      },
      body: jsonEncode({'events': events}),
    );

    if (response.statusCode != 200) {
      // Re-queue events on failure
      _eventQueue.addAll(events);
      dev.log('Failed to send events: ${response.statusCode}');
    }
  } catch (e) {
    // Re-queue events on network error
    _eventQueue.addAll(events);
    dev.log('Error sending events: $e');
  }
}
```

**Robust Error Handling:**

- **Optimistic Clearing**: Remove events from queue before sending
- **Failure Recovery**: Re-add events to queue if sending fails
- **Network Resilience**: Handle both HTTP errors and network failures


## Screen Tracking Widget

For automatic screen view tracking, we'll create a wrapper widget:

```dart
class AnalyticsScreen extends StatefulWidget {
  final Widget child;
  final String screenName;

  const AnalyticsScreen({
    super.key,
    required this.child,
    required this.screenName,
  });

  @override
  _AnalyticsScreenState createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      SmolHog.instance.track(
        'screen_view',
        properties: {'screen_name': widget.screenName},
      );
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
```

**Automatic Screen Tracking:**

- **PostFrameCallback**: Ensures widget is fully built before tracking
- **Wrapper Pattern**: Easy to add to existing screens
- **Consistent Events**: Standardized 'screen_view' events


## Public API Export

Create `smolhog_flutter/lib/smolhog_flutter.dart`:

```dart
export 'package:smolhog_flutter/smolhog/smolhog.dart';
```

This creates a clean public API surface for package consumers.

## Package Configuration

Define dependencies in `smolhog_flutter/pubspec.yaml`:

```yaml

dependencies:
  flutter:
    sdk: flutter
  http: ^1.5.0
  shared_preferences: ^2.5.3
```


## Example Implementation

Let's create a complete example in `smolhog_flutter/example/lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:smolhog_flutter/smolhog_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize SmolHog SDK
  await SmolHog.initialize(
    apiKey: 'smolhog-ding-dong',
    host: 'http://localhost:8000',
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SmolHog Demo',
      home: AnalyticsScreen(
        screenName: 'home',
        child: HomePage(),
      ),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('SmolHog Demo')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              onPressed: () {
                SmolHog.instance.track(
                  'button_clicked',
                  properties: {
                    'button_type': 'cta',
                    'screen': 'home',
                    'timestamp': DateTime.now().toIso8601String(),
                  },
                );
              },
              child: Text('Track Button Click'),
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                SmolHog.instance.track(
                  'user_action',
                  properties: {
                    'action': 'navigation',
                    'destination': 'settings',
                  },
                );
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => AnalyticsScreen(
                      screenName: 'settings',
                      child: SettingsPage(),
                    ),
                  ),
                );
              },
              child: Text('Go to Settings'),
            ),
          ],
        ),
      ),
    );
  }
}

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Settings')),
      body: Center(
        child: ElevatedButton(
          onPressed: () {
            SmolHog.instance.track('settings_interaction');
            Navigator.pop(context);
          },
          child: Text('Go Back'),
        ),
      ),
    );
  }
}
```


## Advanced SDK Features

### Batch Event Sending

For production use, you might want to implement batching:

```dart
class SmolHog {
  Timer? _batchTimer;
  static const int _batchSize = 10;
  static const Duration _batchTimeout = Duration(seconds: 30);

  Future<void> track(String eventName, {Map<String, dynamic>? properties}) async {
    // ... event creation logic ...
    
    _eventQueue.add(event);
    
    // Send immediately if batch is full
    if (_eventQueue.length >= _batchSize) {
      await _sendEvents();
    } else {
      // Otherwise, start/reset batch timer
      _batchTimer?.cancel();
      _batchTimer = Timer(_batchTimeout, () => _sendEvents());
    }
  }
}
```


### User Identification

For logged-in users, add identification:

```dart
Future<void> identify(String userId, {Map<String, dynamic>? traits}) async {
  _userId = userId;
  
  // Persist the identified user
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('smolhog_user_id', userId);
  
  // Track identification event
  await track('user_identified', properties: traits);
}

Future<void> reset() async {
  // Clear user data and generate new anonymous ID
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove('smolhog_user_id');
  _userId = _generateId();
  _sessionId = _generateId();
  await prefs.setString('smolhog_user_id', _userId!);
}
```



## Testing the SDK

Run the example app:

```bash
cd smolhog_flutter/example
flutter pub get
flutter run
```

The app will:

1. Initialize the SDK with your backend URL
2. Track screen views automatically
3. Send custom events when buttons are pressed
4. Handle network failures gracefully


### Common Event Types

```dart
// User engagement
SmolHog.instance.track('button_clicked', properties: {'button_id': 'signup'});
SmolHog.instance.track('page_viewed', properties: {'page': 'pricing'});
SmolHog.instance.track('feature_used', properties: {'feature': 'dark_mode'});

// Business metrics
SmolHog.instance.track('purchase_completed', properties: {'amount': 29.99, 'currency': 'USD'});
SmolHog.instance.track('subscription_started', properties: {'plan': 'premium'});

// User journey
SmolHog.instance.track('onboarding_completed', properties: {'steps': 5});
SmolHog.instance.track('tutorial_skipped', properties: {'step': 'permissions'});
```


### Custom Properties

Use consistent property naming:

```dart
SmolHog.instance.track('video_played', properties: {
  'video_id': 'intro_tutorial',
  'duration': 120,
  'quality': '720p',
  'timestamp': DateTime.now().toIso8601String(),
});
```

In **Part 5**, we'll build the analytics dashboard that visualizes all this beautiful data! The dashboard will include real-time charts, user insights, and powerful filtering capabilities.

Till then, Happy Coding! 📱✨

