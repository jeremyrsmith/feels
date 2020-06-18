"use strict";

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

        const prevProgram = localStorage.getItem("last_program");
        if (prevProgram) {
            this.input.value = prevProgram;
        }

        this.input.style.visibility = 'visible';


    }

    runStop() {
        if (this.interpreter) {
            this.finishRun();
        } else {

            this.output.value = '';
            this.output.classList.remove('error');

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
        if (!this.paused && !this.runInterval) {
            this.startTicking();
        }
        this.pauseButton.innerHTML = this.paused ? "Resume" : "Pause";
    }

    doStep(evt) {
        if (!this.interpreter) {
            this.compileInput();
            this.pauseButton.innerHTML = "Resume";
            this.pauseButton.disabled = false;
            this.input.readOnly = true;
        }
        this.step();
        this.showPos();
        evt.preventDefault();
        console.log(window.getSelection());
    }

    startRun() {
        this.pauseButton.disabled = false;
        this.pauseButton.innerHTML = "Pause";
        this.runButton.innerHTML = "Stop";
        this.input.readOnly = true;
        this.startTicking();
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
        delete this.interpreter;
    }

    tick() {
        this.runInterval = window.requestAnimationFrame(() => this.tick());
        if (this.paused) {
            return;
        }
        // we'll limit to 1000 steps per frame, just to make sure the UI isn't blocked.
        if (this.interpreter) {
            for (let i = 0; i < 1000; i++) {
                if (!this.step())
                    return;
            }
            this.showPos();
        } else {
            this.finishRun();
        }
    }

    showPos() {
        if (this.interpreter) {
            const pos = this.interpreter.getPos();
            this.input.setSelectionRange(pos, pos + 1);
            this.input.focus();
        }
    }

    compileInput() {
        this.interpreter = Feels.compile(this.input.value);
    }

    step() {
        const cont = this.interpreter.step(output => this.appendOutput(output))
        if (!cont) {
            this.finishRun();
        }
        return cont;
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

    onKeyDown(evt) {
        if (evt.key === ':') {
            // TODO: pop up emoji keyboard or something.
            evt.preventDefault();
            return false;
        }
    }
}