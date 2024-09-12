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
    if (stderr) console.error(stderr)

    return stdout
  } catch (e) {
    console.error(e)
  }
}

const getDotIp = async () => {
  const baseIp = wgParams.SERVER_WG_IPV4.split(".").slice(0, -1).join(".")
  const availableDots = Array.from({ length: MAX_CLIENTS }, (_, i) => i + 2)

  for (const dot in availableDots) {
    const dotExist = await exec(`grep -c "${baseIp}.${dot}" ${profilePath}`)
    if (!dotExist) return dot
  }

  throw new Error(`The subnet configured supports only ${MAX_CLIENTS} clients`)
}

const getIpV4 = async (dotIp: string) => {
  const baseIp = wgParams.SERVER_WG_IPV4.split(".").slice(0, -1).join(".")
  const ipV4 = `${baseIp}.${dotIp}`

  const ipV4Exist = await exec(`grep -c "${ipV4}/32" ${profilePath}`)
  if (ipV4Exist) throw new Error("Client with the specified IPv4 was already created")

  return ipV4
}

const getIpV6 = async (dotIp: string) => {
  const baseIp = wgParams.SERVER_WG_IPV6.split("::")[0]
  const ipV6 = `${baseIp}::${dotIp}`

  const ipV6Exist = await exec(`grep -c "${ipV6}/128" ${profilePath}`)
  if (ipV6Exist) throw new Error("Client with the specified IPv6 was already created")

  return ipV6
}

const generateClientConf = (clientPrivateKey: string, clientPresharedKey: string, ipV4: string, ipV6: string) => {
  return `[Interface]\nPrivateKey = ${clientPrivateKey}\nAddress = ${ipV4}/32,${ipV6}/128\nDNS = ${wgParams.CLIENT_DNS_1},${wgParams.CLIENT_DNS_2}\n\n[Peer]\nPublicKey = ${wgParams.SERVER_PUB_KEY}\nPresharedKey = ${clientPresharedKey}\nEndpoint = ${wgParams.SERVER_PUB_IP}:${wgParams.SERVER_PORT}\nAllowedIPs = ${wgParams.ALLOWED_IPS}`
}

const generateServerConf = (
  name: string,
  clientPublicKey: string,
  clientPresharedKey: string,
  ipV4: string,
  ipV6: string
) => {
  return `\n### Client ${name}\n[Peer]\nPublicKey = ${clientPublicKey}\nPresharedKey = ${clientPresharedKey}\nAllowedIPs = ${ipV4}/32,${ipV6}/128`
}

export const newClient = async (name: string) => {
  if (!name || !new RegExp(/^[a-zA-Z0-9_-]+$/).test(name)) throw Error("Invalid [name] format")

  const exist = await exec(`grep -c -E "^### Client ${name}\$" ${profilePath}`)
  if (exist) throw Error("Client already exist")

  const dotIp = await getDotIp()

  const ipV4 = await getIpV4(dotIp)
  const ipV6 = await getIpV6(dotIp)

  const clientPrivateKey = await exec("wg genkey")
  if (!clientPrivateKey) throw Error("[clientPrivateKey] not generated")

  const clientPublicKey = await exec(`echo "${clientPrivateKey}" | wg pubkey`)
  if (!clientPublicKey) throw Error("[clientPublicKey] not generated")

  const clientPresharedKey = await exec("wg genpsk")
  if (!clientPresharedKey) throw Error("[clientPresharedKey] not generated")

  const clientConf = generateClientConf(clientPrivateKey, clientPresharedKey, ipV4, ipV6)
  const clientConfPath = `/home/wg/clients/${wgParams.SERVER_WG_NIC}-client-${name}.conf`

  await exec(`echo "${clientConf}" > ${clientConfPath}`)

  const serverConf = generateServerConf(name, clientPublicKey, clientPresharedKey, ipV4, ipV6)

  await exec(`echo "${serverConf}" >> ${profilePath}`)

  await exec(`wg syncconf ${wgParams.SERVER_WG_NIC} <(wg-quick strip ${wgParams.SERVER_WG_NIC})`)

  const qr = await exec(`qrencode -t ansiutf8 < ${clientConfPath}`)

  console.log(qr)

  return qr
}
