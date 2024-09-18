import "../aliases"

import ClientsCleaner from "./clients-cleaner"

new ClientsCleaner({ name: "Clients cleaner", pauseSec: 60 * 60 }).main()
