const $ = require('jquery');
const watcher = require('../../watcher');
const storage = require('../../storage');
const twitch = require('../../utils/twitch');
const keycodes = require('../../utils/keycodes');

const CHAT_LIST_SELECTOR = '.chat-list';
const MESSAGES_INDICATOR_SELECTOR = '.chat-list__more-messages';
const FREEZE_KEYS = [keycodes.Ctrl, keycodes.Meta];

const PATCHED_SYMBOL = Symbol();
let twitchSetState;
let bufferSize;

function setChatBufferSize(size) {
    if (!size) return;
    try {
        twitch.getChatController().chatBuffer.maxSize = size;
    } catch (_) {}
}

function patchedSetState({isAutoScrolling}) {
    if (isAutoScrolling !== undefined) {
        setChatBufferSize(isAutoScrolling ? bufferSize : Infinity);
    }
    return twitchSetState.apply(this, arguments);
}

function patchScroller() {
    const scroller = twitch.getChatScroller();
    if (!scroller) return;

    const newScrollerSetState = scroller.setState;
    if (
        newScrollerSetState === patchedSetState ||
        scroller._bttvSetStatePatched === PATCHED_SYMBOL
    ) {
        return;
    }
    scroller.setState = patchedSetState;
    scroller._bttvSetStatePatched = PATCHED_SYMBOL;
    twitchSetState = newScrollerSetState;
}

function setScrollState(enabled) {
    const scroller = twitch.getChatScroller();
    if (!scroller) return;
    scroller.setState({
        isAutoScrolling: enabled
    });
}

function shouldFreeze(e) {
    return FREEZE_KEYS.includes(e.keyCode) && $(`${CHAT_LIST_SELECTOR}:hover`).length && !document.hidden;
}

class ChatFreezeModule {
    constructor() {
        let keysPressed = 0;
        $('body')
            .on('keydown.chat-freeze', e => {
                keysPressed++;

                if (!shouldFreeze(e)) return;
                keysPressed = 0;
            })
            .on('keyup.chat-freeze', e => {
                if (!shouldFreeze(e) || keysPressed > 0) return;

                const indicator = $(MESSAGES_INDICATOR_SELECTOR).length > 0;
                setScrollState(indicator);
            });

        watcher.on('load.chat', () => {
            bufferSize = storage.get('scrollbackAmount');
            if (!bufferSize) {
                try {
                    bufferSize = twitch.getChatController().chatBuffer.maxSize;
                } catch (_) {}
            }
            bufferSize && patchScroller();
        });

        storage.on('changed.scrollbackAmount', newSize => {
            bufferSize = newSize;
        });
    }
}

module.exports = new ChatFreezeModule();
