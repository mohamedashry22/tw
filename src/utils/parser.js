/**
 * Escapes special regex characters in a string.
 * @param {string} string - The string to escape.
 * @returns {string} - The escaped string.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generates a single regex pattern for the entire alert message.
 * @param {string} alertTemplate - The alert template with tokens.
 * @param {Object} mappingFriendlyNames - Mapping of friendly names to token paths.
 * @returns {Object} - The mapping object with the regex and token names.
 */
function generateMapping(alertTemplate, mappingFriendlyNames) {
  // Regex to match tokens in the alert template
  const tokenRegex = /{{(.*?)}}/g;

  let pattern = "";
  const tokenNames = [];
  let lastIndex = 0;
  let match;

  // Build the regex pattern and token names
  while ((match = tokenRegex.exec(alertTemplate)) !== null) {
    const token = match[1];
    const precedingText = alertTemplate.slice(lastIndex, match.index);

    // Escape and add preceding text
    pattern += escapeRegExp(precedingText);

    // Add capture group for the token
    pattern += "(.*?)";

    // Map the token name
    tokenNames.push(mappingFriendlyNames[token] || token);

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last token
  if (lastIndex < alertTemplate.length) {
    const remainingText = alertTemplate.slice(lastIndex);
    pattern += escapeRegExp(remainingText);
  }

  // Create the final regex
  const regex = new RegExp(`^${pattern}$`, "s"); // 's' flag to allow '.' to match newlines

  return { regex, tokenNames };
}

/**
 * Extracts data from an alert message using the regex pattern and token names.
 * @param {string} message - The alert message.
 * @param {Object} mapping - The mapping object with the regex and token names.
 * @returns {Object} - The extracted data.
 */
function extractDataFromMessage(message, mapping) {
  const { regex, tokenNames } = mapping;
  const extractedData = {};

  const match = regex.exec(message);

  if (match) {
    for (let i = 0; i < tokenNames.length; i++) {
      const key = tokenNames[i];
      let value = match[i + 1].trim();

      // Determine type
      const type = !isNaN(value) && value !== "" ? "number" : "string";
      value = type === "number" ? parseFloat(value) : value;

      extractedData[key] = value;
    }
  } else {
    console.warn(`Could not match message using pattern '${regex}'`);
  }

  return extractedData;
}

/**
 * Replaces tokens in the content with the extracted data.
 * @param {string} content - The content with tokens.
 * @param {Object} extractedData - The data to replace the tokens.
 * @returns {string} - The content with tokens replaced.
 */
export function replaceTokens(content, extractedData) {
  for (const [key, value] of Object.entries(extractedData)) {
    const token = `{{${key}}}`;
    const regex = new RegExp(escapeRegExp(token), "g");
    content = content.replace(regex, value.toString());
  }
  return content;
}

/**
 * Main function to parse the alert message and generate the final content.
 * @param {string} alertMessage - The alert message.
 * @param {string} alertTemplate - The alert template with tokens.
 * @param {Object} mappingFriendlyNames - Mapping of friendly names to token paths.
 * @param {string} templateContent - The template content for output.
 * @param {string} templateContentClose - The template content when profitLoss is present.
 * @returns {string} - The final content after token replacement.
 */
export function parseAlertMessage(
  alertMessage,
  alertTemplate,
  mappingFriendlyNames
) {
  const mapping = generateMapping(alertTemplate, mappingFriendlyNames);

  const extractedData = extractDataFromMessage(alertMessage, mapping);

  console.log("extractedData", extractedData);

  return extractedData;
}

export function doesMessageMatchTemplate(
  alertMessage,
  alertTemplate,
  mappingFriendlyNames
) {
  const mapping = generateMapping(alertTemplate, mappingFriendlyNames);
  const { regex } = mapping;

  const match = regex.test(alertMessage);

  return match;
}
