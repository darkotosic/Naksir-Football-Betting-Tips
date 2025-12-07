const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'predictions.json');

const schema = {
  type: 'array',
  items: {
    type: 'object',
    required: [
      'homeTeam',
      'awayTeam',
      'date',
      'outcome',
      'btts',
      'over25',
      'confidence',
      'reason'
    ],
    additionalProperties: false,
    properties: {
      homeTeam: { type: 'string', minLength: 1 },
      awayTeam: { type: 'string', minLength: 1 },
      date: { type: 'string', minLength: 1 },
      outcome: { type: 'string', minLength: 1 },
      btts: { type: 'boolean' },
      over25: { type: 'boolean' },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      reason: { type: 'string', minLength: 1 }
    }
  }
};

function loadPredictions() {
  const fileContent = fs.readFileSync(dataPath, 'utf-8');

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌  Nevalidan JSON u ${dataPath}:`, error.message);
    process.exit(1);
  }
}

function typeMatches(value, expectedType) {
  if (expectedType === 'integer') {
    return Number.isInteger(value);
  }

  return typeof value === expectedType;
}

function validateItem(item, index, itemSchema, errors) {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    errors.push({
      path: `/${index}`,
      message: 'svaka stavka mora biti objekat'
    });
    return;
  }

  const { required = [], properties = {}, additionalProperties = true } = itemSchema;

  required.forEach((key) => {
    if (!(key in item)) {
      errors.push({
        path: `/${index}/${key}`,
        message: 'polje je obavezno'
      });
    }
  });

  Object.entries(item).forEach(([key, value]) => {
    if (properties[key]) {
      const definition = properties[key];

      if (!typeMatches(value, definition.type)) {
        errors.push({
          path: `/${index}/${key}`,
          message: `tip mora biti ${definition.type}`
        });
        return;
      }

      if (definition.minLength && typeof value === 'string' && value.length < definition.minLength) {
        errors.push({ path: `/${index}/${key}`, message: `minimalna dužina je ${definition.minLength}` });
      }

      if (definition.minimum !== undefined && typeof value === 'number' && value < definition.minimum) {
        errors.push({ path: `/${index}/${key}`, message: `minimalna vrednost je ${definition.minimum}` });
      }

      if (definition.maximum !== undefined && typeof value === 'number' && value > definition.maximum) {
        errors.push({ path: `/${index}/${key}`, message: `maksimalna vrednost je ${definition.maximum}` });
      }
    } else if (additionalProperties === false) {
      errors.push({
        path: `/${index}/${key}`,
        message: 'neočekivano polje'
      });
    }
  });
}

function validate(predictions) {
  const errors = [];

  if (!Array.isArray(predictions)) {
    errors.push({ path: '', message: 'koren mora biti niz predikcija' });
    return errors;
  }

  predictions.forEach((item, index) => {
    validateItem(item, index, schema.items, errors);
  });

  return errors;
}

function formatErrors(errors) {
  return errors.map((error) => `- ${error.path}: ${error.message}`).join('\n');
}

function main() {
  if (!fs.existsSync(dataPath)) {
    console.error(`❌  Fajl nije pronađen: ${dataPath}`);
    process.exit(1);
  }

  const predictions = loadPredictions();
  const errors = validate(predictions);

  if (errors.length > 0) {
    console.error('❌  Validacija nije uspela. Problemi u data/predictions.json:');
    console.error(formatErrors(errors));
    process.exit(1);
  }

  console.log('✅  data/predictions.json je validan.');
}

main();
