import "../aliases"

// import ClientSync from './clients-sync'
import ClientsCleaner from './clients-cleaner'

// new ClientSync({ name: "Client sync", pauseSec: 60 * 5 }).main()
new ClientsCleaner({ name: "Clients cleaner", pauseSec: 60 * 60 }).main()
