-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "societies" ADD COLUMN     "slaCriticalHours" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "slaHighHours" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "slaLowHours" INTEGER NOT NULL DEFAULT 72,
ADD COLUMN     "slaNormalHours" INTEGER NOT NULL DEFAULT 48;
