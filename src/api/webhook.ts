import http from "http"

import config from "@root/config"
import { error, log } from "@helpers/logger"
import PaymentService from "@services/payment"

class WebhookServer {
  constructor(private payment: PaymentService) {}

  public process() {
    const server = http.createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (req.method !== "POST" || req.url !== config.yookassaWebhookPath) {
        res.writeHead(404)
        res.end()
        return
      }

      try {
        const body = await this.readBody(req)
        const notification = JSON.parse(body)

        await this.payment.processYooKassaWebhook(notification)

        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
      } catch (e: any) {
        error("YooKassa webhook processing error", e.message || e)
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: false }))
      }
    })

    server.listen(config.webhookPort, () => {
      log(`🌐 Webhook server listening on :${config.webhookPort}${config.yookassaWebhookPath}`)
    })
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Array<Buffer> = []

      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      req.on("error", reject)
    })
  }
}

export default WebhookServer
