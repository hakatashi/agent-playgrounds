import axios from 'axios';

interface WikiApiResponse {
  query?: {
    pages?: Record<string, {
      title: string;
      extract?: string;
      missing?: string;
    }>;
  };
}

export async function fetchWikipediaArticle(title: string): Promise<{title: string; extract: string} | null> {
  try {
    const response = await axios.get<WikiApiResponse>('https://ja.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        titles: title,
        prop: 'extracts',
        exlimit: 1,
        explaintext: 1,
        format: 'json',
        origin: '*',
      },
      timeout: 10000,
    });

    const pages = response.data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || 'missing' in page || !page.extract) return null;

    return {title: page.title, extract: page.extract};
  } catch {
    return null;
  }
}
