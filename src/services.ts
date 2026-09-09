import { ApiClient } from './api/client';
import { AuthService } from './auth/auth-service';
import { SessionManager } from './auth/session-manager';
import { secureSessionStorage } from './auth/storage';
import { LiveReportsRepository, type ReportsRepository } from './api/reports';
import { uploadToS3 } from './api/upload';
import { apiConfig, demoMode } from './config';
import { createDemoRepository } from './data/demo';

export const sessions = new SessionManager(secureSessionStorage);
export const api = new ApiClient(apiConfig, sessions);
export const auth = new AuthService(api);
let demo = createDemoRepository();
const demoAdapter: ReportsRepository = {
  list: (search, page, limit) => demo.list(search, page, limit),
  detail: (id) => demo.detail(id),
  create: (draft) => demo.create(draft),
  getUpload: () => undefined,
  retryUpload: async () => undefined,
  clear: () => {
    demo = createDemoRepository();
  },
};
export const reportsRepository: ReportsRepository = demoMode
  ? demoAdapter
  : new LiveReportsRepository(api, uploadToS3);
