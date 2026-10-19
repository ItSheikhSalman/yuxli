function accumulator() {
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, measured: true };
  let responses = 0;
  return {
    add(response, provider) {
      responses += 1;
      const metadata = provider === "gemini" ? response?.usageMetadata : response?.usage;
      const input = metadata?.promptTokenCount ?? metadata?.prompt_tokens ?? metadata?.input_tokens;
      const output =
        metadata?.candidatesTokenCount ?? metadata?.completion_tokens ?? metadata?.output_tokens;
      const total =
        metadata?.totalTokenCount ?? metadata?.total_tokens ?? Number(input) + Number(output);
      if (![input, output, total].every((value) => Number.isFinite(value) && value >= 0)) {
        usage.measured = false;
        return;
      }
      usage.inputTokens += input;
      usage.outputTokens += output;
      usage.totalTokens += total;
    },
    value() {
      return responses ? { ...usage } : null;
    },
  };
}
module.exports = { accumulator };
