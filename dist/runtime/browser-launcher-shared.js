export class BrowserLaunchError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = "BrowserLaunchError";
        this.code = code;
    }
}
