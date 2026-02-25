package com.hakatashi.flagquiz.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hakatashi.flagquiz.data.Country
import com.hakatashi.flagquiz.viewmodel.TOTAL_QUESTIONS
import com.hakatashi.flagquiz.viewmodel.QuizUiState
import com.hakatashi.flagquiz.viewmodel.currentQuestion
import com.hakatashi.flagquiz.viewmodel.isAnswered

private val CorrectColor = Color(0xFF2E7D32)
private val WrongColor = Color(0xFFC62828)
private val NeutralColor = Color(0xFF1565C0)

@Composable
fun QuizScreen(
    uiState: QuizUiState,
    onSelectAnswer: (Int) -> Unit,
    onNext: () -> Unit,
) {
    val question = uiState.currentQuestion ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Progress
        Text(
            text = "${uiState.currentIndex + 1} / $TOTAL_QUESTIONS",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            modifier = Modifier.padding(vertical = 8.dp),
        )
        LinearProgressIndicator(
            progress = (uiState.currentIndex + 1).toFloat() / TOTAL_QUESTIONS,
            modifier = Modifier.fillMaxWidth(),
        )

        // Flag display (top half)
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "この国旗はどこの国？",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = question.correctCountry.flag,
                    fontSize = 120.sp,
                )
            }
        }

        // Answer choices (bottom half)
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            for (index in question.choices.indices) {
                ChoiceButton(
                    country = question.choices[index],
                    index = index,
                    uiState = uiState,
                    onSelectAnswer = onSelectAnswer,
                )
            }

            if (uiState.isAnswered) {
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = onNext,
                    modifier = Modifier
                        .widthIn(min = 200.dp)
                        .height(52.dp),
                ) {
                    Text(
                        text = if (uiState.currentIndex + 1 >= TOTAL_QUESTIONS) "結果を見る" else "次の問題へ",
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
            }
        }
    }
}

@Composable
private fun ChoiceButton(
    country: Country,
    index: Int,
    uiState: QuizUiState,
    onSelectAnswer: (Int) -> Unit,
) {
    val question = uiState.currentQuestion ?: return
    val isSelected = uiState.selectedChoiceIndex == index
    val isCorrectAnswer = country == question.correctCountry

    val buttonColor = when {
        !uiState.isAnswered -> NeutralColor
        isCorrectAnswer -> CorrectColor
        isSelected -> WrongColor
        else -> NeutralColor.copy(alpha = 0.4f)
    }

    Button(
        onClick = { onSelectAnswer(index) },
        enabled = !uiState.isAnswered,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = buttonColor,
            disabledContainerColor = buttonColor,
        ),
    ) {
        Text(
            text = country.name,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = Color.White,
        )
    }
}
