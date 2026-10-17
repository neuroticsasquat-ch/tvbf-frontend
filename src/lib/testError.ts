export const TEST_ERROR_MESSAGE = "tvbf-frontend test error: thrown on purpose from /debug/error";

/** Throws the known error ErrorTestPage reports to Bugsink (NEU-1593). */
export function throwTestError(): never {
  throw new Error(TEST_ERROR_MESSAGE);
}
