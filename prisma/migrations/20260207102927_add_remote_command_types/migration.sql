-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommandType" ADD VALUE 'GET_STATS';
ALTER TYPE "CommandType" ADD VALUE 'GET_FILES';
ALTER TYPE "CommandType" ADD VALUE 'CAMERA_CAPTURE';
ALTER TYPE "CommandType" ADD VALUE 'AUDIO_RECORD';
ALTER TYPE "CommandType" ADD VALUE 'VIBRATE';
