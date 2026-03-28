import "../aliases"

import ClientsDisabler from "./clients-disabler"
import ExpireReminder from "./expire-reminder"
import PeerMonitor from "./peer-monitor"

new ClientsDisabler({ name: "Clients disabler", pauseSec: 60 * 60 }).main()
new ExpireReminder({ name: "Expire reminder", pauseSec: 60 * 60 }).main()
new PeerMonitor({ name: "Peer monitor", pauseSec: 60 * 5 }).main()
