---
author: Deepraj Baidya
pubDatetime: 2024-07-22T15:22:00Z
title: Effective Networking in Flutter w. riverpod, fpdart, dio
slug: effective-networking-in-flutter
featured: true
draft: false
tags:
  - docs
  - flutter
  - api
  - json
  - dio
  - fpdart
  - riverpod

description: Effective way to talk to any api in dart, with packages like riverpod, dio, fpdart.
---

In the dynamic world of software development, the ability to fetch and manage data from remote sources is a crucial skill. Whether you're building a web application, a mobile app, or any other software that interacts with the internet, you'll likely find yourself making API requests. But fear not, for there are powerful tools and libraries that can simplify this process and make it more efficient.

This guide will focus on the core concepts of making API requests in Flutter. We'll take you step by step through the process of:

* Setting up API requests (specifying URL, headers, body)
    
* Sending the request and handling the response (success, error)
    
* Parsing the response data (JSON, XML)
    

We'll keep things focused on these core aspects related to API calls, without diving into specific state management solutions like Riverpod.

So, if you're ready to unlock the potential of fetching data from remote servers in your Flutter applications, let's dive in!

# Step 1: Create our Flutter App and Installing the required Dependencies.

Let's first start by creating our Flutter app. Run the following command in your terminal to create a new Flutter App.

```bash
flutter create <app_name>
```

Now once our app is created let's move on towards adding the required dependencies to our Project.

For this tutorial we will be using these following dependencies, the reasons for using them is also mentioned:

* [**dio**](https://pub.dev/packages/dio) **:** A powerful HTTP networking package for Dart/Flutter, supports Global configuration, Interceptors, FormData, Request cancellation, File uploading/downloading, Timeout, Custom adapters, Transformers, etc
    
* [**fpdart**](https://pub.dev/packages/fpdart) **:** `fpdart` brings functional programming in dart. By following the principles of functional programming we aim to make the app safe in all its aspects. Another great advantage of `fpdart` (and functional programming in general) is that the app becomes **way easier to test and maintain**.
    
* [**pretty\_dio\_logger**](https://pub.dev/packages/pretty_dio_logger) **:** Pretty Dio logger is a Dio interceptor that logs network calls in a pretty, easy to read format.
    

Once all the dependencies are configured we're ready to move onto our next step.....

## Step 2 : Creating the Base API service

The first step will be to create the dir and file where we'll write our BaseAPI class

```bash
src
    ├── components
    ├── models
    ├── providers
    ├── screens
    └── services
        ├── posts.service.dart
        └── game.service.dart
```

Create a **src/** directory inside the **lib/** directory and configure it as shown above.

Now let's write our ***base.service.dart*** file.

```dart
/// Let's start be defining all the possible http methods we will need
/// for our operations.
enum HttpMethod {
  get,
  post,
  patch,
  delete,
}

/// Now let's create a type defination which will refer to our API
/// response (not necessary) 

/// As we're using fpdart in this project we can expect 2 different 
/// return types from a single method.

/// String(left) is to log any possible error
/// Map<String,dynamic>(right) is for the JSON that will be returned to us.
typedef APIResponse = Future<Either<String, Map<String, dynamic>>>



class BaseService {
  Dio dio(BaseOptions options) {

/// adding PrettyDioLogger here will enable us to view logs for our http 
/// requests which will help us during debugging phase.
    return Dio(options)..interceptors.addAll([PrettyDioLogger()]);
  }

/// here you can configure various options such as your baseURL,headers
/// and tokens.
  BaseOptions get _options {
    return BaseOptions(
      baseUrl: '',
      headers: {
        HttpHeaders.contentTypeHeader: 'application/json',
        HttpHeaders.acceptHeader: 'application/json',
      },
    )
      ..queryParameters = {}
      ..connectTimeout = Duration(milliseconds: 5000)
      ..sendTimeout = Duration(milliseconds: 5000)
      ..receiveTimeout = Duration(milliseconds: 5000);
  }

/// This method will add '/' in the ending of all our routes to save us 
/// from any possible errors :)
  String _cleanPath(String path) {
    if (!path.endsWith('/')) {
      return '$path/';
    }
    return path;
  }


/// Here we're defining the methods and the path (route)
/// and adds a switch case to call the required http method using Dio.
  APIResponse _handle({
    required HttpMethod method,
    required String path,

    Map<String, dynamic> data = const {},
  }) async {
    try {
      late Response<dynamic> response;
      switch (method) {
        case HttpMethod.get:
          response = await Dio(_options).get(
            _cleanPath(path),
            queryParameters: data,
          );
        case HttpMethod.post:
          response = await Dio(_options).post(
            _cleanPath(path),
            data: data,
          );
        case HttpMethod.patch:
          response = await Dio(_options).patch(
            _cleanPath(path),
            data: data,
          );
        case HttpMethod.delete:
          response = await Dio(_options).delete(
            _cleanPath(path),
          );
      }
      return right({'data': response.data});
    } catch (e) {
      return left(e.toString());
    }
  }
  APIResponse get(
    String path, {
    Map<String, dynamic> data = const {},
  }) {
    return _handle(method: HttpMethod.get, path: path, data: data);
  }
  APIResponse post(
    String path, {
    Map<String, dynamic> data = const {},
  }) {
    return _handle(method: HttpMethod.post, path: path, data: data);
  }
  APIResponse patch(
    String path, {
    Map<String, dynamic> data = const {},
  }) {
    return _handle(method: HttpMethod.patch, path: path, data: data);
  }
  APIResponse delete(String path) {
    return _handle(method: HttpMethod.delete, path: path);
  }
}
```

That is pretty much the content for ***base.service.dart*** , we've added soo much customisation like request timeout, headers, queryParams logger etc.

Now to make requests to different endpoints we will need to extend the BaseService class as shown below.

## Step 3 : Extending BaseService for different Endpoints.

Let's assume we have a '/posts' endpoint and we have to send requests to that endpoint, this is how we'll do it.

But before that let's create another file named ***posts.service.dart***

```dart

import 'package:fl_network/src/services/base_service.dart';
import 'package:fpdart/fpdart.dart';

class PostService extends BaseService {

/// Configuring the base path (the url was defined earlier)
  static const basePath = "/posts";


/// The below getPosts methods calls the get method defined in our
/// base.service.dart file (BaseService) class.
  Future<Either<String, List<Post>>> getPosts() async {
    final response = await get(basePath);
/// Because of fpdart we are able to filter the response and make the
/// process of handling errors and exceptions easier and efficient in 
/// our method.
    return response.fold(
      (error) => left(error),
      (result) => right(result['data'].map<Post>((json) => Post.fromJson(json)).toList()),
    );
  }


  Future<Either<String, Post>> getPost(String id) async {
    final response = await get("$basePath/$id");

    return response.fold(
      (error) => left(error),
      (result) => right(Post.fromJson(result['data'])),
    );
  }

/// Performs either the deletion or updation based on the Post's
/// id (in this case the unique identifier )
  Future<Either<String, Post>> save(Post post) async {
    return Post.id.isEmpty ? _create(Post) : _update(Post.id, Post);
  }

/// HTTP: post
  Future<Either<String, Post>> _create(Post post) async {
    final response = await post(basePath, data: Post.toJson());

    return response.fold(
      (error) => left(error),
      (result) => right(Post.fromJson(result['data'])),
    );
  }

/// HTTP: patch
  Future<Either<String, Post>> _update(String id, Post post) async {
    final response = await patch("$basePath/$id", data: Post.toJson());

    return response.fold(
      (error) => left(error),
      (result) => right(Post.fromJson(result['data'])),
    );
  }


/// HTTP: delete
  Future<Either<String, bool>> deletePost(String id) async {
    final response = await delete("$basePath/$id");

    return response.fold(
      (error) => left(error),
      (result) => right(true),
    );
  }
}
```

And it's done !!!!!

We've created our own reusable code snippet for making API requests, which we can use in other projects too ultimately saving us hours of development.

**That's it for this introductory guide!**

We've established a solid foundation for making API requests in Flutter, covering the core steps of setting up requests, handling responses, and parsing data. This knowledge equips you to confidently fetch data and enhance your Flutter applications.

**The adventure continues!**

This series is just getting started. Buckle up as we dive deeper into the exciting world of API requests in Flutter:

* **Advanced Concepts:** We'll conquer techniques for authentication, robust error handling, and caching mechanisms to streamline your API calls.
    
* **State Management Integration:** Discover how to seamlessly integrate popular state management solutions like Provider or BLoC to effectively manage retrieved data within your Flutter app's state.
    
* **Building Real-world Applications:** Put your newfound skills into action by constructing practical examples that showcase how to make API requests in various real-world Flutter app scenarios.
    

By following along, you'll transform into a confident API request maestro, wielding this power to create dynamic and data-driven Flutter applications that truly shine.
