export function methodColor(method: string) {
  switch (method.toUpperCase()) {
    case "GET":
      return "info" as const;
    case "POST":
      return "success" as const;
    case "PUT":
    case "PATCH":
      return "warning" as const;
    case "DELETE":
      return "error" as const;
    default:
      return "neutral" as const;
  }
}

export function statusColor(status: number) {
  if (status >= 500) return "error" as const;
  if (status === 401 || status === 403) return "warning" as const;
  if (status >= 400) return "error" as const;
  if (status >= 300) return "info" as const;
  if (status >= 200) return "success" as const;
  return "neutral" as const;
}
