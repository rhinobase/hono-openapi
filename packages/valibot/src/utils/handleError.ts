import type { ConversionConfig, OpenAPIVersions } from "../types";

/**
 * Throws an error or logs a warning based on the configuration.
 *
 * @param message The message to throw or log.
 * @param config The conversion configuration.
 */
export function handleError<T extends OpenAPIVersions>(
  message: string,
  config: ConversionConfig<T> | undefined
): void {
  switch (config?.errorMode) {
    case "ignore": {
      break;
    }
    case "warn": {
      console.warn(message);
      break;
    }
    default: {
      throw new Error(message);
    }
  }
}
