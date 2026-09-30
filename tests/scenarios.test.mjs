import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';

const schemaBytes = readFileSync(new URL('../qa/scenario-file.schema.json', import.meta.url));
const schema = JSON.parse(schemaBytes);
// The vendored schema declares draft 2020-12. Keep Ajv's default Unicode regex flags.
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile(schema);

const parseScenarios = (source) => {
  const document = parseDocument(source, { strict: true, uniqueKeys: true });
  assert.equal(document.errors.length + document.warnings.length, 0,
    [...document.errors, ...document.warnings].map((problem) => problem.message).join('\n'));
  return document.toJS();
};

const checkScenarios = (source) => {
  const document = parseScenarios(source);
  assert.ok(validate(document), JSON.stringify(validate.errors, null, 2));
  // JSON Schema's uniqueItems compares whole objects, not their id fields.
  const ids = document.scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, 'scenario ids must be unique');
  return document;
};

const fixture = (title = 'Title', tags = '[smoke]', step = '"Do something"') => `apiVersion: ai-qa/v1
scenarios:
  - id: sample
    title: ${title}
    steps:
      - ${step}
    expect:
      - "Something happened"
    tags: ${tags}
`;

test('vendored schema matches its recorded SHA-256', () => {
  const provenance = readFileSync(new URL('../qa/VENDORED.md', import.meta.url), 'utf8');
  const recorded = /SHA-256: `([a-f0-9]{64})`/.exec(provenance);
  assert.ok(recorded, 'VENDORED.md must record the schema SHA-256');
  assert.equal(createHash('sha256').update(schemaBytes).digest('hex'), recorded[1]);
});

test('QA scenarios parse strictly and validate against the vendored schema', () => {
  checkScenarios(readFileSync(new URL('../qa/scenarios.yaml', import.meta.url), 'utf8'));
});

test('YAML parse errors, warnings, and duplicate keys are rejected', () => {
  assert.throws(() => parseScenarios(fixture('Title', '[smoke')));
  assert.throws(() => parseScenarios(fixture('!unknown Title')), /Unresolved tag/);
  assert.throws(() => parseScenarios(fixture().replace('    title: Title',
    '    title: Title\n    title: Duplicate')), /unique/);
});

test('a blank YAML title is null and fails schema validation', () => {
  const document = parseScenarios(fixture(''));
  assert.equal(document.scenarios[0].title, null);
  assert.equal(validate(document), false);
  assert.ok(validate.errors.some((error) => error.instancePath === '/scenarios/0/title'
    && error.keyword === 'type'));
  assert.throws(() => checkScenarios(fixture('')), /must be string/);
});

test('YAML accepts a trailing comma in tags, and the schema accepts the parsed array', () => {
  const document = parseScenarios(fixture('Title', '[smoke,]'));
  assert.deepEqual(document.scenarios[0].tags, ['smoke']);
  assert.equal(validate(document), true);
  checkScenarios(fixture('Title', '[smoke,]'));
});

test('escaped quotes in steps are validated using decoded length', () => {
  const limit = schema.properties.scenarios.items.properties.steps.items.maxLength;
  const step = `${'a'.repeat(limit - 1)}"`;
  const source = fixture('Title', '[smoke]', JSON.stringify(step));
  assert.equal(parseScenarios(source).scenarios[0].steps[0], step);
  assert.equal(validate(parseScenarios(source)), true);
  checkScenarios(source);
  assert.throws(() => checkScenarios(fixture('Title', '[smoke]', JSON.stringify(`${step}a`))),
    /maxLength/);
});

test('emoji title length follows JSON Schema Unicode code-point semantics', () => {
  // JSON Schema maxLength counts Unicode code points, not UTF-16 code units or YAML bytes.
  const title = '😀'.repeat(500);
  assert.equal(title.length, 1000);
  const document = parseScenarios(fixture(title));
  assert.equal(document.scenarios[0].title, title);
  assert.equal(validate(document), true);
  checkScenarios(fixture(title));
  assert.throws(() => checkScenarios(fixture(`${title}😀`)), /maxLength/);
});

test('schema-valid tags accept uppercase letters and spaces', () => {
  const document = checkScenarios(fixture('Title', `[Smoke Test, "Upper Case", 'Another Tag']`));
  assert.deepEqual(document.scenarios[0].tags, ['Smoke Test', 'Upper Case', 'Another Tag']);
});

test('duplicate scenario ids are rejected even when the objects differ', () => {
  const source = fixture();
  const second = source.slice(source.indexOf('  - id:')).replace('title: Title', 'title: Other');
  assert.throws(() => checkScenarios(source + second), /scenario ids must be unique/);
});

test('schema validation reports all errors', () => {
  const source = fixture('').replace('id: sample', 'id: INVALID');
  assert.throws(() => checkScenarios(source), (error) => {
    assert.match(error.message, /"instancePath": "\/scenarios\/0\/id"/);
    assert.match(error.message, /"instancePath": "\/scenarios\/0\/title"/);
    return true;
  });
});
