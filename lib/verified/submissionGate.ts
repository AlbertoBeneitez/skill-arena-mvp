/** One terminal request per attempt, including calls after it has completed. */
export class SubmissionGate<T> {
  private current?: { attemptId: string; controller: AbortController; promise: Promise<T> };

  run(attemptId: string, execute: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.current) {
      if (this.current.attemptId !== attemptId) {
        return Promise.reject(new Error("ATTEMPT_SUBMISSION_CONFLICT"));
      }
      return this.current.promise;
    }
    const controller = new AbortController();
    const promise = Promise.resolve().then(async () => {
      if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const result = await execute(controller.signal);
      if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      return result;
    });
    this.current = { attemptId, controller, promise };
    return promise;
  }

  /** Only a new session/lifecycle generation may reopen submission. */
  reset() {
    this.current?.controller.abort();
    this.current = undefined;
  }
}
