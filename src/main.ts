import '@logseq/libs';
import PatternLock from 'vanilla-pattern-lock';

const settingsVersion = 'v1';
export const defaultSettings = {
  showToolbarIcon: true,
  keyBindings: {
    lockScreen: 'mod+alt+l'
  },
  settingsVersion,
  disabled: false,
};

export type DefaultSettingsType = typeof defaultSettings;

const initSettings = () => {
  let settings = logseq.settings;

  const shouldUpdateSettings = !settings || settings.settingsVersion != defaultSettings.settingsVersion;

  if (shouldUpdateSettings) {
    settings = defaultSettings;
    logseq.updateSettings(settings);
  }
};

const getSettings = (key: string | undefined, defaultValue: any = undefined) => {
  let settings = logseq.settings;
  const merged = Object.assign(defaultSettings, settings);
  return key
    ? merged[key]
      ? merged[key]
      : defaultValue
    : merged;
};

async function main() {
  initSettings();
  const keyBindings = getSettings('keyBindings');
  const showToolbarIcon = getSettings('showToolbarIcon');

  let pass = '';

  // get element refs
  const lock = new PatternLock({ vibrate: true });
  const containerEl = document.getElementById('container');
  const messageEl = document.getElementById('message');
  const bgEl = document.getElementById('bg') as HTMLImageElement;
  const refreshButtonEl = document.getElementById('refresh-button');
  const keywordInputEl = document.getElementById('keyword') as HTMLInputElement;

  // trigger change bg
  const refreshButtonElClickHandler = () => {
    const height = window.innerHeight;
    const width = window.innerWidth;
    const size = width && height ? `${width}x${height}` : '1920x1080';
    const keyword = keywordInputEl.value;
    let url;
    if (keyword) {
      if (keyword.indexOf('https://') === 0 || keyword.indexOf('http://') === 0 || keyword.indexOf('file://') === 0) {
        url = keyword;
      } else {
        url = `https://source.unsplash.com/random/${size}/?landscape,${keyword}`;
      }
    } else {
      url = `https://source.unsplash.com/random/${size}/?landscape`;
    }

    bgEl.src = url;
  };

  const keywordInputElBlurHandler = async e => {
    refreshButtonElClickHandler();
    await logseq.FileStorage.setItem('keyword', keywordInputEl.value);
  };

  const keywordInputElEnterHandler = async e => {
    if (e.keyCode === 13) {
      refreshButtonElClickHandler();
      await logseq.FileStorage.setItem('keyword', keywordInputEl.value);
    }
  };

  // register model
  const openModel = {
    async show() {
      pass = '';
      messageEl && (messageEl.innerText = 'Set your unlock pattern to lock screen.');
      lock.clear();
      if (refreshButtonEl) {
        refreshButtonEl.removeEventListener('click', refreshButtonElClickHandler, false);
        refreshButtonEl.addEventListener('click', refreshButtonElClickHandler, false);
      }
      logseq.showMainUI({
        autoFocus: true
      });

      try {
        const cachedKeyword = await logseq.FileStorage.getItem('keyword');
        keywordInputEl.value = cachedKeyword || '';
      } catch (e) {}


      refreshButtonElClickHandler();
    },
  };

  logseq.provideModel(openModel);

  // keywords logic
  keywordInputEl.removeEventListener('blur', keywordInputElBlurHandler, false);
  keywordInputEl.addEventListener('blur', keywordInputElBlurHandler, false);
  keywordInputEl.removeEventListener('keyup', keywordInputElEnterHandler, false);
  keywordInputEl.addEventListener('keyup', keywordInputElEnterHandler, false);

  if (containerEl) {
    lock.render(containerEl)
      .on('complete', async pattern => {
          if (!pass) {
            pass = pattern;
            messageEl && (messageEl.innerText = 'Use your pattern to unlock screen.');
            lock.clear();
          } else if(pattern == pass) {
            lock.success();
            await logseq.Editor.restoreEditingCursor();
            await logseq.Editor.exitEditingMode(true);
            logseq.hideMainUI();
          }
          else {
            lock.failure();
          }

      })
      .on('clear', () => {
      });
  }

  // hotkeys
  const hotkeys = (window as any)?.hotkeys;
  const bindKeys = async function() {
    if (hotkeys) {
      hotkeys('esc,q,command+alt+l', async function (event, handler) {
        switch (handler.key) {
          case 'esc': // ESC
          case 'q': // q
          case 'command+alt+l': // cmd+alt+l
            if (!pass) {
              await logseq.Editor.restoreEditingCursor();
              await logseq.Editor.exitEditingMode(true);
              logseq.hideMainUI({
                restoreEditingCursor: true
              });
            }
          break;
        }
      });
    }
  };

  bindKeys();


  if (showToolbarIcon) {
    logseq.App.registerUIItem('toolbar', {
      key: 'open-lock-screen',
      template: `
      <a data-on-click="show" class="button" style="font-size: 20px">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
        </svg>
      </a>
    `,
    });
  }

  const commandHandler = async () => {
    openModel.show();
  };

  logseq.App.registerCommandPalette({
    key: `lock-screen`,
    label: `Lock screen with a password`,
    keybinding: {
      mode: 'global',
      binding: keyBindings.lockScreen
    }
  }, commandHandler);
}

logseq.ready(main).catch(console.error);
