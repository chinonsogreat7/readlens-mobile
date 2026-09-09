import type { Report, ReportDraft, ReportPage } from '../domain/reports';
import { validateDraft } from '../domain/reports';

const examples = [
  [
    'Monthly reading programme',
    'The September reading programme is ready for review. This report brings together participation notes and the next steps for the team.',
    'In review',
  ],
  [
    'Library resource update',
    'We have reviewed the reading resources available to the team. A small selection needs to be refreshed before the next session.',
    'Submitted',
  ],
  [
    'Community workshop notes',
    'The community workshop went well. Participants shared useful feedback about accessibility and the format of future sessions.',
    'Resolved',
  ],
  [
    'August activity summary',
    'A summary of activities completed during August, including outstanding actions and recommendations for the next month.',
    'Resolved',
  ],
  [
    'New member feedback',
    'Several new members shared feedback on the onboarding experience. Clearer guidance at the beginning would help them settle in.',
    'Submitted',
  ],
  [
    'Weekly progress update',
    'This week we completed the first round of reviews and collected the information needed for the next stage.',
    'In review',
  ],
  [
    'Accessibility observations',
    'This report records accessibility observations from a recent session and practical improvements we can make.',
    'Submitted',
  ],
  [
    'Equipment maintenance request',
    'A few items in the shared workspace need maintenance. Please review the request when convenient.',
    'Resolved',
  ],
] as const;

/** Local preview only. The live API will own filtering and pagination. */
export function createDemoRepository() {
  let sequence = 0;
  let reports: Report[] = examples.map(([title, description, status], index) => ({
    id: `sample-${index + 1}`,
    title,
    description,
    status,
    createdAt: new Date(Date.UTC(2026, 8, 5 - index, 9, 30)).toISOString(),
    author: { name: 'Alex Morgan', email: 'alex@example.com' },
  }));
  return {
    async list(search: string, page: number, limit = 5): Promise<ReportPage> {
      const term = search.trim().toLowerCase();
      const matches = reports.filter((report) =>
        `${report.title} ${report.description}`.toLowerCase().includes(term),
      );
      const offset = (page - 1) * limit;
      return {
        reports: matches.slice(offset, offset + limit),
        nextPage: offset + limit < matches.length ? page + 1 : undefined,
      };
    },
    async detail(id: string): Promise<Report> {
      const report = reports.find((item) => item.id === id);
      if (!report) throw new Error('This report could not be found. Go back and refresh the list.');
      return report;
    },
    async create(draft: ReportDraft): Promise<Report> {
      const errors = validateDraft(draft);
      if (errors.title || errors.description) throw new Error(errors.title ?? errors.description);
      const report: Report = {
        id: `local-${Date.now()}-${++sequence}`,
        title: draft.title.trim(),
        description: draft.description.trim(),
        attachment: draft.attachment,
        status: 'Submitted',
        createdAt: new Date().toISOString(),
        author: { name: 'Alex Morgan', email: 'alex@example.com' },
      };
      reports = [report, ...reports];
      return report;
    },
  };
}

export const demoRepository = createDemoRepository();
