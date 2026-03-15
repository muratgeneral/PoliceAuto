import { readFileSync } from 'fs';
import { parseInsurancePolicy } from './src/utils/dataParser.js';

const rawText = readFileSync('./test_raw.txt', 'utf-8');
console.log(parseInsurancePolicy(rawText));
