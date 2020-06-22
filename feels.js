"use strict";

const Feels = (function () {

    /*
        Instructions:

        G - increment the data pointer
        g - decrement the data pointer
        U - set the data pointer to 0 (move to the center of memory tape)
        A – increment the value at the data pointer
        a - decrement the value at the data pointer
        W - XOR the value in the cell to the left with the value at the data pointer and store at the current location
        w - XOR the value in the cell to the right with the value at the data pointer and store at the current location
        H - Logical shift the value at the data pointer 1 bit to the left
        h - Logical shift the value at the data pointer 1 bit to the right
        R – if the value at the data pointer is zero, jump forward to the instruction after the matching `r`
        r - if the value at the data pointer is not zero, jump backward to the instruction after the matching `R`
        F or 🤬 - store the value at the data pointer in the register.
        f or 😕 - load the value in the register to the tape at the current location
        😫 (or any other emoji between U+1F600 and U+1FAD6, besides the special ones mentioned below) – output the value at the data pointer as Unicode codepoint character
        😢 (U+1F622) – output the contents of memory starting at the data pointer and treating it as a zero-terminated string of Unicode codepoints
        😖 (U+1F616) - output a carriage return '\n'
        😭 (U+1F62D) - set the value at the data pointer to a random 32-bit number
        😡 (U+1F621) - set the value at the data pointer to zero
        😱 (U+1F631) - collapse the value at the data pointer to the unicode BMP codepoint range, by computing XOR of
                       the lower 16 bits with the upper 16 bits, and overwriting the value with this 16-bit value (0x0000 – 0xFFFF inclusive)
        😤 (U+1F624) - ignore the rest of the line.

        Whitespace (space, tab, CR, LF) is ignored. U+1F3FB–U+1F3FF (EMOJI MODIFIER FITZPATRICK TYPEs) are ignored.
        Exclamation marks are ignored!!!!!!!!

        There is no input; only destiny and chaos.
     */

    // This is just to generate a random 32-bit integer. I don't trust doing it by scaling a floating point number.
    function randomInt() {
        let result = 0;
        let bit = 0;
        for (let i = 0; i <= 32; i++) {
            if (Math.random() > 0.5) {
                bit = 1;
            } else {
                bit = 0;
            }
            result = (result << 1) | bit;
        }
        return result;
    }

    // collapse a 32-bit number to 16-bit, so it will be in unicode BMP range
    function collapse(x) {
        const lo = x >>> 16;
        const hi = x & 0xFFFF;
        return hi ^ lo;
    }

    function collapseIfNotUnicode(x) {
        if (x < 0 || x > 0x10FFFF)
            return collapse(x);
        return x;
    }

    // copy numbers from tape, starting at dp, until a 0 is found. Numbers outside of unicode range are collapsed to BMP range.
    function copyCString(positiveMem, negativeMem, dp) {
        const result = [];
        while (dp < 0 && (negativeMem[-dp] || 0) !== 0) {
            result.push(collapseIfNotUnicode(negativeMem[-dp]));
            dp++;
        }

        if (dp === 0) {
            while (dp < positiveMem.length && (positiveMem[dp] || 0) !== 0) {
                result.push(collapseIfNotUnicode(positiveMem[dp]));
                dp++;
            }
        }
        return String.fromCodePoint(...result);
    }

    // Represents the machine state and provides the manipulations.
    // Pass in a function to be invoked with output.
    function State() {

        // the memory tape stretches in both directions from zero, so it's two arrays – one for 0+ and one for negative indices.
        const positiveMem = [];
        const negativeMem = [];

        // REMOVE ME
        this.positiveMem = positiveMem;

        // program counter
        let pc = 0;

        // data pointer
        let dp = 0;

        // data pointer stack – not sure if this will get an instruction pair
        const dpStack = [];

        // register
        let reg = 0;

        function getValue(at) {
            if (typeof(at) === 'undefined') {
                at = dp;
            }

            if (at >= 0) {
                return positiveMem[at] || 0;
            } else {
                return negativeMem[-at] || 0;
            }
        }

        function setValue(v, at) {
            if (typeof(at) === 'undefined') {
                at = dp;
            }

            if (at >= 0) {
                positiveMem[at] = v;
            } else {
                negativeMem[-at] = v;
            }
        }

        // the methods are defined this way to access the private state above.
        this.next = () => { dp++; return this; };
        this.prev = () => { dp--; return this; };
        this.rew = () => { dp = 0; return this; }
        this.increment = () => { setValue(getValue() + 1); return this; };
        this.decrement = () => { setValue(getValue() - 1); return this; };
        this.xorLeft = () => { setValue(getValue() ^ getValue(dp - 1)); return this; };
        this.xorRight = () => { setValue(getValue() ^ getValue(dp + 1)); return this; };
        this.setRandom = () => { setValue(randomInt()); return this; };
        this.setZero = () => { setValue(0); return this; };
        this.shiftLeft = () => { setValue(getValue() << 1); return this; };
        this.shiftRight = () => { setValue(getValue() >>> 1); return this; };
        this.arithmeticShiftRight = () => { setValue(getValue() >> 1); return this; };
        this.collapseUnicode = () => { setValue(collapse(getValue())); return this; };
        this.store = () => { reg = getValue(); return this; };
        this.load = () => { setValue(reg); return this; };
        this.push = () => { dpStack.push(dp); return this; };
        this.pop = () => { dp = dpStack.pop() || 0; return this; }

        this.jumpIfNonzero = dst => {
            if (getValue()) {
                pc = dst;
            }
            return this;
        };

        this.jumpIfZero = dst => {
            if (!getValue()) {
                pc = dst;
            }
            return this;
        }


        this.outputChar = (output) => { output(String.fromCodePoint(getValue())); return this; };
        this.outputCString = (output) => { output(copyCString(positiveMem, negativeMem, dp)); return this; };

        this.getPc = () => pc;
        this.incrementPc = () => { pc++; return this; }

        this.getDp = () => dp;
    }

    function Interpreter(instructions) {
        let state = new State();
        this.getProgramCounter = () => state.getPc();
        let currentPos = 0;

        // evaluate one instruction, returning true if the program is still running
        // and false if it's halted.
        this.step = (output) => {
            const pc = state.getPc();
            if (pc >= instructions.length) {
                return false;
            }

            const [pos, instruction] = instructions[pc];
            currentPos = pos;
            state = instruction(state, output);
            // debug fun
            // console.log(instruction, state.getPc(), state.getDp(), state.positiveMem.map(dec => (dec >>> 0).toString(2)).join(', '));
            state = state.incrementPc();
            return true;
        }

        this.getPos = () => currentPos;
    }

    /**
     * Compile an input string into an array of JavaScript functions which operate on the program state. Returns
     * an Interpreter that can step through the program.
     */
    function compile(input) {
        input = Array.from(input.toString());
        const jumpStack = [];
        const instructions = [];
        const placeholder = state => state;
        let i;
        let bytePos = 0;
        let lineNumber = 0;
        let linePosition = 0;
        for (i = 0; i < input.length; i++) {
            const char = input[i];
            const position = {
                offset: bytePos,
                lineNumber: lineNumber,
                linePosition: linePosition
            };

            switch (char) {
                case 'G': instructions.push([position, state => state.next()]); break;
                case 'g': instructions.push([position, state => state.prev()]); break;
                case 'A': instructions.push([position, state => state.increment()]); break;
                case 'a': instructions.push([position, state => state.decrement()]); break;
                case 'W': instructions.push([position, state => state.xorLeft()]); break;
                case 'w': instructions.push([position, state => state.xorRight()]); break;
                case 'H': instructions.push([position, state => state.shiftLeft()]); break;
                case 'h': instructions.push([position, state => state.shiftRight()]); break;
                case 'U': instructions.push([position, state => state.rew()]); break;
                case '😢': instructions.push([position, (state, output) => state.outputCString(output)]); break;
                case '😖': instructions.push([position, (state, output) => { output("\n"); return state; }]); break;
                case '😭': instructions.push([position, state => state.setRandom()]); break;
                case '😡': instructions.push([position, state => state.setZero()]); break;
                case '😱': instructions.push([position, state => state.collapseUnicode()]); break;
                case 'F':
                case '🤬':
                    instructions.push([position, state => state.store()]); break;
                case 'f':
                case '😕':
                    instructions.push([position, state => state.load()]); break;
                case '😤':
                    while (i < input.length && input[i] !== "\n") {
                        i++;
                        if (input[i]) {
                            bytePos += input[i].length;
                        }
                    }
                    lineNumber++;
                    linePosition = -1;
                    break;
                case 'R':
                    jumpStack.push(instructions.length);
                    instructions.push([position, placeholder]);
                    break;
                case 'r':
                    if (!jumpStack.length) {
                        throw new Error(`Mismatched R/r at ${instructions.length}`);
                    }
                    const start = jumpStack.pop();
                    const end = instructions.length;
                    instructions.push([position, state => state.jumpIfNonzero(start)]);
                    instructions[start][1] = state => state.jumpIfZero(end);
                    break;
                case '\n':
                    lineNumber++;
                    linePosition = -1;
                    break;
                case '!':
                case ' ':
                case '\r':
                case '\t':
                case '.':
                case ',':
                    break;

                default:
                    const codePoint = char.codePointAt(0);
                    if (codePoint >= 0x1F600 && codePoint <= 0x1FAD6) {
                        instructions.push([position, (state, output) => state.outputChar(output)]);
                    } else if (codePoint < 0x1F3FB || codePoint > 0x1F3FF) {
                        throw new Error(`Unknown token ${char}`);
                    }
            }
            bytePos += char.length;
            linePosition += char.length;
        }

        return new Interpreter(instructions);
    }




    return {
        compile
    };
})()