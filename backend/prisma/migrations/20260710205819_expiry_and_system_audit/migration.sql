-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "PermissionGroupUserMapping" ADD COLUMN     "expiresAt" TIMESTAMP(3);
