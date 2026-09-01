import { BadRequestException, CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { loginSchema } from "../jwt/jwt.validation";

// Guards run before pipes in Nest, so a body handed straight to
// `AuthGuard("local")` would come back 401 for a malformed request instead of
// the 400 with its issue list that every other route answers. This validates
// first and only then lets Passport verify the credentials, which keeps the two
// answers distinct: 400 says the request was wrong, 401 says the credentials
// were.
@Injectable()
export class LocalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestException({ message: "Validation failed", issues: parsed.error.issues });
    }
    const Guard = AuthGuard("local");
    const guard = new Guard({ session: false }) as CanActivate;
    return (await guard.canActivate(context)) as boolean;
  }
}
