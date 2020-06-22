"use strict";

// compute the line height of the output area
const outputLineHeight = (function () {
    const el = document.createElement('div');
    el.className = 'source';
    el.innerHTML = 'X';
    el.style.visibility = 'hidden';
    document.body.appendChild(el);
    const result = el.clientHeight;
    document.body.removeChild(el);
    return result;
})();



class FeelsUI {
    constructor(el) {
        this.el = el;
        this.input = el.querySelector('textarea.source');
        this.output = el.querySelector('textarea.output');
        this.runButton = el.querySelector('button.run-button');

        this.pauseButton = el.querySelector('button.pause-button');
        this.pauseButton.disabled = true;
        this.paused = false;

        this.stepButton = el.querySelector('button.step-button');
        this.stepButton.addEventListener('click', evt => this.doStep(evt));
        this.stepButton.addEventListener('mousedown', evt => evt.preventDefault());

        this.runButton.addEventListener('click', evt => this.runStop());
        this.pauseButton.addEventListener('click', evt => this.pauseResume());

        this.input.addEventListener('keydown', evt => this.onKeyDown(evt));
        this.input.addEventListener('input', evt => localStorage.setItem("last_program", this.input.value));

        this.measureInputTextWidth = (() => {
            const canvas = document.createElement('canvas');
            canvas.style.visibility = 'hidden';
            canvas.style.width = '0';
            canvas.style.height = '0';
            document.body.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            ctx.font = window.getComputedStyle(this.input).font;
            return (text) => ctx.measureText(text).width;
        })();

        this.loadLast();

        this.input.style.visibility = 'visible';

        this.running = false;
        this.worker = new Worker('interpreter-worker.js');
        this.worker.onmessage = messageEvent => {
            const msg = messageEvent.data;
            if (msg instanceof Error) {
                this.output.classList.add('error');
                this.output.value = `Compile error:\n${msg.message || "Unknown error"}`;
                this.finishRun();
                throw msg;
            }

            if (msg.output) {
                this.appendOutput(msg.output);
            } else if (msg.done) {
                this.finishRun();
            } else if (msg.pos !== undefined) {
                this.lastPos = msg.pos.offset;
                this.lineNumber = msg.pos.lineNumber;
                this.linePosition = msg.pos.linePosition;
                this.showPos();
                this.scrollToPos();
            }

        }
        const sharedBuffer = new SharedArrayBuffer(8);
        this.sharedBuffer = new Uint32Array(sharedBuffer, 0, 2);
        this.worker.postMessage({op: 'init', buf: sharedBuffer});
    }

    runStop() {
        if (this.running) {
            this.finishRun();
        } else {

            this.output.value = '';
            this.output.classList.remove('error');
            this.lastPos = -1;

            try {
                this.compileInput();
            } catch (err) {
                this.output.classList.add('error');
                this.output.value = `Compile error:\n${err.message || "Unknown error"}`;
                throw err;
            }

            this.startRun();
        }
    }

    pauseResume() {
        this.paused = !this.paused;
        this.sharedBuffer[0] = this.paused ? 1 : 0;
        this.pauseButton.innerHTML = this.paused ? "Resume" : "Pause";
        if (!this.paused) {
            this.startRun();
        }
    }

    doStep(evt) {
        if (!this.running) {
            this.compileInput();
            this.pauseButton.innerHTML = "Resume";
            this.runButton.innerHTML = "Stop";
            this.pauseButton.disabled = false;
            this.input.readOnly = true;
        }
        this.step();
        this.paused = true;
        evt.preventDefault();
    }

    startRun() {
        this.pauseButton.disabled = false;
        this.pauseButton.innerHTML = "Pause";
        this.runButton.innerHTML = "Stop";
        this.input.readOnly = true;
        this.startTicking();
        this.worker.postMessage({op: "run"});
    }

    startTicking() {
        this.runInterval = window.requestAnimationFrame(() => this.tick());
    }

    stopTicking() {
        if (this.runInterval) {
            window.cancelAnimationFrame(this.runInterval);
            delete this.runInterval;
        }
    }

    finishRun() {
        this.stopTicking();
        this.runButton.innerHTML = "Run";
        this.input.readOnly = false;
        this.pauseButton.innerHTML = "Pause";
        this.pauseButton.disabled = true;
        this.running = false;
        this.sharedBuffer[0] = 1;
        this.worker.postMessage({op: 'stop'});
        if (this.prevSelection) {
            this.input.setSelectionRange(this.prevSelection[0], this.prevSelection[1]);
        }
    }

    tick() {
        this.runInterval = window.requestAnimationFrame(() => this.tick());
        const pos = this.sharedBuffer[1];
        if (pos !== this.lastPos) {
            this.lastPos = pos;
            this.showPos();
        }
    }

    showPos() {
        this.input.setSelectionRange(this.lastPos, this.lastPos + 1);
        this.input.focus();
    }

    scrollToPos() {
        const line = this.lines[this.lineNumber].substring(0, this.linePosition);
        const posInLine = Math.round(this.measureInputTextWidth(line));
        const sourceWidth = Math.floor(this.input.clientWidth);
        const sourceHeight = Math.floor(this.input.clientHeight);
        const linePos = this.lineNumber * outputLineHeight;

        if (this.input.scrollTop + sourceHeight < linePos || linePos < this.input.scrollTop) {
            this.input.scrollTop = Math.floor(linePos / sourceHeight) * sourceHeight;
        }

        if (this.input.scrollLeft + sourceWidth < posInLine || posInLine < this.input.scrollLeft) {
            this.input.scrollLeft = Math.floor(posInLine / sourceWidth) * sourceWidth;
        }
    }

    compileInput() {
        this.prevSelection = [this.input.selectionStart || 0, this.input.selectionEnd || 0];
        this.running = true;
        this.lines = this.input.value.split('\n');
        this.worker.postMessage({op: 'compile', source: this.input.value});
    }

    step() {
        this.worker.postMessage({op: 'step'});
    }

    appendOutput(output) {
        this.output.value += output;
        if (this.output.clientHeight < this.output.scrollHeight && this.output.clientHeight < this.input.clientHeight) {
            this.output.style.height = `${parseInt(this.output.style.height) + 1}em`;
        }
    }

    loadExample(name) {
        if (/[^a-zA-Z0-9]/.test(name)) {
            throw new Error("Invalid example name");
        }
        const req = new XMLHttpRequest();
        req.open('GET', `examples/${name}.feels`);
        this.input.value = `Loading ${name}`;
        req.addEventListener('readystatechange', evt => {
            if (req.readyState === 4) {
                this.input.value = req.responseText;
            }
        });
        req.send(null);
    }

    loadLast() {
        const prevProgram = localStorage.getItem("last_program");
        if (prevProgram) {
            this.input.value = prevProgram;
        }
    }

    onKeyDown(evt) {
        if (evt.key === ':') {
            // TODO: pop up emoji keyboard or something.
            evt.preventDefault();
            return false;
        }
    }
}