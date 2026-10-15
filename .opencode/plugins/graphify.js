// graphify OpenCode plugin (OpenCode v2)
// Injects a knowledge graph reminder before shell tool calls when the graph exists.
import { existsSync } from "fs";
import { join } from "path";

// Keep this text shell-safe: no backticks (PowerShell escape char, and bash
// command substitution inside double quotes), no nested quotes, and no bare
// angle brackets ("<question>" is a redirection operator to any shell that sees
// it unquoted).
const REMINDER =
  "[graphify] knowledge graph at graphify-out/. For focused questions, run: graphify query with your question (scoped subgraph, usually much smaller than GRAPH_REPORT.md) instead of grepping raw files. Read GRAPH_REPORT.md only for broad architecture context.";

export default {
  id: "graphify",
  async setup(ctx) {
    const graphPath = join(ctx.location.directory, "graphify-out", "graph.json");
    let reminded = false;

    // Do NOT return the registration: setup's return value must be undefined or a
    // cleanup function, otherwise unloading throws "r is not a function".
    await ctx.tool.hook("execute.before", (event) => {
      if (reminded) return;
      if (event.tool !== "shell") return;
      if (!existsSync(graphPath)) return;

      event.input = {
        ...event.input,
        // ";" is the only separator valid in both bash and Windows PowerShell 5.1.
        command: `echo "${REMINDER}"; ${event.input.command}`,
      };
      reminded = true;
    });
  },
};