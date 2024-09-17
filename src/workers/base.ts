import {entities} from "@database/data-source"
import Logger from '@helpers/logger'

abstract class Base {
  protected logger: Logger
  private pauseMs: number

  protected entities = entities

  constructor({name, pauseSec}: {name: string, pauseSec: number}) {
    this.logger = new Logger(name)
    this.pauseMs = pauseSec * 1000
  }

  async main() {
    if (!this.pauseMs) return process.exit()

    await this.sleep(500) // for db connect

    this.logger.log('Started')

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.loop()
      } catch (error) {
        this.logger.error(error)
      }

      await this.sleep()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async loop() {}

  async sleep(pause = this.pauseMs) {
    await new Promise((resolve) => setTimeout(resolve, pause))
  }
}

export default Base
