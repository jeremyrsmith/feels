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
        if (this.runInterval) {
            this.finishRun();
        } else {

            this.output.value = '';
            this.output.classList.remove('error');

            try {
                this.interpreter = Feels.compile(this.input.value);
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
        this.pauseButton.innerHTML = this.paused ? "Resume" : "Pause";
    }

    startRun() {
        this.pauseButton.disabled = false;
        this.pauseButton.innerHTML = "Pause";
        this.runButton.innerHTML = "Stop";
        this.input.disabled = true;
        this.runInterval = window.requestAnimationFrame(() => this.step());
    }

    stopRun() {
        if (this.runInterval) {
            window.cancelAnimationFrame(this.runInterval);
            delete this.runInterval;
        }
    }

    finishRun() {
        this.stopRun();
        this.runButton.innerHTML = "Run";
        this.input.disabled = false;
        this.pauseButton.innerHTML = "Pause";
        this.pauseButton.disabled = true;
    }

    step() {
        if (this.paused) {
            return;
        }
        // we'll limit to 10 steps per frame, just to make sure the UI isn't blocked.
        if (this.interpreter) {
            for (let i = 0; i < 10; i++) {
                if (!this.interpreter.step(output => this.appendOutput(output))) {
                    this.finishRun();
                    return;
                }
            }
        } else {
            this.finishRun();
        }
        this.runInterval = window.requestAnimationFrame(() => this.step());
    }

    appendOutput(output) {
        this.output.value += output;
        if (this.output.clientHeight < this.output.scrollHeight && this.output.clientHeight < this.input.clientHeight) {
            this.output.style.height = `${parseInt(this.output.style.height) + 1}em`;
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