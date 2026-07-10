-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('BASIC', 'MENU', 'TAB');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationUserMapping" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ApplicationUserMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "moduleType" "ModuleType" NOT NULL DEFAULT 'BASIC',
    "moduleRoute" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT false,
    "canAdd" BOOLEAN NOT NULL DEFAULT false,
    "canModify" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "parentPermissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGroupMapping" (
    "id" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "permissionGroupId" TEXT NOT NULL,

    CONSTRAINT "PermissionGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGroupUserMapping" (
    "id" TEXT NOT NULL,
    "permissionGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PermissionGroupUserMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterGroupStorage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "MasterGroupStorage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterDataStorage" (
    "id" TEXT NOT NULL,
    "masterGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,

    CONSTRAINT "MasterDataStorage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionDataMapping" (
    "id" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "masterDataId" TEXT NOT NULL,

    CONSTRAINT "PermissionDataMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Application_key_key" ON "Application"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationUserMapping_applicationId_userId_key" ON "ApplicationUserMapping"("applicationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_applicationId_key_key" ON "Module"("applicationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroup_key_key" ON "PermissionGroup"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroupMapping_permissionId_permissionGroupId_key" ON "PermissionGroupMapping"("permissionId", "permissionGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroupUserMapping_permissionGroupId_userId_key" ON "PermissionGroupUserMapping"("permissionGroupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterGroupStorage_key_key" ON "MasterGroupStorage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionDataMapping_permissionId_masterDataId_key" ON "PermissionDataMapping"("permissionId", "masterDataId");

-- AddForeignKey
ALTER TABLE "ApplicationUserMapping" ADD CONSTRAINT "ApplicationUserMapping_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationUserMapping" ADD CONSTRAINT "ApplicationUserMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_parentPermissionId_fkey" FOREIGN KEY ("parentPermissionId") REFERENCES "Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroupMapping" ADD CONSTRAINT "PermissionGroupMapping_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroupMapping" ADD CONSTRAINT "PermissionGroupMapping_permissionGroupId_fkey" FOREIGN KEY ("permissionGroupId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroupUserMapping" ADD CONSTRAINT "PermissionGroupUserMapping_permissionGroupId_fkey" FOREIGN KEY ("permissionGroupId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroupUserMapping" ADD CONSTRAINT "PermissionGroupUserMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataStorage" ADD CONSTRAINT "MasterDataStorage_masterGroupId_fkey" FOREIGN KEY ("masterGroupId") REFERENCES "MasterGroupStorage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionDataMapping" ADD CONSTRAINT "PermissionDataMapping_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionDataMapping" ADD CONSTRAINT "PermissionDataMapping_masterDataId_fkey" FOREIGN KEY ("masterDataId") REFERENCES "MasterDataStorage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
