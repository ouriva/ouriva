-- Add CategoryBucket enum and bucket field to Category.
-- Bucket is optional (null = unclassified). Users assign buckets
-- in Settings > Categories to enable the 50/30/20 rule breakdown.
CREATE TYPE "CategoryBucket" AS ENUM ('NEEDS', 'WANTS', 'SAVINGS');
ALTER TABLE "Category" ADD COLUMN "bucket" "CategoryBucket";
