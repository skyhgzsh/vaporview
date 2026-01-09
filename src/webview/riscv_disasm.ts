// RISCV disassembly value format
// This module provides a ValueFormat implementation for RISCV instruction disassembly.
// It only supports pure binary 32-bit waveforms (width=32 and 2-state values).

import { ValueFormat, valueIs9State } from "./value_format";
import { disassemble } from "./riscv_decoder";

// Format for RISCV disassembly
export const formatRiscv: ValueFormat = {
  id: "riscv",
  rightJustify: false,
  symbolText: "riscv",

  formatString: (inputString: string, width: number, is2State: boolean) => {
    // Only pure binary 32-bit values are supported.
    // If not 2-state, fallback to binary formatting with underscores.
    if (!is2State) {
      // For 9-state values, we cannot disassemble, so show binary with underscores.
      return inputString.replace(/\B(?=(\d{4})+(?!\d))/g, "_");
    }
    // If width is not 32, also fallback to binary.
    if (width !== 32) {
      return inputString.replace(/\B(?=(\d{4})+(?!\d))/g, "_");
    }
    // Otherwise, disassemble using the new decoder.
    return disassemble(inputString);
  },

  checkValidSearch: (inputText: string) => {
    // For search, we accept hexadecimal values (with or without 0x) and binary.
    if (inputText.match(/^(0x)?[0-9a-fA-F]+$/)) {
      return true;
    }
    if (inputText.match(/^b?[01_]+$/)) {
      return true;
    }
    return false;
  },

  parseValueForSearch: (inputText: string) => {
    // Convert search string to a binary string for matching.
    // Remove underscores and optional prefix.
    let cleaned = inputText.replace(/_/g, '');
    if (cleaned.startsWith('0x')) {
      // Hexadecimal
      const hex = cleaned.slice(2);
      const val = parseInt(hex, 16);
      if (isNaN(val)) {
        return '';
      }
      return val.toString(2).padStart(32, '0');
    } else if (cleaned.startsWith('b')) {
      // Binary
      return cleaned.slice(1).replace(/[^01]/g, '.');
    } else if (cleaned.match(/^[01]+$/)) {
      // Binary without prefix
      return cleaned;
    } else if (cleaned.match(/^[0-9a-fA-F]+$/)) {
      // Hexadecimal without prefix
      const val = parseInt(cleaned, 16);
      if (isNaN(val)) {
        return '';
      }
      return val.toString(2).padStart(32, '0');
    }
    // If not recognized, return as is (will be treated as literal).
    return cleaned;
  },

  is9State: valueIs9State,

  checkWidth: (width: number) => {
    // Only allow 32-bit signals.
    return width === 32;
  },
};
