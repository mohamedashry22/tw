import jsonpath from 'jsonpath';

export function extractData(eventData, mappingJson) {
  const extractedData = {};

  for (const [templateVariable, jsonPathExpression] of Object.entries(mappingJson)) {
    const result = jsonpath.query(eventData, jsonPathExpression);

    if (Array.isArray(result)) {
      if (result.length === 1) {
        extractedData[templateVariable] = result[0];
      } else {
        extractedData[templateVariable] = result.join(', ');
      }
    } else {
      extractedData[templateVariable] = result;
    }
  }

  return extractedData;
}