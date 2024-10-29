---
author: Deepraj Baidya
pubDatetime: 2024-08-19T15:22:00Z
title: GoogleSignIn Macos - Flutter
slug: google-sign-in-macos-flutter
featured: true
draft: false
tags:
  - docs
  - flutter
  - macos
  - OAuth
  - firebase
  - google-sign-in

description: In this guide, we’ll walk you through the steps needed to seamlessly add Google Sign-In to your Flutter macOS app.
---

Integrating Google Sign-In into your Flutter app is a great way to enhance user experience by offering a quick and easy authentication process. While setting this up for Android and iOS is well-documented, the macOS platform often gets overlooked. In this guide, we’ll walk you through the steps needed to seamlessly add Google Sign-In to your Flutter macOS app. Whether you’re expanding your existing Flutter project or starting fresh, this tutorial will equip you with everything you need to implement secure and reliable authentication for macOS users. Let’s dive in and get started!

### **Prerequisites :**

1. [Flutter](https://flutter.dev/) : Obviously 😂
2. [Firebase](https://console.firebase.google.com/u/0/) : To enable google sign in as a Authentication Method we need to add Google as a provider in your Firebase Project.
3. [google_sign_in](https://pub.dev/packages/google_sign_in) : A Flutter plugin for [Google Sign In](https://developers.google.com/identity/).

## Step 1 : OSX Deployment Target

While the official google_sign_in package suggests to keep the minimum deployment target of 10.15+, but by default while creating a flutter app the minimum deployment for macos is set to 10.14, so let's start by changing this :

Navigate to your macos/Podfile file and simply change version as shown here:

```ruby
 platform :osx, '10.15'
```

now open the macos directory in xcode and do the following:

1. click on **Runner.**
2. Select **Info** from the tabview
3. Set the \`macOS Deployment Target\` to **10.15.**

   ![](https://cdn.hashnode.com/res/hashnode/image/upload/v1724023606127/7f4c43c7-391f-4e22-8ef7-f173e038cc26.png)

## Step 2 : OAuth client configuration in Google Cloud Console.

Create a Firebase project , add Google as an Auth Provider in the Authentication Section and then do the fun stuff (adding SHA, flutterfire_cli etc), once you're completely done setting up the project and initialising our Flutter App do :

1. visit the [GCP dashboard](https://console.cloud.google.com/welcome)
2. Select the Firebase project form the top left corner.
3. Click on APIs and Services

   ![](https://cdn.hashnode.com/res/hashnode/image/upload/v1724024824387/b69143be-0a5c-4963-9537-a363d44ba207.png)

4. Select **Credentials** from the left panel.
5. Click on the **Create Credentials** button and proceed as follows:

   ![](https://cdn.hashnode.com/res/hashnode/image/upload/v1724025218030/fb65c4fe-c79d-4b1a-9d34-d35ac71d00d8.png)

   ![](https://cdn.hashnode.com/res/hashnode/image/upload/v1724025246595/9dcd350e-bde4-4baf-9970-965ad20f4691.png)

   ![](https://cdn.hashnode.com/res/hashnode/image/upload/v1724025414070/0e60e0c7-cb84-4950-9210-d73d5d01cb48.png)

   Just give it a Name for identification and your app's bundle ID, which you can find [here](https://stackoverflow.com/questions/51098042/how-to-get-bundle-id-in-flutter), then copy the Client ID and the IOS URL scheme.

6. Now open your **Info.plist** file \`macos/Runner\` and add the following key values

   ```xml
   <key>GIDClientID</key>
   		<string>CLIENT ID</string>
   		<key>CFBundleURLTypes</key>
   		<array>
   			<dict>
   				<key>CFBundleURLSchemes</key>
   				<array>
   					<string>iOS URL scheme</string>
   				</array>
   			</dict>
   		</array>
   ```

   now replace the paste the copied values in the fields.

7. Lastly add these to your **Release.entitlements** and **DebugProfile.entitlements** files under \`macos/Runner\` to allow networking in your macos app from client side.

   ```xml
   <key>com.apple.security.network.client</key>
   <true />
   ```

Seems like a lot of work , but the hard part is over.

Let's now move towards the flutter side of things.

## Step 3 : Flutter 😁

1. In your dependencies add [google_sign_in: ^6.2.1](https://pub.dev/packages/google_sign_in) and [firebase_core: ^3.3.0](https://pub.dev/packages/firebase_core).
2. (Optional) : cd into your macos directory and run these commands

   ```bash
   pod repo update
   pod update
   ```

3. Edit your \`main.dart\` file.

   ```dart
   import 'package:flutter/material.dart';
   import 'firebase_options.dart';
   import 'package:firebase_core/firebase_core.dart';
   import 'package:google_sign_in/google_sign_in.dart';

   void main() {
     await Firebase.initializeApp(
       options: DefaultFirebaseOptions.currentPlatform,
     );
     runApp(MyApp());
   }

   class MyApp extends StatelessWidget {
     @override
     Widget build(BuildContext context) {
       return MaterialApp(
         home: SignInDemo(),
       );
     }
   }

   class SignInDemo extends StatefulWidget {
     @override
     _SignInDemoState createState() => _SignInDemoState();
   }

   class _SignInDemoState extends State<SignInDemo> {
     GoogleSignInAccount? _currentUser;

     final GoogleSignIn _googleSignIn = GoogleSignIn();

     @override
     void initState() {
       super.initState();
       _googleSignIn.onCurrentUserChanged.listen((GoogleSignInAccount? account) {
         setState(() {
           _currentUser = account;
         });
       });
       _googleSignIn.signInSilently();
     }

     Future<void> _handleSignIn() async {
       try {
         await _googleSignIn.signIn();
       } catch (error) {
         print(error);
       }
     }

     Future<void> _handleSignOut() async {
       await _googleSignIn.disconnect();
     }

     @override
     Widget build(BuildContext context) {
       return Scaffold(
         body: ConstrainedBox(
           constraints: const BoxConstraints.expand(),
           child: Column(
             mainAxisAlignment: MainAxisAlignment.center,
             children: <Widget>[
               if (_currentUser != null)
                 Column(
                   children: <Widget>[
                     ListTile(
                       leading: GoogleUserCircleAvatar(
                         identity: _currentUser!,
                       ),
                       title: Text(_currentUser!.displayName ?? ''),
                       subtitle: Text(_currentUser!.email),
                     ),
                     ElevatedButton(
                       onPressed: _handleSignOut,
                       child: Text('SIGN OUT'),
                     ),
                   ],
                 )
               else
                 Column(
                   children: <Widget>[
                     ElevatedButton(
                       onPressed: _handleSignIn,
                       child: Text('SIGN IN'),
                     ),
                   ],
                 ),
             ],
           ),
         ),
       );
     }
   }
   ```

   That's it, you've successfully implemented google signin in your macos app.

<div class="tenor-gif-embed" data-postid="13840394" data-share-method="host" data-aspect-ratio="1.26984" data-width="100%"><a href="https://tenor.com/view/thumbs-up-okay-ok-well-done-gif-13840394">Thumbs Up Okay GIF</a>from <a href="https://tenor.com/search/thumbs+up-gifs">Thumbs Up GIFs</a></div> <script type="text/javascript" async src="https://tenor.com/embed.js"></script>

### Conclusion :

By following this guide, you’ve successfully integrated Google Sign-In into your Flutter macOS application, bringing a smooth and secure authentication experience to your users. While macOS support in Flutter may not always be as straightforward as mobile platforms, taking the time to implement this feature ensures your app is versatile and user-friendly across devices. Now, your users can effortlessly sign in with their Google accounts, enhancing engagement and trust in your app. As Flutter continues to grow, mastering cross-platform integration like this is key to staying ahead.

Let me know your thoughts in the Comment Section.

Happy Coding !! Keep Building!

Resources used :

1. [https://developers.google.com/identity/sign-in/ios/start-integrating](https://developers.google.com/identity/sign-in/ios/start-integrating)
2. [https://medium.com/@dmitrysikorsky/sign-in-with-apple-and-google-in-flutter-on-all-the-platforms-27c72650bf7a](https://medium.com/@dmitrysikorsky/sign-in-with-apple-and-google-in-flutter-on-all-the-platforms-27c72650bf7a)
3. [https://github.com/googlesamples/google-services/issues/81](https://github.com/googlesamples/google-services/issues/81)
