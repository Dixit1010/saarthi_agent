import { RawJobPosting } from '../types.js';

export interface JobSourceAdapter {
  readonly name: string;
  fetchJobs(): Promise<RawJobPosting[]>;
}
