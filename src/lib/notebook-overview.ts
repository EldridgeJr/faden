// Builds the data for the start page from two queries:
// the notebooks (with the status of each source) and the latest questions.

export type NotebookRow = {
  id: string;
  title: string;
  created_at: string;
  sources: { status: string }[];
};

export type QuestionRow = {
  notebook_id: string;
  content: string;
  created_at: string;
};

export type NotebookSummary = {
  id: string;
  title: string;
  createdAt: string;
  // The last question, or the creation date if nobody asked anything yet.
  lastActivityAt: string;
  lastQuestion: string | null;
  sourceCount: number;
  ready: number;
  // Waiting or processing.
  busy: number;
  failed: number;
};

// questions must be sorted newest first. The first question of a notebook
// in the list is its latest one.
// The result is sorted by last activity, newest first.
export function summarizeNotebooks(
  notebooks: NotebookRow[],
  questions: QuestionRow[],
): NotebookSummary[] {
  const latestQuestion = new Map<string, QuestionRow>();
  for (const question of questions) {
    if (!latestQuestion.has(question.notebook_id)) {
      latestQuestion.set(question.notebook_id, question);
    }
  }

  const summaries = notebooks.map((notebook): NotebookSummary => {
    const question = latestQuestion.get(notebook.id);
    const count = (...statuses: string[]) =>
      notebook.sources.filter((source) => statuses.includes(source.status)).length;
    return {
      id: notebook.id,
      title: notebook.title,
      createdAt: notebook.created_at,
      lastActivityAt: question?.created_at ?? notebook.created_at,
      lastQuestion: question?.content ?? null,
      sourceCount: notebook.sources.length,
      ready: count("ready"),
      busy: count("pending", "processing"),
      failed: count("error"),
    };
  });

  // ISO timestamps from Postgres sort correctly as Date values.
  return summaries.sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
}
