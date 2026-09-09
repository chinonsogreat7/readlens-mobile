import type { Attachment } from './domain/reports';

export type RootStackParams = {
  Login: undefined;
  Verify: { email: string };
  Reports: undefined;
  CreateReport: undefined;
  ReportDetail: { id: string; justCreated?: boolean };
  MediaViewer: { attachment: Attachment };
};
