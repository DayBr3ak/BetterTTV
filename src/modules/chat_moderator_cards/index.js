const $ = require('jquery');
const twitch = require('../../utils/twitch');
const keyCodes = require('../../utils/keycodes');

const ROW_CONTAINER_SELECTOR = '.chat-room__viewer-card .viewer-card__actions';
const VIEWER_CARD_CLOSE = '.viewer-card__hide button';
const CHAT_LINE_SELECTOR = '.chat-line__message';
const CHAT_LINE_USERNAME_SELECTOR = '.chat-line__username';
const CHAT_INPUT_SELECTOR = '.chat-input textarea';

const BTTV_MOD_CARDS_ID = 'bttv-mod-cards';
const BTTV_MOD_CARDS_SELECTOR = `#${BTTV_MOD_CARDS_ID}`;
const BTTV_ACTION_CLASS = 'bttv-mod-action';
const BTTV_ACTION_SELECTOR = `.${BTTV_ACTION_CLASS}`;
const BTTV_ACTION_ATTR = 'bttv-action';
const BTTV_ACTION_VAL_ATTR = 'bttv-val';

const ACTIONS_MAP = {
    TIMEOUT: '/timeout',
    PERMIT: '!permit'
};

const buttonTextTemplate = text => `
    <button class="tw-button-icon bttv-tx-size-10">
        <span class="tw-button__text">
            ${text}
        </span>
    </button>
`;

const buttonWrapperTemplate = (action, actionVal, tooltip, buttonTemplate) => `
    <div class="tw-tooltip-wrapper inline-flex">
        <div class="${BTTV_ACTION_CLASS}"
            ${BTTV_ACTION_ATTR}="${action}"
            ${BTTV_ACTION_VAL_ATTR}="${actionVal || ''}"
        >
            ${buttonTemplate}
        </div>
        <div class="tw-tooltip tw-tooltip--up tw-tooltip--align-center">${tooltip}</div>
    </div>
`;

const textButton = (action, actionVal, tooltip, text) => `
    ${buttonWrapperTemplate(action, actionVal, tooltip, buttonTextTemplate(text))}
`;

const modCardTemplate = `
<div class="c-background-alt-2 full-width flex" id="${BTTV_MOD_CARDS_ID}">
    <div class="pd-l-1 inline-flex flex-row">
        <div class="inline-flex">
            ${textButton('TIMEOUT', 1, 'Purge', '1s')}
            ${textButton('TIMEOUT', 60, 'Timeout 1m', '1m')}
            ${textButton('TIMEOUT', 600, 'Timeout 10m', '10m')}
            ${textButton('TIMEOUT', 3600, 'Timeout 1hr', '1hr')}
            ${textButton('TIMEOUT', 24 * 3600, 'Timeout 24hr', '24hr')}
            ${textButton('PERMIT', null, '!permit the user', '!permit')}
        </div>
    </div>
</div>`;

const INPUT_EVENT = new Event('input', { bubbles: true });
function setTextareaValue($inputField, msg) {
    $inputField.val(msg)[0].dispatchEvent(INPUT_EVENT);
}

class ChatModCardsModule {
    constructor() {
        $('body')
            .on('click', CHAT_LINE_USERNAME_SELECTOR, e => this.onUsernameClick(e))
            .on('click', BTTV_ACTION_SELECTOR, e => this.onModActionClick(e))
            .on('keydown.modCard', e => this.onKeydown(e));
        this.targetUser = {};
    }

    onUsernameClick(e) {
        const $target = $(e.target);
        const $line = $target.closest(CHAT_LINE_SELECTOR);
        const messageObj = twitch.getChatMessageObject($line[0]);

        const targetUser = {
            name: messageObj.user.userLogin,
            isMod: twitch.getUserIsModeratorFromTagsBadges(messageObj.badges),
            isOwner: twitch.getUserIsOwnerFromTagsBadges(messageObj.badges)
        };

        const currentUser = twitch.getCurrentUser();
        const currentIsOwner = twitch.getCurrentUserIsOwner();
        const currentIsMod = twitch.getCurrentUserIsModerator();

        const targetIsNotStaff = !(targetUser.isOwner || targetUser.isMod);
        const canModTargetUser = currentIsOwner || (currentIsMod && targetIsNotStaff);

        this.targetUser = targetUser;

        clearInterval(this.renderInterval);
        if (currentUser.name !== targetUser.name && canModTargetUser) {
            // initial load of a card requires to render asynchronously
            this.lazyRender();
        } else {
            $(BTTV_MOD_CARDS_SELECTOR).remove();
        }
    }

    lazyRender() {
        const currentRenderInterval = setInterval(() => {
            if (this.checkAndRender()) {
                clearInterval(currentRenderInterval);
            }
        }, 25);
        setTimeout(() => clearInterval(currentRenderInterval), 3000);
        this.renderInterval = currentRenderInterval;
    }

    checkAndRender() {
        if ($(BTTV_MOD_CARDS_SELECTOR).length) {
            return true;
        }
        $(modCardTemplate).appendTo(ROW_CONTAINER_SELECTOR);
        return $(BTTV_MOD_CARDS_SELECTOR).length > 0;
    }

    onModActionClick(e) {
        const $action = $(e.currentTarget);
        const action = ACTIONS_MAP[$action.attr(BTTV_ACTION_ATTR)];
        const actionVal = $action.attr(BTTV_ACTION_VAL_ATTR);

        if (action && this.targetUser.name) {
            twitch.sendChatMessage(`${action} ${this.targetUser.name} ${actionVal}`);
        }
    }

    close() {
        $(VIEWER_CARD_CLOSE).click();
    }

    isOpen() {
        return $(VIEWER_CARD_CLOSE).length > 0;
    }

    onKeydown(e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        if ($('input, textarea, select').is(':focus')) return;
        if (!this.isOpen()) return;

        const keyCode = e.keyCode || e.which;
        if (keyCode === keyCodes.Esc) {
            return this.close();
        }

        const userName = this.targetUser.name;
        if (!userName) {
            return this.close();
        }

        const isMod = twitch.getCurrentUserIsModerator();
        if (keyCode === keyCodes.t && isMod) {
            twitch.sendChatMessage('/timeout ' + userName);
            this.close();
        } else if (keyCode === keyCodes.p && isMod) {
            twitch.sendChatMessage('/timeout ' + userName + ' 1');
            this.close();
        } else if (keyCode === keyCodes.a && isMod) {
            twitch.sendChatMessage('!permit ' + userName);
            this.close();
        } else if (keyCode === keyCodes.u && isMod) {
            twitch.sendChatMessage('/unban ' + userName);
            this.close();
        } else if (keyCode === keyCodes.b && isMod) {
            twitch.sendChatMessage('/ban ' + userName);
            this.close();
        } else if (keyCode === keyCodes.i) {
            twitch.sendChatMessage('/ignore ' + userName);
            this.close();
        } else if (keyCode === keyCodes.w) {
            e.preventDefault();
            e.stopPropagation();
            const $inputField = $(CHAT_INPUT_SELECTOR);
            setTextareaValue($inputField, `/w ${userName} `);
            $inputField.focus();
            this.close();
        }
    }
}


module.exports = new ChatModCardsModule();
