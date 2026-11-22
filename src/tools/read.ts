import { readFile } from "node:fs/promises";
import {resolve} from "node:path"
import { Tool } from "../types.ts";

export const readTool : Tool = {
    name : "read",
    description : "Read a text file and return its content",
    parameters : {
        type : "object",
        properties : {
            path : {type : "string", description : "path to the file, relative to current folder"}
        },
        required : ["path"]
    },

    async execute (args) {
        return readFile(resolve(process.cwd(),String(args.path)), 'utf-8')
    }
}