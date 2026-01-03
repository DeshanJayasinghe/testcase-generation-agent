import { parseCodeMetadata } from "../parsers/codeMetadataParser.js";
import { extractRequirements } from "../parsers/requirementsParser.js";

export function extractMetadata(code: string, requirements: string) {
  const metadata = parseCodeMetadata(code);
  const parsedRequirements = extractRequirements(requirements);
  
  return {
    metadata,
    requirements: parsedRequirements,
  };
}