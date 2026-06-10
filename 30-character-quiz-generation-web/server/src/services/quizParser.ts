export interface ParsedQuiz {
  question: string;
  answer: string;
  charCount: number;
}

export function parseQuizTSV(text: string): ParsedQuiz[] {
  // TSVコードブロックを優先して抽出
  const codeBlockMatch = text.match(/```tsv\n([\s\S]*?)```/);

  let tsvText: string;
  if (codeBlockMatch) {
    tsvText = codeBlockMatch[1];
  } else {
    // フォールバック: タブ文字を含む行を抽出
    tsvText = text
      .split('\n')
      .filter((line) => line.includes('\t'))
      .join('\n');
  }

  const quizzes: ParsedQuiz[] = [];

  for (const line of tsvText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split('\t');
    if (parts.length < 2) continue;

    const question = parts[0].trim();
    const answer = parts[1].trim();

    if (!question || !answer) continue;

    // ヘッダー行をスキップ
    if (question === '問題文' && answer === '答え') continue;

    const charCount = [...question].length;
    quizzes.push({question, answer, charCount});
  }

  return quizzes;
}
