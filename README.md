# 📦 `mypi` – A Minimal Agent Framework for LLM‑Powered Tool Use  

**Version:** 0.1.0 (as of this repository)  
**Language:** TypeScript (Node 20+)  

---

## Table of Contents
1. [What is this?](#what-is-this)
2. [Features](#features)
3. [Project Structure](#project-structure)
4. [Setup & Installation](#setup--installation)
5. [Running the Agent](#running-the-agent)
6. [Available Tools](#available-tools)
7. [How the Agent Loop Works](#how-the-agent-loop-works)
8. [Extending the Framework](#extending-the-framework)
9. [Configuration & Environment](#configuration--environment)
10. [License](#license)

---

## What is this?

`mypi` is a tiny **agent framework** that lets you talk to an LLM (via any OpenAI‑compatible provider) and let the model **call tools** (e.g., read a file, run a bash command).  
It demonstrates a complete round‑trip:

```
User prompt → LLM → Tool Call → Tool Result → LLM → … (repeat)
```

The code is deliberately straightforward so you can:

* Understand the mechanics of tool‑use in chat models.
* Plug in your own providers or tools with a few lines of TypeScript.
* Run locally without heavy dependencies (only `openai` SDK is required).

---

## Features

| Feature | Description |
| ------- | ----------- |
| **OpenAI‑compatible provider abstraction** – works with Groq, OpenAI, Azure, or any service exposing the OpenAI chat API. |
| **Tool‑use handling** – automatic detection of `tool_calls`, execution, and result injection. |
| **Two built‑in tools** <br> • `read` – read a file from the current working directory. <br> • `bash` – execute a bash command with timeout & tail‑truncation. |
| **Streaming output** – live display of LLM text deltas. |
| **Turn‑limit safety** – prevents infinite loops (default 20 turns). |
| **Zero‑config CLI** – just pass a prompt, model, and provider via CLI flags. |
| **Extensible** – add new tools, providers, or a system prompt with minimal code changes. |

---

## Project Structure

```
src/
├─ agent/                # Core loop that orchestrates turns
│   └─ loop.ts           # runAgent() implementation
├─ provider/             # Provider abstraction + OpenAI‑compatible adapter
│   ├─ index.ts          # getProvider(name) factory
│   └─ openai-compat.ts  # Adapter turning the OpenAI SDK into Provider
├─ tools/                # Built‑in tool implementations
│   ├─ read.ts           # readTool – returns file content
│   ├─ bash.ts           # bashTool – runs a command, truncates output
│   └─ index.ts          # tools array exported for the agent
├─ types.ts              # Shared TypeScript types (Message, Tool, Provider, etc.)
├─ main.ts               # CLI entry point – parses args, loads provider & tools, runs agent
└─ agent/loop.ts         # (see above)
```

* **`main.ts`** – parses CLI flags (`--prompt`, `--model`, `--provider`), loads the provider and tools, and starts the agent.
* **`agent/loop.ts`** – the heart of the framework; streams from the provider, records events, executes tools, and pushes new messages.
* **`provider/openai-compat.ts`** – adapts the official OpenAI SDK to the internal `Provider` interface, handling tool‑call parsing and usage stats.
* **`tools/`** – each tool follows the `Tool` interface (`name`, `description`, `parameters`, `execute`). Adding a new tool is as simple as creating a file and exporting it from `tools/index.ts`.

---

## Setup & Installation

1. **Prerequisites**
   * Node 20+ (tested with v20.x)
   * npm (or yarn/pnpm)  

2. **Clone the repo**

   ```bash
   git clone https://github.com/yourname/mypi.git
   cd mypi
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

   The only external dependency is the official `openai` SDK.

4. **Create a `.env` file** (next to the repo root) with the needed API keys. Example for Groq:

   ```env
   GROQ_API_KEY=sk-xxxxxxx
   ```

   The `dotenv` package automatically loads this file.

5. **Compile (optional)** – the source is written in TypeScript with native ES modules. If you prefer to run it directly with `ts-node`:

   ```bash
   npx ts-node src/main.ts --prompt "Hello"
   ```

   Or build it first:

   ```bash
   npm run build   # (adds a compiled `dist/` folder if you set up a script)
   node dist/main.js ...
   ```

---

## Running the Agent

```bash
node src/main.ts \
  --prompt "List all .md files in this repo and show their first line." \
  --model  "openai/gpt-4o-mini" \
  --provider groq
```

**CLI flags**

| Flag | Description | Default |
|------|-------------|---------|
| `--prompt` (`-p`) | The user query you want the LLM to answer. **Required**. |
| `--model` | Model identifier passed to the provider. | `openai/gpt-oss-120b` |
| `--provider` | Provider name that exists in `src/provider/index.ts`. | `groq` |

The output streams live text to `stdout`. When a tool is invoked you’ll see:

```
<tool name>
<tool result or error>
```

At the end of each turn the usage stats are printed:

```
<provider> ... <model> ... <input tokens> ... <output tokens> ... <stopReason>
```

---

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| **read** | Reads a text file and returns its content. | `path: string` – relative path from the current working directory. |
| **bash** | Executes a Bash command in the current folder. Returns combined stdout+stderr and exit code. | `command: string` – command to run (required). <br>`timeout?: number` – timeout in seconds (default 30). |

Both tools are exported via `src/tools/index.ts` and automatically passed to the provider so the model can call them using the OpenAI “function calling” format.

---

## How the Agent Loop Works

1. **Start Turn** – `runAgent` receives the current message history, provider, model, system prompt (optional), and the list of tools.
2. **Stream from Provider** – The provider yields `text_delta` events (displayed instantly) followed by a final `done` event containing:
   * Full assistant text (`content` array)
   * Token usage (`usage`)
   * Stop reason (`stopReason`)
3. **Push Assistant Message** – The assistant message is added to the conversation and emitted as a `turn_end` event.
4. **Tool Use Detection** – If `stopReason === "toolUse"`, the loop iterates over every `toolCall` block:
   * Finds the matching `Tool` by name.
   * Executes `tool.execute(arguments)`.
   * Emits `tool_start` & `tool_end` events (including any error).
   * Adds a `toolResult` message to the history.
5. **Repeat** – The loop goes back to step 2, using the updated history. A `maxTurns` guard (default 20) prevents runaway loops.

If the LLM finishes without a tool request, the agent exits cleanly.

---

## Extending the Framework

### Adding a New Tool

1. **Create the file** (e.g., `src/tools/grep.ts`):

   ```ts
   import { Tool } from "../types.ts";

   export const grepTool: Tool = {
     name: "grep",
     description: "Search for a pattern in a file and return matching lines.",
     parameters: {
       type: "object",
       properties: {
         path: { type: "string", description: "File to search." },
         pattern: { type: "string", description: "Regex pattern." },
       },
       required: ["path", "pattern"],
     },
     async execute(args) {
       const { execSync } = await import("node:child_process");
       const cmd = `grep -n "${args.pattern}" "${args.path}"`;
       try {
         return execSync(cmd, { encoding: "utf-8" });
       } catch (e) {
         return `No matches or error: ${(e as Error).message}`;
       }
     },
   };
   ```

2. **Export it** in `src/tools/index.ts`:

   ```ts
   import { grepTool } from "./grep.ts";
   export const tools: Tool[] = [readTool, bashTool, grepTool];
   ```

3. **Run** – the model can now call `grep` using the same function‑calling schema.

### Adding a New Provider

1. Implement a `Provider` that conforms to `src/types.ts` (`name`, `defaultModel`, `stream(opts)`).  
2. Add a factory entry in `src/provider/index.ts`:

   ```ts
   import { createOpenAICompat } from "./openai-compat.ts";

   const provider: Record<string, () => Provider> = {
     groq: () => createOpenAICompat("groq", "https://api.groq.com/openai/v1", process.env.GROQ_API_KEY!, "openai/gpt-oss-120b"),
     myapi: () => createOpenAICompat("myapi", "https://myapi.example.com/v1", process.env.MYAPI_KEY!, "gpt-4o-mini"),
   };
   ```

3. Use `--provider myapi` on the CLI.

---

## Configuration & Environment

| Variable | Purpose | Example |
|----------|---------|---------|
| `GROQ_API_KEY` | API key for the default Groq provider. | `sk-abc123...` |
| `OPENAI_API_KEY` | If you point the provider to OpenAI’s endpoint, set this. | `sk-xyz...` |
| `PORT` (optional) | Some users run a local proxy; you can pass a custom base URL via `createOpenAICompat`. | N/A |

The `.env` file is loaded via `dotenv` (quiet mode). Missing keys will cause a runtime error when the provider is instantiated.

---

## License

MIT © 2024‑2026 Your Name (or organization). Feel free to fork, modify, and use it in your own projects.  

---  

**Happy hacking!** 🎉