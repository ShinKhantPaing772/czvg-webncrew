#!/usr/bin/env node

import process from "node:process";
import nextEnv from "@next/env";
import { runSync } from "../src/lib/ifc-sync/run-sync.mjs";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

runSync(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(
      `IFC identity sync failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
