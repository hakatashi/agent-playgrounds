package com.hakatashi.flagquiz

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hakatashi.flagquiz.ui.screens.HomeScreen
import com.hakatashi.flagquiz.ui.screens.QuizScreen
import com.hakatashi.flagquiz.ui.screens.ResultScreen
import com.hakatashi.flagquiz.ui.theme.FlagQuizTheme
import com.hakatashi.flagquiz.viewmodel.QuizViewModel

enum class AppScreen { Home, Quiz, Result }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FlagQuizTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .safeDrawingPadding(),
                ) {
                    FlagQuizApp()
                }
            }
        }
    }
}

@Composable
fun FlagQuizApp(quizViewModel: QuizViewModel = viewModel()) {
    var currentScreen by remember { mutableStateOf(AppScreen.Home) }
    val uiState by quizViewModel.uiState.collectAsState()

    // Navigate to Result screen when the quiz completes
    LaunchedEffect(uiState.isFinished) {
        if (uiState.isFinished && currentScreen == AppScreen.Quiz) {
            currentScreen = AppScreen.Result
        }
    }

    when (currentScreen) {
        AppScreen.Home -> HomeScreen(
            onStart = {
                quizViewModel.startQuiz()
                currentScreen = AppScreen.Quiz
            },
        )
        AppScreen.Quiz -> QuizScreen(
            uiState = uiState,
            onSelectAnswer = quizViewModel::selectAnswer,
            onNext = quizViewModel::nextQuestion,
        )
        AppScreen.Result -> ResultScreen(
            correctCount = uiState.correctCount,
            onRetry = {
                quizViewModel.startQuiz()
                currentScreen = AppScreen.Quiz
            },
        )
    }
}
