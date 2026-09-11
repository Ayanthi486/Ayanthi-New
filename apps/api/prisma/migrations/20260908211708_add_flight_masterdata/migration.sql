-- CreateTable
CREATE TABLE "flight" (
    "id" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "flightNo" TEXT NOT NULL,
    "depTime" TIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flight_airlineId_flightNo_key" ON "flight"("airlineId", "flightNo");

-- AddForeignKey
ALTER TABLE "flight" ADD CONSTRAINT "flight_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
