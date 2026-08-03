-- AlterTable
ALTER TABLE "showtimes" ADD COLUMN     "booked_seats" JSONB NOT NULL DEFAULT '[]';
