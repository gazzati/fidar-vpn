import util from "util"
import childProcess from "child_process"
import config from "@root/config"

const execute = util.promisify(childProcess.exec)

const { wgParams } = config

const MAX_CLIENTS = 253

const profilePath = `/etc/wireguard/${wgParams.SERVER_WG_NIC}.conf`

const exec = async (command: string) => {
    try {
        const { stdout, stderr } = await execute(command)
        if (stderr) throw new Error(stderr)

        return stdout
      } catch (e) {
        console.error(e);
      }
}

const getDotIp = async () => {
    const baseIp = wgParams.SERVER_WG_IPV4.split(".").slice(0, -1).join(".")
    const availableDots = Array.from({length: MAX_CLIENTS}, (_, i) => i + 2)

    for(const dot in availableDots) {
        const dotExist = await exec(`grep -c "${baseIp}.${dot}" ${profilePath}`)
        if(!dotExist) return dot
    }

    throw new Error(`The subnet configured supports only ${MAX_CLIENTS} clients`)
}

const getIpV4 = async (dotIp: string) => {
    const baseIp = wgParams.SERVER_WG_IPV4.split(".").slice(0, -1).join(".")
    const ipV4 = baseIp.concat(dotIp)

    const ipV4Exist =  await exec(`grep -c "${ipV4}/32" ${profilePath}`)
    if(ipV4Exist)  throw new Error("Client with the specified IPv4 was already created")

    return ipV4
}

const getIpV6 = async (dotIp: string) => {
    const baseIp = wgParams.SERVER_WG_IPV6.split("::")[0]
    const ipV6 = baseIp.concat(dotIp)

    const ipV6Exist =  await exec(`grep -c "${ipV6}/128" ${profilePath}`)
    if(ipV6Exist)  throw new Error("Client with the specified IPv6 was already created")

    return ipV6
}

const generateClientConf = (clientPrivateKey: string, clientPresharedKey: string, ipV4: string, ipV6: string) => {
    `[Interface]
    PrivateKey = ${clientPrivateKey}
    Address = ${ipV4}/32,${ipV6}/128
    DNS = ${wgParams.CLIENT_DNS_1},${wgParams.CLIENT_DNS_2}

    [Peer]
    PublicKey = ${wgParams.SERVER_PUB_KEY}
    PresharedKey = ${clientPresharedKey}
    Endpoint = ${wgParams.SERVER_PUB_IP}:${wgParams.SERVER_PORT}
    AllowedIPs = ${wgParams.ALLOWED_IPS}`
}

export const newClient = async (name: string) => {
    if(!name || !new RegExp(/^[a-zA-Z0-9_-]+$/).test(name)) throw Error("Invalid [name] format")

    const exist = await exec(`grep -c -E "^### Client ${name}\$" ${profilePath}`)
    if(exist) throw Error("Client already exist")

    const dotIp = await getDotIp()

    const ipV4 = await getIpV4(dotIp)
    const ipV6 = await getIpV6(dotIp)

    const clientPrivateKey = await exec("wg genkey")
    const clientPublicKey = await exec(`echo "${clientPrivateKey}" | wg pubkey`)
    const clientPresharedKey = await exec("wg genpsk")


   const a = await exec(`echo "${generateClientConf(clientPrivateKey, clientPresharedKey, ipV4, ipV6)}" >"${__dirname}/${wgParams.SERVER_WG_NIC}-client-${name}.conf"`)

   console.log(a)
}
