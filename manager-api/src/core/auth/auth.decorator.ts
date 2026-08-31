import { SetMetadata } from "@nestjs/common";

export type AuthStrategy = "JWT" | "ApiToken";
export const AUTH_STRATEGIES_KEY = "__auth_strategies__";
export const AUTH_PUBLIC_KEY = "__auth_public__";

export const Auth = (...strategies: [AuthStrategy, ...AuthStrategy[]]) => SetMetadata(AUTH_STRATEGIES_KEY, strategies);

export const Public = () => SetMetadata(AUTH_PUBLIC_KEY, true);
