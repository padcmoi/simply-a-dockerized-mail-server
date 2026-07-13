// NestJS DI reads design-type metadata that reflect-metadata installs on the
// global Reflect; every test module build needs it loaded first.
import "reflect-metadata";

// Deterministic secrets/env for the auth guard and JWT signing under test. The
// real values only ever exist at runtime in the container; tests mint their own.
process.env.MANAGER_JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.MANAGER_JWT_REFRESH_SECRET ??= "test-refresh-secret";
process.env.MANAGER_ADMIN_EMAIL ??= "root@test.local";
