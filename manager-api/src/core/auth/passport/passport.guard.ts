import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { PassportAuthService } from "./passport.service";

// One guard for every provider. `AuthGuard(name)` builds a class per strategy
// name, and the name here is the `:provider` path segment, which is exactly the
// id each strategy registers itself under: a new provider needs no guard, no
// route and no branch, only its strategy.
//
// The usability check comes first so a provider that is switched off, or was
// never configured, answers 503 instead of reaching Passport and failing there
// with "Unknown authentication strategy".
@Injectable()
export class PassportProviderGuard implements CanActivate {
  constructor(private readonly passport: PassportAuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { params: Record<string, string> }>();
    const provider = req.params["provider"] ?? "";
    if (!this.passport.isUsable(provider)) {
      // The manager URL is named apart from the rest: it is the one cause an
      // admin cannot guess from "not available", and the one they fix in the
      // interface rather than in the environment.
      if (!this.passport.managerUrlSet()) {
        throw new ServiceUnavailableException(
          "The manager URL is not set, so no callback can be handed to a provider. Set it at Configuration -> General."
        );
      }
      throw new ServiceUnavailableException(`Sign-in with ${provider || "this provider"} is not available on this server`);
    }
    // The callback URL is settled per request rather than at construction: it
    // is built from the manager URL a root admin can change at any time, and it
    // has to be identical on the authorize call and on the token exchange or
    // the provider rejects the code.
    //
    // OAuth's `state` carries the page that started the sign-in, which the
    // provider hands back untouched on the callback. It is the only way back:
    // the callback is a fresh request from the provider, with nothing of ours
    // on it. Sanitised here, and again where it is read.
    const returnTo = req.query["redirect"];
    const Guard = AuthGuard(provider);
    const guard = new Guard({
      session: false,
      callbackURL: this.passport.callbackUrl(provider),
      ...(typeof returnTo === "string" ? { state: this.passport.returnPath(returnTo) } : {}),
    }) as CanActivate;
    return (await guard.canActivate(context)) as boolean;
  }
}
