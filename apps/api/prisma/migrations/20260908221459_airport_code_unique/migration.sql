-- Normalize any pre-existing codes to uppercase before enforcing
-- uniqueness — createAirportRequestSchema now always stores uppercase, but
-- this migration must not fail against rows written before that change.
UPDATE "airport" SET "code" = UPPER("code");

-- CreateIndex
CREATE UNIQUE INDEX "airport_code_key" ON "airport"("code");
