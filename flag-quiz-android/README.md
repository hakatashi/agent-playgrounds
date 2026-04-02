# flag-quiz-android

An Android quiz app that tests your knowledge of country flags.

## Overview

A native Android application built with Kotlin and Jetpack Compose. The app presents the user with a flag image and four multiple-choice answers; the player must identify the correct country. Results are summarized at the end of each round.

## Tech Stack

- **Language:** Kotlin
- **UI:** Jetpack Compose with Material 3
- **Architecture:** MVVM (ViewModel + Compose state)
- **Navigation:** Android Navigation component (Compose)
- **Target SDK:** Android 34 (min SDK 26)

## Screens

| Screen | Description |
|--------|-------------|
| Home | Start screen with a button to begin the quiz |
| Quiz | Displays a flag and four answer choices with a progress indicator |
| Result | Shows the final score after all questions are answered |

## Building

Open the project in Android Studio and run it on a device or emulator, or build from the command line:

```sh
./gradlew assembleDebug
```

The APK will be generated at `app/build/outputs/apk/debug/app-debug.apk`.

## Project Structure

```
app/src/main/kotlin/com/hakatashi/flagquiz/
├── MainActivity.kt              # Entry point and navigation host
├── data/
│   └── Countries.kt             # Country data (names and flag resources)
├── viewmodel/
│   └── QuizViewModel.kt         # Quiz state and logic
└── ui/screens/
    ├── HomeScreen.kt
    ├── QuizScreen.kt
    └── ResultScreen.kt
```
