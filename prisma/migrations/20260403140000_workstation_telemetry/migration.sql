-- Workstation agent: devices + activity samples

CREATE TABLE "WorkstationDevice" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "tokenHash" TEXT NOT NULL,
    "hostnameLast" TEXT,
    "agentVersionLast" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "WorkstationDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkstationActivitySample" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "processName" TEXT NOT NULL,
    "windowTitle" TEXT,
    "idle" BOOLEAN NOT NULL DEFAULT false,
    "inProjectRoots" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "WorkstationActivitySample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkstationDevice_organisationId_idx" ON "WorkstationDevice"("organisationId");
CREATE INDEX "WorkstationDevice_userId_idx" ON "WorkstationDevice"("userId");
CREATE INDEX "WorkstationDevice_tokenHash_idx" ON "WorkstationDevice"("tokenHash");

CREATE INDEX "WorkstationActivitySample_organisationId_sampledAt_idx" ON "WorkstationActivitySample"("organisationId", "sampledAt");
CREATE INDEX "WorkstationActivitySample_deviceId_sampledAt_idx" ON "WorkstationActivitySample"("deviceId", "sampledAt");

ALTER TABLE "WorkstationDevice" ADD CONSTRAINT "WorkstationDevice_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkstationDevice" ADD CONSTRAINT "WorkstationDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkstationActivitySample" ADD CONSTRAINT "WorkstationActivitySample_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkstationActivitySample" ADD CONSTRAINT "WorkstationActivitySample_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "WorkstationDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
