import { entities } from "@database/data-source"
import Logger from "@helpers/logger"

abstract class Base {
  protected logger: Logger
  private pauseMs: number
  private running = true

  protected entities = entities

  constructor({ name, pauseSec }: { name: string; pauseSec: number }) {
    this.logger = new Logger(name)
    this.pauseMs = pauseSec * 1000
  }

  async main() {
    if (!this.pauseMs) return

    await this.sleep(500) // for db connect

    this.logger.log("Started")

    const stop = () => {
      if (!this.running) return
      this.running = false
      this.logger.log("Stopping...")
    }

    process.on("SIGINT", stop)
    process.on("SIGTERM", stop)

    while (this.running) {
      try {
        await this.loop()
      } catch (error) {
        this.logger.error(error)
      }

      await this.sleep(this.pauseMs)
    }

    process.off("SIGINT", stop)
    process.off("SIGTERM", stop)

    this.logger.log("Stopped")
  }

  public async loop() {}

  protected async sleep(pause = this.pauseMs) {
    const stepMs = 1_000
    let elapsed = 0

    while (this.running && elapsed < pause) {
      const timeout = Math.min(stepMs, pause - elapsed)
      await new Promise(resolve => setTimeout(resolve, timeout))
      elapsed += timeout
    }
  }
}

export default Base
