export interface Ore {
  id: string;
  body: string;
  tags: string[];
  companyNames: string[];
  empathyCount: number;
  source?: string;
  createdAt: number;
  authorId?: string;
}
