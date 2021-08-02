"use strict";

importScripts('feels.js');

let interpreter,
    timeout,
    pause = false;


function step() {
    if (!interpreter.step(output => postMessage({output}))) {
        interpreter = null;
        postMessage({done: true});
    }
    const pos = interpreter.getPos();
    postMessage({pos});
}

function run() {
    try {
        function go() {
            // yield the thread at least every 150-300ms, to allow messages to process
            const until = performance.now() + 150;
            while (performance.now() < until) {
                for (let i = 0; i < 1000; i++) {
                    if (!interpreter.step(output => postMessage({output}))) {
                        interpreter = null;
                        postMessage({done: true});
                        return;
                    }
                }
            }

            if (!pause) {
                timeout = setTimeout(go, 0);
            }
        }
        go();
    } catch (err) {
        postMessage(err);
    }
}


onmessage = messageEvent => {
    const msg = messageEvent.data;
    switch (msg.op) {
        case 'init':
            break;
        case 'compile':
            try {
                interpreter = Feels.compile(msg.source);
            } catch (err) {
                postMessage(err);
            }
            break;
        case 'run':
            pause = false;
            run();
            break;
        case 'pause':
            pause = true;
            if (timeout) {
                clearTimeout(timeout);
            }
            postMessage({pos: interpreter.getPos()});
            break;
        case 'step':
            step();
            break;
        case 'stop':
            pause = true;
            clearInterval(timeout);
            interpreter = null;
    }
}