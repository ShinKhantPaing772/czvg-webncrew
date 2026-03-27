# Bulk Route Import Feature

## Overview

The bulk route import feature allows administrators to import multiple routes into the system at once using a CSV file. This is useful for setting up a large number of routes quickly.

## How to Use

### 1. Navigate to Routes Management

- Go to `/crew/admin/routes`

### 2. Click "Bulk Import CSV"

- Look for the "Bulk Import CSV" button next to the "Add Route" button in the top right
- Click it to open the import dialog

### 3. Upload Your CSV File

- Click on the upload area or drag and drop a CSV file
- The system will parse the file and show a preview
- You'll see a mapping dialog for any aircraft mentioned in the CSV

### 4. Map Aircraft to Database Records

- For each aircraft name in your CSV, select the corresponding aircraft from the database
- Aircraft names in your CSV may not match the database exactly, so this mapping step is important
- You can leave aircraft unmapped if they don't correspond to any database aircraft

### 5. Review and Confirm

- Review the preview of routes to be imported
- Click "Import" to complete the bulk import

### 6. Review Results

- A summary dialog will show:
  - Number of routes successfully created
  - Number of errors (if any)
  - Detailed error messages for debugging

## CSV Format

### Required Columns

Your CSV file must contain these columns (in any order):

- `fltnum` - Flight number (e.g., VA101)
- `dep` - Departure airport ICAO code (e.g., KJFK)
- `arr` - Arrival airport ICAO code (e.g., KLAX)
- `duration` - Flight duration in HH:MM format (e.g., 5:30)
- `notes` - (Optional) Additional notes about the route
- `aircraft` - (Optional) Aircraft names separated by semicolons or pipes (e.g., "Boeing 787; Airbus A350")

### Aircraft Column

The `aircraft` column allows you to associate aircraft with each route. You can specify:

- **Single aircraft**: `Boeing 787 Dreamliner`
- **Multiple aircraft**: `Boeing 787 Dreamliner; Airbus A350` (separated by semicolons or pipes)
- **Leave blank**: If no aircraft are specified for a route, you can add them later

**Important:** Aircraft names in your CSV may not exactly match the aircraft names in the database. During import, you will be shown a mapping dialog where you can select which database aircraft corresponds to each aircraft name from your CSV.

### Example CSV

```csv
fltnum,dep,arr,duration,notes,aircraft
VA101,KJFK,KLAX,5:30,New York to Los Angeles,Boeing 787 Dreamliner; Airbus A350
VA102,KLAX,KJFK,5:45,Los Angeles to New York,Boeing 787 Dreamliner
VA103,KJFK,KMIA,3:15,New York to Miami,Airbus A320; Airbus A330
VA104,KMIA,KJFK,3:30,Miami to New York,Airbus A320
VA105,KLAX,KSFO,1:15,Los Angeles to San Francisco,
```

## Validation Rules

The system validates each row according to these rules:

1. **Flight Number (`fltnum`)**
   - Required
   - Must have at least one character

2. **Departure Airport (`dep`)**
   - Required
   - Must be exactly 4 uppercase letters (ICAO code)
   - Example: KJFK, KLAX, KMIA

3. **Arrival Airport (`arr`)**
   - Required
   - Must be exactly 4 uppercase letters (ICAO code)
   - Example: KJFK, KLAX, KMIA

4. **Duration (`duration`)**
   - Required
   - Must be in HH:MM format (e.g., 5:30, 1:15, 12:45)
   - Hours can be 1-2 digits, minutes must be 2 digits

5. **Notes (`notes`)**
   - Optional
   - Can be any text

6. **Aircraft (`aircraft`)**
   - Optional
   - Aircraft names separated by semicolons or pipes
   - Names don't need to match database exactly - you'll map them in the next step

## Aircraft Mapping

When you upload a CSV with aircraft names:

1. The system will parse the CSV and extract all unique aircraft names
2. You'll be presented with a mapping dialog
3. For each aircraft name from your CSV, select the corresponding aircraft from the database
4. If an aircraft from your CSV doesn't have a match in the database, you can leave it unmapped (select "None (skip)")
5. Unmapped aircraft will be ignored during import
6. Once you confirm the mappings, the actual import proceeds

## Error Handling

If validation fails, the import will stop and show detailed error messages for each problematic row. You can see:

- The row number where the error occurred
- The specific validation error
- Examples of valid formats

### Common Errors

- **"flight number (fltnum) is required"** - The fltnum column is empty
- **"departure must be a 4-letter ICAO code"** - The dep value is not a valid ICAO code (must be exactly 4 uppercase letters)
- **"arrival must be a 4-letter ICAO code"** - The arr value is not a valid ICAO code
- **"duration must be in HH:MM format"** - The duration is not in the correct format

## Partial Success

If some rows fail validation but others pass, the system will:

1. Show which routes were successfully created
2. Display error details for the failed rows
3. NOT import any of the failed rows (all-or-nothing validation)

Note: The validation is done for ALL rows before any imports occur. If any row has errors, no routes will be imported.

## Best Practices

1. **Test with a small batch first** - Try importing 2-3 routes before importing your full list
2. **Double-check airport codes** - Ensure all ICAO codes are valid 4-letter codes in uppercase
3. **Verify durations** - Make sure all times are in HH:MM format
4. **Use consistent formatting** - Keep your CSV formatting consistent throughout
5. **Keep a backup** - Store a copy of your route data before bulk importing

## Download Template

A template CSV file is available at `/public/routes-template.csv` with example routes you can use as a starting point.

## API Details

The bulk import feature uses the `/api/admin/routes/bulk-import` endpoint which supports two modes:

### Preview Mode (Step 1)

POST request with:

```json
{
  "mode": "preview",
  "csvContent": "fltnum,dep,arr,duration,notes,aircraft\n..."
}
```

Returns:

- Parsed and validated routes
- List of unique aircraft names from the CSV
- List of available aircraft in the database

### Import Mode (Step 2)

POST request with:

```json
{
  "mode": "import",
  "routes": [...parsed routes...],
  "mappings": {
    "Boeing 787": 1,
    "Airbus A350": 2
  }
}
```

Returns:

- Summary of import results
- Number of routes created
- Any errors that occurred

### Response Examples

**Preview Mode Response:**

```json
{
  "success": true,
  "message": "CSV parsed successfully",
  "preview": [
    {
      "fltnum": "VA101",
      "dep": "KJFK",
      "arr": "KLAX",
      "duration": "5:30",
      "notes": "New York to Los Angeles",
      "aircraftNames": ["Boeing 787 Dreamliner", "Airbus A350"]
    }
  ],
  "aircraftNames": ["Boeing 787 Dreamliner", "Airbus A350"],
  "availableAircraft": [
    {
      "id": 1,
      "name": "Boeing 787 Dreamliner",
      "liveryname": "Virgin Atlantic"
    },
    { "id": 2, "name": "Airbus A350", "liveryname": "Virgin Atlantic" }
  ]
}
```

**Import Mode Response:**

```json
{
  "success": true,
  "message": "Successfully imported 5 routes",
  "createdCount": 5,
  "errorCount": 0,
  "createdRoutes": [
    { "id": 101, "fltnum": "VA101", "dep": "KJFK", "arr": "KLAX" }
  ]
}
```
