# mypi

A small terminal coding agent written in TypeScript, inspired by Claude Code. Give it a task in plain English. It streams its reasoning, reads files, runs shell commands, and feeds the results back to the model until the task is done.

```
prompt -> LLM -> tool call -> tool result -> LLM -> ... -> final answer
```

The codebase is intentionally small, so it works as both a usable tool and a readable example of how tool-calling agents work.

## Features

- **Agent loop**: the model calls tools, sees the results, and keeps going until it stops asking for tools or hits the turn limit (default 20)
- **Built-in tools**: `read` (read a file) and `bash` (run a shell command with a timeout and truncated output). Files are created and edited through `bash`
- **Streaming output**: text appears in the terminal as it is generated
- **Provider abstraction**: works with any OpenAI-compatible API (Groq, OpenAI, Azure, local servers) through a single `Provider` interface
- **Easy to extend**: add a tool or a provider with one small file

## Requirements

- Node.js 20 or newer
- `bash` on your PATH (on Windows, use Git Bash or WSL for the `bash` tool)
- An API key for your chosen provider

## Installation

```bash
git clone https://github.com/Farhandev097/<repo-name>.git
cd <repo-name>
npm install
npm link        # optional: makes the `mypi` command available globally
```

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
```

Never commit `.env`. Make sure it is listed in `.gitignore`.

## Usage

```bash
mypi -p "List all .md files in this repo and show the first line of each"
```

Without linking, run it through the dev script (the `--` passes flags through to the program):

```bash
npm run dev -- -p "Explain what src/main.ts does"
```

| Flag | Description | Default |
|------|-------------|---------|
| `-p`, `--prompt` | The task for the agent (required) | none |
| `--model` | Model name passed to the provider | `openai/gpt-oss-120b` |
| `--provider` | Provider name registered in `src/provider/index.ts` | `groq` |

```bash
mypi -p "Run the tests and summarize failures" --provider groq --model openai/gpt-oss-120b
```

## Built-in tools

| Tool | What it does | Parameters |
|------|--------------|------------|
| `read` | Returns the contents of a text file | `path` (string): path relative to the current directory |
| `bash` | Runs a shell command and returns combined stdout and stderr plus the exit code. Long output is truncated to the tail | `command` (string), `timeout` (number, seconds, default 30) |

## How the agent loop works

1. `runAgent` receives the message history, provider, model, optional system prompt, and tools.
2. It streams a response from the provider. `text_delta` events are printed immediately. A final `done` event carries the full assistant message, token usage, and stop reason.
3. The assistant message is added to the history.
4. If the message contains tool calls, each one is executed, `tool_end` events are emitted, and a tool result message is added to the history. The loop then goes back to step 2.
5. If there are no tool calls, or `maxTurns` is reached, the loop ends.

## Project structure

```
src/
├─ main.ts                 # CLI entry point: parses flags, loads provider and tools, runs the agent
├─ types.ts                # Shared types (Message, Tool, Provider, StreamEvent, ...)
├─ agent/
│  └─ loop.ts              # runAgent(): the core loop
├─ provider/
│  ├─ index.ts             # getProvider(name) factory
│  └─ openai-compat.ts     # Adapter from the OpenAI SDK to the Provider interface
└─ tools/
   ├─ index.ts             # Exports the tools array
   ├─ read.ts
   └─ bash.ts
bin/
└─ mypi.js                 # Launcher used by `npm link`
```

## Adding a tool

1. Create `src/tools/grep.ts`. This version passes arguments as an array instead of building a shell string, so a model-supplied pattern cannot inject shell commands:

   ```ts
   import { execFile } from "node:child_process";
   import { promisify } from "node:util";
   import type { Tool } from "../types.ts";

   const run = promisify(execFile);

   export const grepTool: Tool = {
     name: "grep",
     description: "Search a file for a regex pattern and return matching lines.",
     parameters: {
       type: "object",
       properties: {
         path: { type: "string", description: "File to search." },
         pattern: { type: "string", description: "Regex pattern." },
       },
       required: ["path", "pattern"],
     },
     async execute(args) {
       try {
         const { stdout } = await run("grep", ["-n", "-e", args.pattern, "--", args.path]);
         return stdout;
       } catch (e: any) {
         if (e.code === 1) return "No matches.";
         return `Error: ${e.message}`;
       }
     },
   };
   ```

2. Register it in `src/tools/index.ts`:

   ```ts
   export const tools: Tool[] = [readTool, bashTool, grepTool];
   ```

## Adding a provider

Any OpenAI-compatible endpoint works. Add an entry in `src/provider/index.ts`:

```ts
myapi: () =>
  createOpenAICompat(
    "myapi",
    "https://myapi.example.com/v1",
    process.env.MYAPI_KEY!,
    "my-default-model"
  ),
```

Then run with `--provider myapi`.

## Configuration

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | API key for the default Groq provider |
| `OPENAI_API_KEY` | API key if you point a provider at OpenAI |

A missing key causes an error when the provider is created.

## Safety

The `bash` tool runs real commands with your user's permissions, and the model decides what to run. Run mypi only in directories you are comfortable letting it modify, keep important work committed to git, and read what it does. There is no permission prompt yet.

## Roadmap

- [ ] Dedicated `write` and `edit` tools
- [ ] Confirmation prompt before running commands
- [ ] Interactive chat mode and session resume
- [ ] Native Anthropic provider

## License

ISC
