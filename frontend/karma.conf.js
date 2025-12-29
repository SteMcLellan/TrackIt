// Karma configuration file, see link for more information
// https://karma-runner.github.io/6.4/config/configuration-file.html

const { execSync } = require('child_process');

function resolveChromeBinary() {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }

  const candidates = ['google-chrome-stable', 'google-chrome', 'chromium-browser', 'chromium'];

  for (const binary of candidates) {
    try {
      const location = execSync(`command -v ${binary}`, {
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .trim();

      if (location) {
        return location;
      }
    } catch (error) {
      // Ignore and move to the next candidate.
    }
  }

  return require('puppeteer').executablePath();
}

process.env.CHROME_BIN = resolveChromeBinary();

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/trackit'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      }
    },
    singleRun: false,
    restartOnFileChange: false
  });
};
