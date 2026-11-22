import { Provider } from "../types.ts";
import { createOpenAICompat } from "./openai-compat.ts";

const provider:Record<string, ()=>Provider> = {
    "groq" : ()=>createOpenAICompat("groq", "https://api.groq.com/openai/v1", process.env.GROQ_API_KEY!, "openai/gpt-oss-120b")
}

export function getProvider(name:string): Provider {
    const create = provider[name];
    if(!create) {
        throw new Error("Some problem at index.ts")
    }
    return create()
}