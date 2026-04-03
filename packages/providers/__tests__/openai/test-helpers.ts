export const extractStandardInputSchema = (
    schema: unknown,
): Record<string, unknown> | undefined => {
    const standard = schema as
        | {
              "~standard"?: {
                  jsonSchema?: {
                      input?: () => Record<string, unknown>;
                  };
              };
          }
        | undefined;
    return standard?.["~standard"]?.jsonSchema?.input?.();
};
