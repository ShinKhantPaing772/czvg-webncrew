type ParsedCsvRow = Record<string, string>;

export type ValidatedRouteRow = {
  rowNumber?: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  notes: string;
  aircraftNames: string[];
};

export type InvalidRouteRow = {
  rowNumber: number;
  fltnum?: string;
  dep?: string;
  arr?: string;
  duration?: string;
  aircraft?: string;
  errors: string[];
};

export type RouteToImport = ValidatedRouteRow & {
  durationInSeconds: number;
  aircraftIds: number[];
};

export type CreatedRouteSummary = {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
};

// Helper function to convert duration format
export function convertDurationToSeconds(duration: string | number): number {
  if (typeof duration === "number") {
    return Number.isFinite(duration) && duration > 0 ? duration : NaN;
  }
  if (typeof duration === "string" && duration.includes(":")) {
    const parts = duration.trim().split(":");
    if (parts.length === 2) {
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      if (
        Number.isInteger(hours) &&
        Number.isInteger(minutes) &&
        hours >= 0 &&
        minutes >= 0 &&
        minutes < 60
      ) {
        return hours * 3600 + minutes * 60;
      }
    }
  }

  const seconds = Number(duration);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : NaN;
}

// Helper function to parse CSV
export function parseCSV(text: string): {
  rows: ParsedCsvRow[];
  malformedRows: InvalidRouteRow[];
} {
  // Strip BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rawRows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentField += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      currentRow.push(currentField.trim());
      if (currentRow.some((value) => value !== "")) {
        rawRows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((value) => value !== "")) {
    rawRows.push(currentRow);
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field");
  }

  if (rawRows.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const headers = rawRows[0].map((h) => h.trim().toLowerCase());
  const parsedRows: ParsedCsvRow[] = [];
  const malformedRows: InvalidRouteRow[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const values = rawRows[i];
    if (values.length !== headers.length) {
      malformedRows.push({
        rowNumber: i + 1,
        errors: [
          `Column count mismatch: expected ${headers.length} columns, found ${values.length}`,
        ],
      });
      continue;
    }

    const row: ParsedCsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    parsedRows.push(row);
  }

  return { rows: parsedRows, malformedRows };
}

// Validate route row and extract aircraft names (non-throwing for row-level tolerance)
export function validateRouteRow(
  row: ParsedCsvRow,
  rowNumber: number,
):
  | { ok: true; route: ValidatedRouteRow }
  | { ok: false; error: InvalidRouteRow } {
  const errors: string[] = [];

  const fltnum = (row.fltnum || row["flight number"])?.toString().trim() || "";
  if (!fltnum) {
    errors.push("flight number (fltnum) is required");
  }

  const dep = (row.dep || row.departure)?.toString().trim().toUpperCase() || "";
  if (!dep) {
    errors.push("departure airport (dep) is required");
  } else if (dep.length !== 4 || !/^[A-Z]{4}$/.test(dep)) {
    errors.push("departure must be a 4-letter ICAO code");
  }

  const arr = (row.arr || row.arrival)?.toString().trim().toUpperCase() || "";
  if (!arr) {
    errors.push("arrival airport (arr) is required");
  } else if (arr.length !== 4 || !/^[A-Z]{4}$/.test(arr)) {
    errors.push("arrival must be a 4-letter ICAO code");
  }

  const duration = row.duration?.toString().trim() || "";
  if (!duration) {
    errors.push("duration is required");
  } else if (!duration.includes(":")) {
    errors.push("duration must be in HH:MM format");
  } else if (!Number.isFinite(convertDurationToSeconds(duration))) {
    errors.push("duration must be a valid HH:MM value");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: {
        rowNumber,
        fltnum,
        dep,
        arr,
        duration,
        aircraft: (row.aircraft || "").toString().trim(),
        errors,
      },
    };
  }

  // Preview rows already contain a normalized aircraftNames array. Preserve it
  // during the import pass; raw CSV rows still use the aircraft column.
  const normalizedAircraftNames = (row as unknown as { aircraftNames?: unknown })
    .aircraftNames;
  const aircraftNames: string[] = [];

  if (Array.isArray(normalizedAircraftNames)) {
    for (const name of normalizedAircraftNames) {
      if (typeof name === "string" && name.trim()) {
        aircraftNames.push(name.trim());
      }
    }
  } else {
    const aircraftStr = (row.aircraft || "").toString().trim();
    if (aircraftStr) {
      const names = aircraftStr.split(/[;|]/).map((name: string) => name.trim());
      for (const name of names) {
        if (name) {
          aircraftNames.push(name);
        }
      }
    }
  }

  return {
    ok: true,
    route: {
      rowNumber,
      fltnum,
      dep,
      arr,
      duration,
      notes: (row.notes || "").toString().trim(),
      aircraftNames,
    },
  };
}
