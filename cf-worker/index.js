/**
 * jsproxy cfworker api
 * 
 * @update: 2019-05-03
 * @author: EtherDream
 * @see: https://github.com/EtherDream/jsproxy/
 */
const pairs = Object.entries

addEventListener('fetch', e => {
  const ret = handler(e.request)
    .catch(err => new Response(err))

  e.respondWith(ret)
})


const PREFLIGHT_INIT = {
  status: 204,
  headers: new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
    'access-control-allow-headers': '--url,--referer,--cookie,--origin,--ext,--aceh,--ver,--type,--mode,accept,accept-charset,accept-encoding,accept-language,accept-datetime,authorization,cache-control,content-length,content-type,date,if-match,if-modified-since,if-none-match,if-range,if-unmodified-since,max-forwards,pragma,range,te,upgrade,upgrade-insecure-requests,x-requested-with,chrome-proxy',
    'access-control-max-age': '1728000',
  }),
}

/**
 * @param {Request} req
 */
async function handler(req) {
  const reqHdrRaw = req.headers

  // preflight
  if (reqHdrRaw.has('access-control-request-headers')) {
    return new Response(null, PREFLIGHT_INIT)
  }

  let url = ''
  let extHdrs = null
  let acehOld = false

  const reqHdrNew = new Headers(reqHdrRaw)

  for (const [k, v] of reqHdrRaw.entries()) {
    if (!k.startsWith('--')) {
      continue
    }
    const k2 = k.substr(2)
    switch (k2) {
    case 'url':
      url = v
      break
    case 'aceh':
      acehOld = true
      break
    case 'mode':
    case 'type':
      break
    case 'ext':
      extHdrs = JSON.parse(v)
      break
    default:
      reqHdrNew.set(k2, v)
      break
    }
  }

  if (extHdrs) {
    for (const [k, v] of pairs(extHdrs)) {
      reqHdrNew.set(k, v)
    }
  }

  // proxy
  const res = await fetch(url, {
    method: req.method,
    headers: reqHdrNew,
  })

  // header filter
  const resHdrOld = res.headers
  const resHdrNew = new Headers(resHdrOld)

  let expose = '*'
  let vary = '--url'

  for (const [k, v] of resHdrOld.entries()) {
    if (k === 'access-control-allow-origin' ||
        k === 'access-control-expose-headers' ||
        k === 'location' ||
        k === 'set-cookie'
    ) {
      const x = '--' + k
      resHdrNew.set(x, v)
      if (acehOld) {
        expose = expose + ',' + x
      }
      resHdrNew.delete(k)
    }
    else if (k === 'vary') {
      vary = vary + ',' + v
    }
    else if (acehOld &&
      k !== 'cache-control' &&
      k !== 'content-language' &&
      k !== 'content-type' &&
      k !== 'expires' &&
      k !== 'last-modified' &&
      k !== 'pragma'
    ) {
      expose = expose + ',' + k
    }
  }

  if (acehOld) {
    expose = expose + ',--s'
    resHdrNew.set('--t', '1')
  }

  resHdrNew.set('access-control-expose-headers', expose)
  resHdrNew.set('access-control-allow-origin', '*')
  resHdrNew.set('vary', vary)
  resHdrNew.set('--s', res.status)

  return new Response(res.body, {
    status: 200,
    headers: resHdrNew,
  })
}