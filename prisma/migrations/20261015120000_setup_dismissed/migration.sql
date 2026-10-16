-- AlterTable: nullable column, no data change for existing rows
ALTER TABLE "ShopSettings" ADD COLUMN "setupDismissedAt" TIMESTAMP(3);
