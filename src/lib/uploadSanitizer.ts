type SanitizedUploadResult = {
  aggregationData: any;
  warnings: string[];
};

function normalizeParts(parts: any): any[] {
  if (Array.isArray(parts)) return parts;
  if (!parts || typeof parts !== 'object') return [];
  return Object.values(parts);
}

function looksLikeCompactAggregationExport(rawData: any) {
  return (
    rawData &&
    typeof rawData === 'object' &&
    typeof rawData.aggregation_name === 'string' &&
    rawData.parts &&
    typeof rawData.parts === 'object' &&
    !rawData.object_type
  );
}

export function sanitizeUploadedAggregationData(rawData: any): SanitizedUploadResult {
  if (looksLikeCompactAggregationExport(rawData)) {
    throw new Error(
      'This file uses the compact aggregation export format and cannot be uploaded here. ' +
      'Use a Wasp serialized aggregation file or re-download the dataset from the build screen.',
    );
  }

  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    throw new Error('Expected a Wasp serialized aggregation object.');
  }

  const aggregationData = JSON.parse(JSON.stringify(rawData ?? {}));
  const warnings: string[] = [];

  aggregationData.object_type = aggregationData.object_type || 'Aggregation';
  aggregationData.name = aggregationData.name || 'Uploaded aggregation';
  aggregationData.rules = Array.isArray(aggregationData.rules) ? aggregationData.rules : [];
  aggregationData.global_constraints = aggregationData.global_constraints ?? [];
  aggregationData.catalog = aggregationData.catalog ?? null;
  // Atlas opens an independent Mode-0 copy by explicit product policy.
  // Unsupported Fields are removed from this copy by the same product policy.
  // Constraints, part classes, inventory and attributes stay for core validation.
  if (aggregationData.mode != null && aggregationData.mode !== 0) {
    warnings.push(`Opened in Mode 0 instead of Mode ${aggregationData.mode}.`);
  }
  aggregationData.mode = 0;
  aggregationData.coll_check = typeof aggregationData.coll_check === 'boolean' ? aggregationData.coll_check : true;
  const field = aggregationData.field;
  if (field != null && (typeof field !== 'object' || Object.keys(field).length > 0)) {
    warnings.push('Field data was removed from this Mode-0 copy.');
  }
  aggregationData.field = null;
  aggregationData.graph = aggregationData.graph && typeof aggregationData.graph === 'object' ? aggregationData.graph : {};
  aggregationData.aggregated_parts = aggregationData.aggregated_parts && typeof aggregationData.aggregated_parts === 'object'
    ? aggregationData.aggregated_parts
    : {};
  aggregationData.aggregated_parts_sequence = Array.isArray(aggregationData.aggregated_parts_sequence)
    ? aggregationData.aggregated_parts_sequence
    : [];

  const rawParts = normalizeParts(aggregationData.parts);
  aggregationData.parts = rawParts;

  return { aggregationData, warnings };
}
