import { logger } from '@wdio/logger'


import { promisify } from 'util'
import fs from 'fs-extra'
import SeleniumStandalone from 'selenium-standalone'

import { getFilePath } from './utils'

const DEFAULT_LOG_FILENAME = 'wdio-selenium-standalone.log'
const log = logger('@wdio/selenium-standalone-service')

const DEFAULT_CONNECTION = {
    protocol: 'http',
    hostname: 'localhost',
    port: 4444,
    path: '/wd/hub'
}


export interface Config {
    outputDir?: string,
    watch?: boolean,
}

export interface SeleniumStandaloneOptions {

    logPath?: string;
    installArgs?: any;
    args?: any;
    skipSeleniumInstall?: boolean;
}
export default class SeleniumStandaloneLauncher {

    capabilities: any
    logPath?: string
    args: Partial<import('selenium-standalone').StartOpts>;
    installArgs: Partial<import('selenium-standalone').InstallOpts>;
    skipSeleniumInstall: boolean
    watchMode: boolean = false
    process!: SeleniumStandalone.ChildProcess

    constructor(options: SeleniumStandaloneOptions, capabilities: any, config: Config) {
        this.capabilities = capabilities
        this.logPath = options.logPath || config.outputDir
        this.args = options.args || {}
        this.installArgs = options.installArgs || {}
        this.skipSeleniumInstall = Boolean(options.skipSeleniumInstall)
    }

    async onPrepare(config: Config): Promise<void> {
        this.watchMode = Boolean(config.watch)

        if (!this.skipSeleniumInstall) {
            await promisify(SeleniumStandalone.install.bind(this.installArgs))
        }

        /**
         * update capability connection options to connect
         * to standalone server
         */
        (
            Array.isArray(this.capabilities)
                ? this.capabilities
                : Object.values(this.capabilities)
        ).forEach((cap) => Object.assign(cap, DEFAULT_CONNECTION, { ...cap }))

        /**
         * start Selenium Standalone server
         */
        this.process = promisify(SeleniumStandalone.start.bind(this.args))

        if (typeof this.logPath === 'string') {
            this._redirectLogStream()
        }

        if (this.watchMode) {
            this.process.on('SIGINT', this._stopProcess)
            this.process.on('exit', this._stopProcess)
            this.process.on('uncaughtException', this._stopProcess)
        }
    }

    onComplete(): void {
        // selenium should not be killed in watch mode
        if (!this.watchMode) {
            this._stopProcess()
        }
    }

    _redirectLogStream(): void {
        const logFile = getFilePath(this.logPath!, DEFAULT_LOG_FILENAME)

        // ensure file & directory exists
        fs.ensureFileSync(logFile)

        const logStream = fs.createWriteStream(logFile, { flags: 'w' })
        this.process.stdout?.pipe(logStream)
        this.process.stderr?.pipe(logStream)
    }

    _stopProcess = (): void => {
        if (this.process) {
            log.info('shutting down all browsers')
            this.process.kill()
        }
    }
}
