import { createCommandRegistry } from "./commands/index.js";
import { getCommandHint, getRunIdHint, isValidRunId, parseArgv } from "./core/argv.js";
import { buildRuntimeContext, generateRunId } from "./core/context.js";
import { CliError, exitCodeForError, normalizeExecutionError, successExitCode } from "./core/errors.js";
import { buildErrorResponse, buildSuccessResponse, writeJsonLine } from "./core/response.js";
import { executeCommand } from "./core/router.js";
import { createRuntimeStoreRecorder } from "./runtime/store/runtime-store-recorder.js";
import { RuntimeStoreError } from "./runtime/store/sqlite-runtime-store.js";
const isRuntimeStoreError = (error) => error instanceof RuntimeStoreError;
const toRuntimeStoreCliError = (error) => new CliError("ERR_RUNTIME_UNAVAILABLE", `运行记录存储失败: ${error.code}`, {
    retryable: error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH",
    cause: error
});
const normalizeCliError = (error) => {
    if (error instanceof CliError) {
        return error;
    }
    if (isRuntimeStoreError(error)) {
        return toRuntimeStoreCliError(error);
    }
    return normalizeExecutionError(error);
};
const buildRuntimeStoreWarning = (context, error, stage) => JSON.stringify({
    type: "runtime_store_warning",
    run_id: context.run_id,
    command: context.command,
    stage,
    store_error: {
        code: error.code,
        message: error.message
    }
});
const shouldDowngradeRuntimeStoreError = (error) => error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH";
export const runCli = async (argv, options) => {
    const cwd = options?.cwd ?? process.cwd();
    const stdout = options?.stdout ?? process.stdout;
    const stderr = options?.stderr ?? process.stderr;
    const commandHint = getCommandHint(argv);
    const runIdHint = getRunIdHint(argv);
    let runtimeContext = null;
    let recorder = null;
    let runtimeStoreWarning = null;
    try {
        const parsed = parseArgv(argv);
        const context = buildRuntimeContext(parsed, cwd);
        runtimeContext = context;
        try {
            recorder = createRuntimeStoreRecorder(cwd);
            await recorder.recordStart(context);
        }
        catch (storeError) {
            if (isRuntimeStoreError(storeError) && shouldDowngradeRuntimeStoreError(storeError)) {
                runtimeStoreWarning = buildRuntimeStoreWarning(context, storeError, "start");
                recorder = null;
            }
            else {
                throw storeError;
            }
        }
        const summary = await executeCommand(context, createCommandRegistry());
        if (recorder) {
            try {
                await recorder.recordSuccess(context, summary);
            }
            catch (storeError) {
                if (isRuntimeStoreError(storeError) && shouldDowngradeRuntimeStoreError(storeError)) {
                    runtimeStoreWarning = runtimeStoreWarning ?? buildRuntimeStoreWarning(context, storeError, "success");
                }
                else {
                    throw storeError;
                }
            }
        }
        writeJsonLine(stdout, buildSuccessResponse(context, summary));
        if (context.command === "runtime.help") {
            stderr.write("Use --params to pass structured JSON object parameters.\n");
        }
        if (runtimeStoreWarning) {
            stderr.write(`${runtimeStoreWarning}\n`);
        }
        return successExitCode();
    }
    catch (error) {
        const commandError = normalizeCliError(error);
        if (runtimeContext && recorder && !isRuntimeStoreError(error)) {
            try {
                await recorder.recordFailure(runtimeContext, commandError);
            }
            catch (storeError) {
                if (isRuntimeStoreError(storeError) && shouldDowngradeRuntimeStoreError(storeError)) {
                    runtimeStoreWarning =
                        runtimeStoreWarning ?? buildRuntimeStoreWarning(runtimeContext, storeError, "failure");
                }
                else {
                    throw storeError;
                }
            }
        }
        const cliError = commandError;
        const runId = runtimeContext?.run_id ??
            (runIdHint && isValidRunId(runIdHint) ? runIdHint : generateRunId());
        const command = runtimeContext?.command ?? commandHint;
        writeJsonLine(stdout, buildErrorResponse({ runId, command }, cliError));
        if (cliError.code === "ERR_CLI_INVALID_ARGS") {
            stderr.write(`${cliError.message}\n`);
        }
        if (runtimeStoreWarning) {
            stderr.write(`${runtimeStoreWarning}\n`);
        }
        return exitCodeForError(cliError.code);
    }
    finally {
        try {
            recorder?.close();
        }
        catch {
            // Close errors are non-blocking for CLI contract.
        }
    }
};
if (import.meta.url === `file://${process.argv[1]}`) {
    runCli(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
