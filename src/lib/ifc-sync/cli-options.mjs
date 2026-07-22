export function printUsage() {
  console.log(`Synchronize pilots with Infinite Flight Community identities.

Usage:
  npm run sync:ifc-users
  npm run sync:ifc-users -- --apply
  npm run sync:ifc-users -- --pilot-id=123
  npm run sync:ifc-users -- --pilot-id=123 --apply

Options:
  --apply             Write verified changes to the pilots table.
  --pilot-id=<id>     Audit only one local pilot.
  --help              Show this help.

The default mode is a dry run. Environment variables are loaded with Next.js'
normal .env file rules and require IF_API plus the DB_* settings.`);
}

export function parseOptions(argv) {
  const options = { apply: false, pilotId: null, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--apply") {
      options.apply = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--pilot-id") {
      options.pilotId = parsePilotId(argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument.startsWith("--pilot-id=")) {
      options.pilotId = parsePilotId(argument.slice("--pilot-id=".length));
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function parsePilotId(value) {
  const pilotId = Number(value);
  if (!Number.isInteger(pilotId) || pilotId <= 0) {
    throw new Error("--pilot-id must be a positive integer");
  }
  return pilotId;
}
