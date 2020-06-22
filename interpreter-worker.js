"use strict";

importScripts('feels.js');


let interpreter;
let sharedBuffer;


function step() {
    if (!interpreter.step(output => postMessage({output}))) {
        interpreter = null;
        postMessage({done: true});
    }
    const pos = interpreter.getPos();
    sharedBuffer[1] = pos.offset;
    postMessage({pos});
}

function run() {
    while (true) {
        if (sharedBuffer[0] !== 0) {
            const pos = interpreter.getPos();
            postMessage({pos});
            return;
        }
        if (!interpreter.step(output => postMessage({output}))) {
            interpreter = null;
            postMessage({done: true});
            return;
        }
        sharedBuffer[1] = interpreter.getPos().offset;
    }
}


onmessage = messageEvent => {
    const msg = messageEvent.data;
    switch (msg.op) {
        case 'init':
            sharedBuffer = new Uint32Array(msg.buf, 0, 2);
            break;
        case 'compile':
            try {
                interpreter = Feels.compile(msg.source);
            } catch (err) {
                postMessage(err);
            }
            break;
        case 'run':
            try {
                run();
                sharedBuffer[0] = 0;
            } catch (err) {
                postMessage(err);
            }
            break;
        case 'step':
            step();
            break;
        case 'stop':
            interpreter = null;
            sharedBuffer[0] = 0;
    }
}