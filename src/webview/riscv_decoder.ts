// RISC-V Instruction Decoder
// Provides an extensible decoder for RV32I, Zifencei, Zicsr, and M extensions.
// All comments are in English per project requirements.

/**
 * Represents a decoded RISC-V instruction with its fields.
 */
export interface DecodedInstruction {
    // Raw 32-bit instruction word
    instr: number;
    // Extracted fields
    opcode: number;  // 7 bits
    rd: number;      // 5 bits
    rs1: number;     // 5 bits
    rs2: number;     // 5 bits
    funct3: number;  // 3 bits
    funct7: number;  // 7 bits
    // Immediate values (various types)
    imm_i: number;
    imm_s: number;
    imm_b: number;
    imm_u: number;
    imm_j: number;
    // CSR index (12 bits) for Zicsr instructions
    csr: number;
    // Shamt (shift amount) for immediate shifts
    shamt: number;
}

/**
 * Instruction description: matching function and formatting function.
 */
export interface InstructionDesc {
    // Human-readable mnemonic
    mnemonic: string;
    // Function that returns true if the decoded instruction matches this instruction
    match: (d: DecodedInstruction) => boolean;
    // Function that returns the formatted assembly string (e.g., "add x1, x2, x3")
    format: (d: DecodedInstruction) => string;
}

// Helper functions to extract fields from a 32-bit instruction word.
export function decodeInstruction(instr: number): DecodedInstruction {
    const opcode = instr & 0x7F;
    const rd = (instr >> 7) & 0x1F;
    const funct3 = (instr >> 12) & 0x7;
    const rs1 = (instr >> 15) & 0x1F;
    const rs2 = (instr >> 20) & 0x1F;
    const funct7 = (instr >> 25) & 0x7F;

    // I‑type immediate (sign‑extended)
    let imm_i = (instr >> 20) & 0xFFF;
    if (imm_i & 0x800) imm_i |= ~0xFFF;  // sign extend 12 bits

    // S‑type immediate
    let imm_s = ((instr >> 7) & 0x1F) | ((instr >> 25) << 5);
    if (imm_s & 0x800) imm_s |= ~0xFFF;

    // B‑type immediate (encoded as multiples of 2 bytes, convert to byte offset)
    let imm_b = ((instr >> 8) & 0xF) | ((instr >> 25) << 4) | ((instr >> 7) & 0x1) << 11 | ((instr >> 31) << 12);
    if (imm_b & 0x1000) imm_b |= ~0x1FFF;
    imm_b *= 2; // convert to byte offset

    // U‑type immediate
    let imm_u = instr & ~0xFFF;  // bits 31:12

    // J‑type immediate (encoded as multiples of 2 bytes, convert to byte offset)
    let imm_j = ((instr >> 21) & 0x3FF) | ((instr >> 20) & 0x1) << 10 | ((instr >> 12) & 0xFF) << 11 | ((instr >> 31) << 20);
    if (imm_j & 0x100000) imm_j |= ~0x1FFFFF;
    imm_j *= 2; // convert to byte offset

    // CSR field (bits 20:31) for Zicsr
    const csr = (instr >> 20) & 0xFFF;

    // Shift amount (bits 20:24) for immediate shifts
    const shamt = (instr >> 20) & 0x1F;

    return {
        instr,
        opcode,
        rd,
        rs1,
        rs2,
        funct3,
        funct7,
        imm_i,
        imm_s,
        imm_b,
        imm_u,
        imm_j,
        csr,
        shamt,
    };
}

// Helper to format register names
function regName(reg: number): string {
    if (reg === 0) return 'zero';
    if (reg === 1) return 'ra';
    if (reg === 2) return 'sp';
    if (reg === 3) return 'gp';
    if (reg === 4) return 'tp';
    if (reg >= 5 && reg <= 7) return `t${reg - 5}`;
    if (reg >= 8 && reg <= 9) return `s${reg - 8}`;
    if (reg >= 10 && reg <= 17) return `a${reg - 10}`;
    if (reg >= 18 && reg <= 27) return `s${reg - 16}`;
    if (reg >= 28 && reg <= 31) return `t${reg - 25}`;
    return `x${reg}`;
}

// Helper to format immediate as hexadecimal (prefixed with 0x) or decimal for small values
function fmtImm(imm: number): string {
    return imm.toString();
}

// RV32I Base Instruction Set
const rv32i: InstructionDesc[] = [
    // LUI
    {
        mnemonic: 'lui',
        match: (d) => d.opcode === 0x37,
        format: (d) => `lui ${regName(d.rd)}, ${fmtImm(d.imm_u)}`,
    },
    // AUIPC
    {
        mnemonic: 'auipc',
        match: (d) => d.opcode === 0x17,
        format: (d) => `auipc ${regName(d.rd)}, ${fmtImm(d.imm_u)}`,
    },
    // JAL
    {
        mnemonic: 'jal',
        match: (d) => d.opcode === 0x6F,
        format: (d) => `jal ${regName(d.rd)}, ${fmtImm(d.imm_j)}`,
    },
    // JALR
    {
        mnemonic: 'jalr',
        match: (d) => d.opcode === 0x67 && d.funct3 === 0,
        format: (d) => `jalr ${regName(d.rd)}, ${fmtImm(d.imm_i)}(${regName(d.rs1)})`,
    },
    // Branch instructions
    {
        mnemonic: 'beq',
        match: (d) => d.opcode === 0x63 && d.funct3 === 0,
        format: (d) => `beq ${regName(d.rs1)}, ${regName(d.rs2)}, ${fmtImm(d.imm_b)}`,
    },
    {
        mnemonic: 'bne',
        match: (d) => d.opcode === 0x63 && d.funct3 === 1,
        format: (d) => `bne ${regName(d.rs1)}, ${regName(d.rs2)}, ${fmtImm(d.imm_b)}`,
    },
    {
        mnemonic: 'blt',
        match: (d) => d.opcode === 0x63 && d.funct3 === 4,
        format: (d) => `blt ${regName(d.rs1)}, ${regName(d.rs2)}, ${fmtImm(d.imm_b)}`,
    },
    {
        mnemonic: 'bge',
        match: (d) => d.opcode === 0x63 && d.funct3 === 5,
        format: (d) => `bge ${regName(d.rs1)}, ${regName(d.rs2)}, ${fmtImm(d.imm_b)}`,
    },
    {
        mnemonic: 'bltu',
        match: (d) => d.opcode === 0x63 && d.funct3 === 6,
        format: (d) => `bltu ${regName(d.rs1)}, ${regName(d.rs2)}, ${fmtImm(d.imm_b)}`,
    },
    {
        mnemonic: 'bgeu',
        match: (d) => d.opcode === 0x63 && d.funct3 === 7,
        format: (d) => `bgeu ${regName(d.rs1)}, ${regName(d.rs2)}, ${fmtImm(d.imm_b)}`,
    },
    // Load instructions
    {
        mnemonic: 'lb',
        match: (d) => d.opcode === 0x03 && d.funct3 === 0,
        format: (d) => `lb ${regName(d.rd)}, ${fmtImm(d.imm_i)}(${regName(d.rs1)})`,
    },
    {
        mnemonic: 'lh',
        match: (d) => d.opcode === 0x03 && d.funct3 === 1,
        format: (d) => `lh ${regName(d.rd)}, ${fmtImm(d.imm_i)}(${regName(d.rs1)})`,
    },
    {
        mnemonic: 'lw',
        match: (d) => d.opcode === 0x03 && d.funct3 === 2,
        format: (d) => `lw ${regName(d.rd)}, ${fmtImm(d.imm_i)}(${regName(d.rs1)})`,
    },
    {
        mnemonic: 'lbu',
        match: (d) => d.opcode === 0x03 && d.funct3 === 4,
        format: (d) => `lbu ${regName(d.rd)}, ${fmtImm(d.imm_i)}(${regName(d.rs1)})`,
    },
    {
        mnemonic: 'lhu',
        match: (d) => d.opcode === 0x03 && d.funct3 === 5,
        format: (d) => `lhu ${regName(d.rd)}, ${fmtImm(d.imm_i)}(${regName(d.rs1)})`,
    },
    // Store instructions
    {
        mnemonic: 'sb',
        match: (d) => d.opcode === 0x23 && d.funct3 === 0,
        format: (d) => `sb ${regName(d.rs2)}, ${fmtImm(d.imm_s)}(${regName(d.rs1)})`,
    },
    {
        mnemonic: 'sh',
        match: (d) => d.opcode === 0x23 && d.funct3 === 1,
        format: (d) => `sh ${regName(d.rs2)}, ${fmtImm(d.imm_s)}(${regName(d.rs1)})`,
    },
    {
        mnemonic: 'sw',
        match: (d) => d.opcode === 0x23 && d.funct3 === 2,
        format: (d) => `sw ${regName(d.rs2)}, ${fmtImm(d.imm_s)}(${regName(d.rs1)})`,
    },
    // Immediate arithmetic/logic
    {
        mnemonic: 'addi',
        match: (d) => d.opcode === 0x13 && d.funct3 === 0,
        format: (d) => `addi ${regName(d.rd)}, ${regName(d.rs1)}, ${fmtImm(d.imm_i)}`,
    },
    {
        mnemonic: 'slti',
        match: (d) => d.opcode === 0x13 && d.funct3 === 2,
        format: (d) => `slti ${regName(d.rd)}, ${regName(d.rs1)}, ${fmtImm(d.imm_i)}`,
    },
    {
        mnemonic: 'sltiu',
        match: (d) => d.opcode === 0x13 && d.funct3 === 3,
        format: (d) => `sltiu ${regName(d.rd)}, ${regName(d.rs1)}, ${fmtImm(d.imm_i)}`,
    },
    {
        mnemonic: 'xori',
        match: (d) => d.opcode === 0x13 && d.funct3 === 4,
        format: (d) => `xori ${regName(d.rd)}, ${regName(d.rs1)}, ${fmtImm(d.imm_i)}`,
    },
    {
        mnemonic: 'ori',
        match: (d) => d.opcode === 0x13 && d.funct3 === 6,
        format: (d) => `ori ${regName(d.rd)}, ${regName(d.rs1)}, ${fmtImm(d.imm_i)}`,
    },
    {
        mnemonic: 'andi',
        match: (d) => d.opcode === 0x13 && d.funct3 === 7,
        format: (d) => `andi ${regName(d.rd)}, ${regName(d.rs1)}, ${fmtImm(d.imm_i)}`,
    },
    // Shift immediate (funct7 disambiguates SRAI)
    {
        mnemonic: 'slli',
        match: (d) => d.opcode === 0x13 && d.funct3 === 1 && d.funct7 === 0,
        format: (d) => `slli ${regName(d.rd)}, ${regName(d.rs1)}, ${d.shamt}`,
    },
    {
        mnemonic: 'srli',
        match: (d) => d.opcode === 0x13 && d.funct3 === 5 && d.funct7 === 0,
        format: (d) => `srli ${regName(d.rd)}, ${regName(d.rs1)}, ${d.shamt}`,
    },
    {
        mnemonic: 'srai',
        match: (d) => d.opcode === 0x13 && d.funct3 === 5 && d.funct7 === 0x20,
        format: (d) => `srai ${regName(d.rd)}, ${regName(d.rs1)}, ${d.shamt}`,
    },
    // Register-register operations
    {
        mnemonic: 'add',
        match: (d) => d.opcode === 0x33 && d.funct3 === 0 && d.funct7 === 0,
        format: (d) => `add ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'sub',
        match: (d) => d.opcode === 0x33 && d.funct3 === 0 && d.funct7 === 0x20,
        format: (d) => `sub ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'sll',
        match: (d) => d.opcode === 0x33 && d.funct3 === 1 && d.funct7 === 0,
        format: (d) => `sll ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'slt',
        match: (d) => d.opcode === 0x33 && d.funct3 === 2 && d.funct7 === 0,
        format: (d) => `slt ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'sltu',
        match: (d) => d.opcode === 0x33 && d.funct3 === 3 && d.funct7 === 0,
        format: (d) => `sltu ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'xor',
        match: (d) => d.opcode === 0x33 && d.funct3 === 4 && d.funct7 === 0,
        format: (d) => `xor ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'srl',
        match: (d) => d.opcode === 0x33 && d.funct3 === 5 && d.funct7 === 0,
        format: (d) => `srl ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'sra',
        match: (d) => d.opcode === 0x33 && d.funct3 === 5 && d.funct7 === 0x20,
        format: (d) => `sra ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'or',
        match: (d) => d.opcode === 0x33 && d.funct3 === 6 && d.funct7 === 0,
        format: (d) => `or ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'and',
        match: (d) => d.opcode === 0x33 && d.funct3 === 7 && d.funct7 === 0,
        format: (d) => `and ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    // FENCE, FENCE.TSO, PAUSE (treated as FENCE with specific immediates)
    {
        mnemonic: 'fence',
        match: (d) => d.opcode === 0x0F && d.funct3 === 0,
        format: (d) => {
            const fm = (d.instr >> 28) & 0xF;
            const pred = (d.instr >> 24) & 0xF;
            const succ = (d.instr >> 20) & 0xF;
            if (fm === 0x8 && pred === 0x3 && succ === 0x3 && d.rs1 === 0 && d.rd === 0) {
                return 'fence.tso';
            }
            if (fm === 0x0 && pred === 0x0 && succ === 0x0 && d.rs1 === 0 && d.rd === 0) {
                return 'pause';
            }
            // Map pred/succ bits to letters: bit0 -> 'r', bit1 -> 'w', bit2 -> 'i', bit3 -> 'o'
            const predStr = [
                pred & 0x1 ? 'r' : '',
                pred & 0x2 ? 'w' : '',
                pred & 0x4 ? 'i' : '',
                pred & 0x8 ? 'o' : '',
            ].filter(c => c !== '').join('');
            const succStr = [
                succ & 0x1 ? 'r' : '',
                succ & 0x2 ? 'w' : '',
                succ & 0x4 ? 'i' : '',
                succ & 0x8 ? 'o' : '',
            ].filter(c => c !== '').join('');
            // If both strings are empty (should not happen), fallback to hex
            if (predStr === '' && succStr === '') {
                return `fence ${pred.toString(16)}, ${succ.toString(16)}`;
            }
            return `fence ${predStr}, ${succStr}`;
        },
    },
    // ECALL, EBREAK
    {
        mnemonic: 'ecall',
        match: (d) => d.opcode === 0x73 && d.funct3 === 0 && d.imm_i === 0,
        format: () => 'ecall',
    },
    {
        mnemonic: 'ebreak',
        match: (d) => d.opcode === 0x73 && d.funct3 === 0 && d.imm_i === 1,
        format: () => 'ebreak',
    },
];

// Zifencei extension: FENCE.I
const zifencei: InstructionDesc[] = [
    {
        mnemonic: 'fence.i',
        match: (d) => d.opcode === 0x0F && d.funct3 === 1,
        format: () => 'fence.i',
    },
];

// Zicsr extension: CSR instructions
const zicsr: InstructionDesc[] = [
    {
        mnemonic: 'csrrw',
        match: (d) => d.opcode === 0x73 && d.funct3 === 1,
        format: (d) => `csrrw ${regName(d.rd)}, 0x${d.csr.toString(16).padStart(3, '0')}, ${regName(d.rs1)}`,
    },
    {
        mnemonic: 'csrrs',
        match: (d) => d.opcode === 0x73 && d.funct3 === 2,
        format: (d) => `csrrs ${regName(d.rd)}, 0x${d.csr.toString(16).padStart(3, '0')}, ${regName(d.rs1)}`,
    },
    {
        mnemonic: 'csrrc',
        match: (d) => d.opcode === 0x73 && d.funct3 === 3,
        format: (d) => `csrrc ${regName(d.rd)}, 0x${d.csr.toString(16).padStart(3, '0')}, ${regName(d.rs1)}`,
    },
    {
        mnemonic: 'csrrwi',
        match: (d) => d.opcode === 0x73 && d.funct3 === 5,
        format: (d) => `csrrwi ${regName(d.rd)}, 0x${d.csr.toString(16).padStart(3, '0')}, ${d.rs1}`,
    },
    {
        mnemonic: 'csrrsi',
        match: (d) => d.opcode === 0x73 && d.funct3 === 6,
        format: (d) => `csrrsi ${regName(d.rd)}, 0x${d.csr.toString(16).padStart(3, '0')}, ${d.rs1}`,
    },
    {
        mnemonic: 'csrrci',
        match: (d) => d.opcode === 0x73 && d.funct3 === 7,
        format: (d) => `csrrci ${regName(d.rd)}, 0x${d.csr.toString(16).padStart(3, '0')}, ${d.rs1}`,
    },
];

// M extension (multiply/divide)
const m: InstructionDesc[] = [
    {
        mnemonic: 'mul',
        match: (d) => d.opcode === 0x33 && d.funct3 === 0 && d.funct7 === 1,
        format: (d) => `mul ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'mulh',
        match: (d) => d.opcode === 0x33 && d.funct3 === 1 && d.funct7 === 1,
        format: (d) => `mulh ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'mulhsu',
        match: (d) => d.opcode === 0x33 && d.funct3 === 2 && d.funct7 === 1,
        format: (d) => `mulhsu ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'mulhu',
        match: (d) => d.opcode === 0x33 && d.funct3 === 3 && d.funct7 === 1,
        format: (d) => `mulhu ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'div',
        match: (d) => d.opcode === 0x33 && d.funct3 === 4 && d.funct7 === 1,
        format: (d) => `div ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'divu',
        match: (d) => d.opcode === 0x33 && d.funct3 === 5 && d.funct7 === 1,
        format: (d) => `divu ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'rem',
        match: (d) => d.opcode === 0x33 && d.funct3 === 6 && d.funct7 === 1,
        format: (d) => `rem ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
    {
        mnemonic: 'remu',
        match: (d) => d.opcode === 0x33 && d.funct3 === 7 && d.funct7 === 1,
        format: (d) => `remu ${regName(d.rd)}, ${regName(d.rs1)}, ${regName(d.rs2)}`,
    },
];

// Combine all instruction sets (order matters: more specific first)
const instructionSet: InstructionDesc[] = [
    ...rv32i,
    ...zifencei,
    ...zicsr,
    ...m,
];

/**
 * Disassemble a 32-bit binary string into a RISC-V assembly instruction.
 * @param binaryStr - 32-character string of '0' and '1'
 * @returns Assembly string, or hex representation if unknown.
 */
export function disassemble(binaryStr: string): string {
    if (binaryStr.length !== 32 || !/^[01]+$/.test(binaryStr)) {
        // Not a valid 32-bit binary string, return with underscores.
        return binaryStr.replace(/\B(?=(\d{4})+(?!\d))/g, "_");
    }
    const instr = parseInt(binaryStr, 2);
    const decoded = decodeInstruction(instr);

    // Try to find a matching instruction description
    for (const desc of instructionSet) {
        if (desc.match(decoded)) {
            return desc.format(decoded);
        }
    }

    // Unknown instruction: return hex representation
    const hexVal = instr.toString(16).padStart(8, '0');
    return `0x${hexVal}`;
}