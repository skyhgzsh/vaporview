import { disassemble } from '../src/webview/riscv_decoder';
import * as fs from 'fs';
import * as path from 'path';

function parseRefLine(line: string): { binary: string; expected: string } | null {
    const trimmed = line.trim();
    if (!trimmed) {
        return null;
    }
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace === -1) {
        console.error(`Invalid line: ${trimmed}`);
        return null;
    }
    const binary = trimmed.slice(0, firstSpace).trim();
    const expected = trimmed.slice(firstSpace).trim();
    if (binary.length !== 32) {
        console.error(`Binary string length is not 32: ${binary}`);
        return null;
    }
    return { binary, expected };
}

function runTest() {
    const refPath = path.join(__dirname, 'ref.txt');
    const content = fs.readFileSync(refPath, 'utf-8');
    const lines = content.split('\n');
    let total = 0;
    let passed = 0;
    const failures: Array<{binary: string, expected: string, actual: string}> = [];

    for (const line of lines) {
        const parsed = parseRefLine(line);
        if (!parsed) {
            continue;
        }
        total++;
        const { binary, expected } = parsed;
        const actual = disassemble(binary);
        if (actual === expected) {
            passed++;
        } else {
            failures.push({ binary, expected, actual });
            console.error(`FAIL: ${binary}`);
            console.error(`  expected: ${expected}`);
            console.error(`  actual:   ${actual}`);
        }
    }

    console.log(`\nTest Results: ${passed}/${total} passed`);
    if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach((f, idx) => {
            console.log(`${idx + 1}. binary: ${f.binary}`);
            console.log(`   expected: ${f.expected}`);
            console.log(`   actual:   ${f.actual}`);
        });
        process.exit(1);
    } else {
        console.log('All tests passed!');
        process.exit(0);
    }
}

if (require.main === module) {
    runTest();
}