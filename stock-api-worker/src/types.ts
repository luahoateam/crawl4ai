import { z } from 'zod';

export const CompanySchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  industry: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const BusinessModelSchema = z.object({
  revenueStruct: z.string().optional(),
  profitStruct: z.string().optional(),
  inputs: z.string().optional(),
  production: z.string().optional(),
  outputs: z.string().optional(),
  others: z.string().optional(),
});

export const DailyResearchSchema = z.object({
  summary: z.string().optional(),
  ssiReview: z.string().optional(),
  lastUpdated: z.string().optional(),
});

export const NewsItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  sourceUrl: z.string().optional().nullable(),
  createdAt: z.string().optional(),
});

export const DocumentItemSchema = z.object({
  id: z.number(),
  year: z.number(),
  fileName: z.string(),
  fileUrl: z.string(),
  label: z.string().optional().nullable(),
});

export const CompanyPackSchema = z.object({
  profile: CompanySchema,
  businessModel: BusinessModelSchema.optional(),
  research: DailyResearchSchema.optional(),
  news: z.array(NewsItemSchema),
  documents: z.array(DocumentItemSchema).optional(),
});
