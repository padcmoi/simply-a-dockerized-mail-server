import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodType } from "zod";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // `code` lets manager-ui translate the headline (see api-error.ts);
      // `issues` keeps zod's own English text, which the UI uses to locate the
      // offending field rather than to display.
      throw new BadRequestException({
        code: "validation.failed",
        message: "Validation failed",
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
