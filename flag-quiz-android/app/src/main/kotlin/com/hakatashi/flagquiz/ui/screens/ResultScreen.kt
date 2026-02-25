package com.hakatashi.flagquiz.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hakatashi.flagquiz.viewmodel.TOTAL_QUESTIONS

@Composable
fun ResultScreen(
    correctCount: Int,
    onRetry: () -> Unit,
) {
    val emoji = when {
        correctCount == TOTAL_QUESTIONS -> "🏆"
        correctCount >= TOTAL_QUESTIONS * 0.8 -> "🎉"
        correctCount >= TOTAL_QUESTIONS * 0.6 -> "😊"
        else -> "📚"
    }

    val message = when {
        correctCount == TOTAL_QUESTIONS -> "満点！素晴らしい！"
        correctCount >= TOTAL_QUESTIONS * 0.8 -> "よくできました！"
        correctCount >= TOTAL_QUESTIONS * 0.6 -> "なかなかいいね！"
        else -> "もっと勉強しよう！"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = emoji,
            fontSize = 80.sp,
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "クイズ結果",
            style = MaterialTheme.typography.headlineMedium,
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "$correctCount / $TOTAL_QUESTIONS 問正解",
            style = MaterialTheme.typography.displaySmall,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
        )
        Spacer(modifier = Modifier.height(48.dp))
        Button(
            onClick = onRetry,
            modifier = Modifier
                .widthIn(min = 200.dp)
                .height(56.dp),
        ) {
            Text(
                text = "再挑戦",
                style = MaterialTheme.typography.titleMedium,
            )
        }
    }
}
