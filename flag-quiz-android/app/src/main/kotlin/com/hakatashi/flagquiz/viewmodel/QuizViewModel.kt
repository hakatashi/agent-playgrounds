package com.hakatashi.flagquiz.viewmodel

import androidx.lifecycle.ViewModel
import com.hakatashi.flagquiz.data.ALL_COUNTRIES
import com.hakatashi.flagquiz.data.Country
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

const val TOTAL_QUESTIONS = 5
const val CHOICES_COUNT = 4

data class QuizQuestion(
    val correctCountry: Country,
    val choices: List<Country>,
)

data class QuizUiState(
    val questions: List<QuizQuestion> = emptyList(),
    val currentIndex: Int = 0,
    val selectedChoiceIndex: Int? = null,
    val correctCount: Int = 0,
    val isFinished: Boolean = false,
)

val QuizUiState.currentQuestion: QuizQuestion?
    get() = questions.getOrNull(currentIndex)

val QuizUiState.isAnswered: Boolean
    get() = selectedChoiceIndex != null

class QuizViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(QuizUiState())
    val uiState: StateFlow<QuizUiState> = _uiState.asStateFlow()

    init {
        startQuiz()
    }

    fun startQuiz() {
        val questions = generateQuestions()
        _uiState.value = QuizUiState(questions = questions)
    }

    fun selectAnswer(choiceIndex: Int) {
        val state = _uiState.value
        if (state.isAnswered) return

        val question = state.currentQuestion ?: return
        val isCorrect = question.choices[choiceIndex] == question.correctCountry

        _uiState.update { current ->
            current.copy(
                selectedChoiceIndex = choiceIndex,
                correctCount = if (isCorrect) current.correctCount + 1 else current.correctCount,
            )
        }
    }

    fun nextQuestion() {
        val state = _uiState.value
        if (!state.isAnswered) return

        val nextIndex = state.currentIndex + 1
        if (nextIndex >= TOTAL_QUESTIONS) {
            _uiState.update { it.copy(isFinished = true) }
        } else {
            _uiState.update { it.copy(currentIndex = nextIndex, selectedChoiceIndex = null) }
        }
    }

    private fun generateQuestions(): List<QuizQuestion> {
        val shuffled = ALL_COUNTRIES.shuffled()
        return (0 until TOTAL_QUESTIONS).map { i ->
            val correct = shuffled[i]
            val wrongPool = (shuffled - correct).take(CHOICES_COUNT - 1)
            val choices = (wrongPool + correct).shuffled()
            QuizQuestion(correctCountry = correct, choices = choices)
        }
    }
}
