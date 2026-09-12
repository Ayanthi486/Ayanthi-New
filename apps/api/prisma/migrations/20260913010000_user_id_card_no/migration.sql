-- Self-service ID Card No on the user's own Profile, used to auto-populate
-- the Security Clearance certificate's NIC field.
ALTER TABLE "user" ADD COLUMN "idCardNo" TEXT;
