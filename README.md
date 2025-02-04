# Just a test of AI stuff.

This project is just incrementally learning how to leverage AI.  In this case, the script is provided a javascript project directory and a prompt.  The AI is provided some simple tools (`gitCommitHistory`, `ls`, `grep`, and `getFile`) to attempt to answer questions about the prompt.

## Requirements

Ollama and a tools enabled model.

- The environment variable `MODEL` will need to be set to the tools-enabled model (such as [`qwen2.5`](https://ollama.com/library/qwen2.5))
- The ollama server will be assumed to be runnning at `http://localhost:11434` unless otherwise set with the environment variable `AI_SERVER`.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts <project directory>  <prompt>
```


This project was created using `bun init` in bun v1.2.0. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
